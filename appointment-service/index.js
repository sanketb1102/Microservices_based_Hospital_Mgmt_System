require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const Appointment = require('./models/Appointment');
const { authenticate, authorize } = require('./middleware/authMiddleware');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3004;

const PATIENT_SERVICE = process.env.PATIENT_SERVICE_URL || 'http://patient-service:3002';
const DOCTOR_SERVICE  = process.env.DOCTOR_SERVICE_URL  || 'http://doctor-service:3003';

app.get('/health', (req, res) => res.send({ service: 'appointment-service', status: 'ok' }));

app.use(authenticate);

app.get('/appointments', authorize('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.status) filter.status = req.query.status;

    const appointments = await Appointment.find(filter);
    res.send(appointments);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * Inter-service communication.
 *
 * Before booking, this service asks the patient service whether the
 * patient exists -- through its API, not by reading its collection.
 * Each service owns its own data; everyone else goes through the API.
 *
 * The caller's own JWT is forwarded, so this service has no elevated
 * key of its own -- it acts on behalf of the signed-in user, and the
 * patient service applies the same role rules it would to anyone.
 * ================================================================== */
app.post('/appointments', authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const { patientId, doctorId } = req.body;
    if (!patientId || !doctorId) {
      return res.status(400).send({ message: 'patientId and doctorId are required' });
    }

    const token = req.headers.authorization;

    try {
      await axios.get(`${PATIENT_SERVICE}/patients/${patientId}`, {
        headers: { Authorization: token },
        timeout: 3000
      });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(400).send({ message: 'Patient does not exist' });
      }
      // Timed out, refused, or the service is down. Without the timeout
      // above, a slow patient service would hold these requests open until
      // they pile up and take this service down with it.
      return res.status(503).send({ message: 'Patient service unavailable, try again' });
    }

    try {
      await axios.get(`${DOCTOR_SERVICE}/doctors/${doctorId}`, {
        headers: { Authorization: token },
        timeout: 3000
      });
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(400).send({ message: 'Doctor does not exist' });
      }
      return res.status(503).send({ message: 'Doctor service unavailable, try again' });
    }

    const appointment = new Appointment(req.body);
    await appointment.save();

    res.send({ message: 'Appointment booked', appointment });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.put('/appointments/:id', authorize('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const updates = { ...req.body };

    // Reception schedules visits; it should not be writing into a
    // patient's clinical record.
    if (req.user.role === 'receptionist') {
      delete updates.vitals;
      delete updates.clinicalNotes;
      delete updates.prescription;
    }

    const appointment = await Appointment.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!appointment) return res.status(404).send({ message: 'Appointment not found' });

    res.send({ message: 'Appointment updated', appointment });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.delete('/appointments/:id', authorize('admin'), async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).send({ message: 'Appointment not found' });
    res.send({ message: 'Appointment deleted' });
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
    console.log('Appointment Service connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`Appointment Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
