const mongoose = require("mongoose"); // imports mongoose

// creates a blueprint(schema) for the person document in MongoDB
const PersonSchema = new mongoose.Schema({
 
  name: { type: String, required: true, trim: true }, // type:string:must be text
  // required:true:field must contain data
  // trim:true:removes spaces at the beginning and at the end before saving
  surname: { type: String, required: true, trim: true },// same rules as name
  idNumber: { type: String, required: true, unique: true }, // type:string: store as string to preserve leading zeros don't get dropped when saving
  // required: true: must always be given
  // unique: true: ensures no two people have the same ID number (at the schema validation level)
  dateOfBirth: { type: Date, required: true },
});

// index to ensure no duplicate idNumber at DataBase
PersonSchema.index({ idNumber: 1 }, { unique: true });
// this compiles the schema into a model called 'person'
module.exports = mongoose.model("Person", PersonSchema);
