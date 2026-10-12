require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const Doctor = require('./models/Doctor');
const { authenticate, authorize } = require('./middleware/authMiddleware');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;

app.get('/health', (req, res) => res.send({ service: 'doctor-service', status: 'ok' }));

app.use(authenticate);

// Everyone needs to read the doctor list in order to book against it.
app.get('/doctors', authorize('admin', 'doctor', 'receptionist', 'billing'), async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.send(doctors);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get('/doctors/:id', authorize('admin', 'doctor', 'receptionist', 'billing'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).send({ message: 'Doctor not found' });
    res.send(doctor);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// Managing the staff directory is an admin job.
app.post('/doctors', authorize('admin'), async (req, res) => {
  try {
    const { name, specialization } = req.body;
    if (!name || !specialization) {
      return res.status(400).send({ message: 'Missing fields' });
    }

    const doctor = new Doctor(req.body);
    await doctor.save();
    res.send({ message: 'Doctor saved', doctor });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.put('/doctors/:id', authorize('admin'), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doctor) return res.status(404).send({ message: 'Doctor not found' });
    res.send({ message: 'Doctor updated', doctor });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.delete('/doctors/:id', authorize('admin'), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).send({ message: 'Doctor not found' });
    res.send({ message: 'Doctor deleted' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing environment variables: MONGO_URI, JWT_SECRET');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Doctor Service connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`Doctor Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
