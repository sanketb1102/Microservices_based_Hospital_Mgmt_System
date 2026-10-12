const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName:  { type: String },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  role:      { type: String, default: 'receptionist' },

  otp:         { type: String },      // temporary OTP code
  otpExpiry:   { type: Date },        // when the OTP stops being valid
  inviteToken: { type: String },      // token for invite-based registration
  isVerified:  { type: Boolean, default: true }
});

module.exports = mongoose.model('User', UserSchema);
