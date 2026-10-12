const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  doctorId:  { type: String, required: true },
  date:      { type: String },
  time:      { type: String },
  reason:    { type: String },
  status:    { type: String, default: 'scheduled' },

  vitals: {                    // nested object
    bp:     String,
    pulse:  String,
    temp:   String,
    weight: String
  },

  clinicalNotes: String,
  prescription:  String
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
