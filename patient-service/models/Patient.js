const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  age:        { type: Number, required: true },
  gender:     { type: String },
  phone:      { type: String },
  email:      { type: String },
  bloodGroup: { type: String }
});

module.exports = mongoose.model('Patient', PatientSchema);
