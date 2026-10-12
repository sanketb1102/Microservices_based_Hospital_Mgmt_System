const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  patientId:     { type: String, required: true },
  patientName:   { type: String },
  description:   { type: String },
  amount:        { type: Number, required: true },
  paymentStatus: { type: String, default: 'unpaid' },
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bill', BillSchema);
