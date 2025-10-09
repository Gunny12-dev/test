// ==========================
// === MODULE IMPORTS ===
// ==========================

const express = require("express"); // Web framework for creating HTTP servers and routes
const fs = require("fs"); // File system module for file operations (read/write/delete)
const path = require("path"); // Utilities for working with file and directory paths
const multer = require("multer"); // Middleware for handling multipart/form-data (file uploads)
const csv = require("fast-csv"); // Fast and memory-efficient CSV parser
const sqlite3 = require("sqlite3").verbose(); // Lightweight SQL database for local storage
const { once } = require("events"); // Used for awaiting event completion (e.g., stream finish)

// ==========================
// === APP SETUP ===
// ==========================

const app = express(); // Initialize Express app
const upload = multer({ dest: "uploads/" }); // Configure multer to store uploaded files in 'uploads' folder
const db = new sqlite3.Database("mydatabase.db"); // Connect or create SQLite database file

// ==========================
// === DIRECTORY INITIALIZATION ===
// ==========================

const outputDir = path.join(__dirname, "output");
const uploadDir = path.join(__dirname, "uploads");

// Ensure 'output' and 'uploads' directories exist
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ==========================
// === DATABASE INITIALIZATION ===
// ==========================

// Drop existing table (for clean runs during testing/development)
db.run("DROP TABLE IF EXISTS csv_import");

// Create table for imported CSV data with unique constraint
db.run(
  `CREATE TABLE IF NOT EXISTS csv_import (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    surname TEXT,
    initials TEXT,
    age INTEGER,
    date_of_birth TEXT,
    UNIQUE(name, surname, date_of_birth)
  )`,
  (err) => {
    if (err) console.error(err.message);
    else console.log("Table created or already exists.");
  }
);

// ==========================
// === MIDDLEWARE ===
// ==========================

// Serve static frontend files (from 'public' directory)
app.use(express.static("public"));

// Parse incoming form data (from POST requests)
app.use(express.urlencoded({ extended: true }));

// ==========================
// === RANDOM DATA ARRAYS ===
// ==========================

const names = [
  "Alice",
  "Ben",
  "Carla",
  "David",
  "Ethan",
  "Fiona",
  "George",
  "Hannah",
  "Ian",
  "Julia",
  "Kevin",
  "Laura",
  "Mike",
  "Nina",
  "Oscar",
  "Paula",
  "Quinn",
  "Ryan",
  "Sophia",
  "Tom",
];

const surnames = [
  "Adams",
  "Brown",
  "Clark",
  "Davis",
  "Evans",
  "Foster",
  "Garcia",
  "Hill",
  "Irwin",
  "Jones",
  "King",
  "Lewis",
  "Morris",
  "Nelson",
  "Owens",
  "Parker",
  "Quinn",
  "Roberts",
  "Smith",
  "Turner",
];

// ==========================
// === HELPER FUNCTIONS ===
// ==========================

/**
 * Generate a random date based on a person's age.
 * Ensures the date corresponds roughly to someone of that age.
 */
function randomDate(age) {
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - age;
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1; // keep it simple (1–28)
  return new Date(birthYear, month, day).toISOString().split("T")[0]; // YYYY-MM-DD format
}

/**
 * Generate a random CSV file with a given number of records.
 * Returns a promise resolving to the file path.
 */
async function generateCSV(recordCount) {
  const filePath = path.join(outputDir, "output.csv");
  const writeStream = fs.createWriteStream(filePath);

  // Write CSV header
  writeStream.write("name,surname,initials,age,date_of_birth\n");

  const used = new Set(); // Track unique combinations
  let count = 0;

  while (count < recordCount) {
    // Randomly select name and surname
    const name = names[Math.floor(Math.random() * names.length)];
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const initials = name[0];
    const age = Math.floor(Math.random() * 63) + 18; // Random age 18–80
    const dob = randomDate(age);

    const key = `${name}_${surname}_${age}_${dob}`; // Uniqueness key

    if (!used.has(key)) {
      used.add(key);
      const line = `${name},${surname},${initials},${age},${dob}\n`;

      // Handle backpressure (pause if stream buffer is full)
      if (!writeStream.write(line)) await once(writeStream, "drain");
      count++;
    }
  }

  // Close the stream and ensure completion
  writeStream.end();
  await once(writeStream, "finish");

  console.log(`CSV generated: ${filePath} (${recordCount} records)`);
  return filePath;
}

// ==========================
// === ROUTE: GENERATE CSV ===
// ==========================

app.post("/generate", async (req, res) => {
  const count = parseInt(req.body.count, 10);

  // Validate record count
  if (!count || count <= 0)
    return res.status(400).send("Invalid number of records.");

  try {
    await generateCSV(count);
    res.send(`Generated ${count} records in output/output.csv`);
  } catch (err) {
    console.error("Error generating CSV:", err);
    res.status(500).send("Error generating CSV file.");
  }
});

// ==========================
// === ROUTE: UPLOAD CSV AND IMPORT ===
// ==========================

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const filePath = req.file.path;
  const BATCH_SIZE = 10000; // Commit records in batches
  let batch = [];
  let inserted = 0;

  // Prepare insert statement with IGNORE to skip duplicates
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO csv_import (name, surname, initials, age, date_of_birth) VALUES (?, ?, ?, ?, ?)"
  );

  db.serialize(() => {
    db.run("BEGIN TRANSACTION"); // Start transaction for faster bulk insert

    const stream = fs
      .createReadStream(filePath)
      .pipe(csv.parse({ headers: true }));

    // Handle CSV parse errors
    stream.on("error", (error) => {
      console.error("CSV parsing error:", error);
      db.run("ROLLBACK");
      stmt.finalize();
      fs.unlink(filePath, () => {}); // Delete temp upload
      res.status(500).send("CSV parsing error, transaction rolled back.");
    });

    // Process CSV rows in batches
    stream.on("data", (row) => {
      batch.push(row);
      if (batch.length >= BATCH_SIZE) {
        for (const r of batch) {
          stmt.run(r.name, r.surname, r.initials, r.age, r.date_of_birth);
        }
        inserted += batch.length;
        batch = [];
      }
    });

    // Finalize last batch and commit transaction
    stream.on("end", () => {
      if (batch.length > 0) {
        for (const r of batch) {
          stmt.run(r.name, r.surname, r.initials, r.age, r.date_of_birth);
        }
        inserted += batch.length;
      }

      db.run("COMMIT", (err) => {
        stmt.finalize();
        fs.unlink(filePath, () => {}); // Remove uploaded file after processing

        if (err) {
          console.error("Commit failed:", err);
          return res.status(500).send("Database commit failed.");
        }

        console.log(`Imported ${inserted} rows successfully`);
        res.send(`Imported ${inserted} rows successfully.`);
      });
    });
  });
});

// ==========================
// === START SERVER ===
// ==========================

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
