//Imports the Mongoose library, an Object Data Modeling (ODM) library for MongoDB
const mongoose = require('mongoose');

//Creates a new schema that outlines the structure, validation rules, and default values for documents
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });
//An options object passed to the schema that automatically adds two fields to every document: createdAt and updatedAt

//Compiles the schema into a Mongoose Model named User and exports it
module.exports = mongoose.model('User', UserSchema);