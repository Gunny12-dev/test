const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const Person = require("./model/person");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // your static files

// MongoDB connection
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/person_info_gathering";

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.error("Mongo connection error", err));

// Utility: validate ID number - exactly 13 digits
function validateIdNumber(id) {
  return typeof id === "string" && /^\d{13}$/.test(id);
}

// Utility: validate DOB format dd/mm/YYYY
function validateDobFormat(dobStr) {
  if (typeof dobStr !== "string") return false;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return false;
  const [dd, mm, yyyy] = dobStr.split("/").map((s) => parseInt(s, 10));
  const date = new Date(yyyy, mm - 1, dd);
  return (
    date &&
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd
  );
}

// Convert DOB string to Date
function parseDobToDate(dobStr) {
  const [dd, mm, yyyy] = dobStr.split("/").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

// Check if ID matches DOB (YYMMDD)
function idMatchesDob(idNumber, dobStr) {
  if (!validateIdNumber(idNumber) || !validateDobFormat(dobStr)) return false;
  const idDatePart = idNumber.slice(0, 6);
  const [dd, mm, yyyy] = dobStr.split("/");
  const yy = yyyy.slice(2);
  const dobYYMMDD = `${yy}${mm}${dd}`;
  return idDatePart === dobYYMMDD;
}

// API endpoint
app.post("/api/person", async (req, res) => {
  try {
    const { name, surname, idNumber, dateOfBirth, checkIdMatchesDob } =
      req.body;
    const errors = {};

    const namePattern = /^[A-Za-z\-\' ]{1,60}$/;
    if (!name || !namePattern.test(name.trim()))
      errors.name =
        "Name is required and must contain only letters, spaces, hyphens or apostrophes.";
    if (!surname || !namePattern.test(surname.trim()))
      errors.surname =
        "Surname is required and must contain only letters, spaces, hyphens or apostrophes.";
    if (!validateIdNumber(idNumber))
      errors.idNumber = "ID Number must be numeric and exactly 13 digits.";
    if (!validateDobFormat(dateOfBirth))
      errors.dateOfBirth = "Date of Birth must be in format dd/mm/YYYY.";
    if (checkIdMatchesDob && !idMatchesDob(idNumber, dateOfBirth))
      errors.idNumberDobMatch =
        "ID Number does not match Date of Birth (first 6 digits YYMMDD).";

    if (Object.keys(errors).length > 0)
      return res.status(400).json({
        success: false,
        errors,
        values: { name, surname, idNumber, dateOfBirth },
      });

    // Check duplicate
    const existing = await Person.findOne({ idNumber });
    if (existing)
      return res.status(409).json({
        success: false,
        message: "Duplicate ID Number found",
        values: { name, surname, idNumber, dateOfBirth },
      });

    const dobDate = parseDobToDate(dateOfBirth);
    const person = new Person({
      name: name.trim(),
      surname: surname.trim(),
      idNumber,
      dateOfBirth: dobDate,
    });
    await person.save();

    return res.status(201).json({ success: true, person });
  } catch (err) {
    if (err && err.code === 11000)
      return res.status(409).json({
        success: false,
        message: "Duplicate ID Number (DB index) detected.",
      });
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
