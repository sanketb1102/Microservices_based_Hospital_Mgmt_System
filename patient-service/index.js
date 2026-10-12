require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');

const Patient = require('./models/Patient');
const { authenticate, authorize } = require('./middleware/authMiddleware');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;

/* ------------------------------------------------------------------
 * Redis connection. 'redis' is the Docker Compose service name, which
 * Docker's internal DNS resolves to the container's IP.
 * ------------------------------------------------------------------ */
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

client.on('error', (err) => console.log('Redis error:', err.message));
client.connect().catch((err) => console.log('Redis unavailable:', err.message));

app.get('/health', (req, res) => res.send({ service: 'patient-service', status: 'ok' }));

// Everything below requires a valid token.
app.use(authenticate);

/* ==================================================================
 * READ -- the cache-aside pattern
 *
 * 1. Check Redis first.
 * 2. Cache hit  -> return it immediately.
 * 3. Cache miss -> query MongoDB, store the result in Redis, return it.
 *
 * Patient records are read far more often than they are written --
 * doctors, reception and billing all look up the same records repeatedly.
 * That read-to-write ratio is exactly where caching pays off.
 * ================================================================== */
app.get('/patients', authorize('admin', 'doctor', 'receptionist', 'billing'), async (req, res) => {
  try {
    const cached = await client.get('patients');
    if (cached) {
      console.log('Serving from Redis cache');
      res.set('X-Cache', 'HIT');
      return res.send(JSON.parse(cached));
    }

    const patients = await Patient.find();
    await client.set('patients', JSON.stringify(patients));

    res.set('X-Cache', 'MISS');
    res.send(patients);
  } catch (err) {
    // If Redis is unreachable the cache calls throw. Fall back to MongoDB
    // so reads still work -- the cache is an optimisation, not a
    // correctness dependency.
    try {
      const patients = await Patient.find();
      res.set('X-Cache', 'BYPASS');
      res.send(patients);
    } catch (dbErr) {
      res.status(500).send({ message: dbErr.message });
    }
  }
});

app.get('/patients/:id', authorize('admin', 'doctor', 'receptionist', 'billing'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).send({ message: 'Patient not found' });
    res.send(patient);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * WRITE -- every write invalidates the cache, so the next read
 * repopulates from the database instead of serving a stale list.
 * ================================================================== */
app.post('/patients', authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    await client.del('patients');      // invalidate
    res.send({ message: 'Patient saved', patient });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.put('/patients/:id', authorize('admin', 'receptionist'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }        // return the document AFTER the update
    );
    if (!patient) return res.status(404).send({ message: 'Patient not found' });

    await client.del('patients');
    res.send({ message: 'Patient updated', patient });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// Deleting a medical record is destructive, so it is admin-only.
app.delete('/patients/:id', authorize('admin'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).send({ message: 'Patient not found' });

    await client.del('patients');
    res.send({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ================================================================== */
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing environment variables: MONGO_URI, JWT_SECRET');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Patient Service connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`Patient Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
