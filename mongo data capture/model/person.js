const mongoose = require("mongoose"); // imports mongoose

// creates a blueprint(schema) for the person document in MongoDB
const PersonSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, 
  surname: { type: String, required: true, trim: true },
  idNumber: { type: String, required: true, unique: true },
  dateOfBirth: { type: Date, required: true },
});

// index to ensure no duplicate idNumber at DataBase
PersonSchema.index({ idNumber: 1 }, { unique: true });
// this compiles the schema into a model called 'person'
module.exports = mongoose.model("Person", PersonSchema);
