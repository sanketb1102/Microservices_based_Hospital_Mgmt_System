require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const Bill = require('./models/Bill');
const { authenticate, authorize } = require('./middleware/authMiddleware');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3005;

app.get('/health', (req, res) => res.send({ service: 'billing-service', status: 'ok' }));

app.use(authenticate);

// Doctors have no business reason to see hospital finances, so they are
// deliberately left out of every route in this service.
app.get('/billing', authorize('admin', 'billing', 'receptionist'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.paymentStatus = req.query.status;
    if (req.query.patientId) filter.patientId = req.query.patientId;

    const bills = await Bill.find(filter);
    res.send(bills);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.post('/billing', authorize('admin', 'billing'), async (req, res) => {
  try {
    const { patientId, amount } = req.body;
    if (!patientId || amount === undefined) {
      return res.status(400).send({ message: 'patientId and amount are required' });
    }

    const bill = new Bill(req.body);
    await bill.save();
    res.send({ message: 'Bill created', bill });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.put('/billing/:id', authorize('admin', 'billing'), async (req, res) => {
  try {
    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bill) return res.status(404).send({ message: 'Bill not found' });
    res.send({ message: 'Bill updated', bill });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

app.delete('/billing/:id', authorize('admin'), async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).send({ message: 'Bill not found' });
    res.send({ message: 'Bill deleted' });
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
    console.log('Billing Service connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`Billing Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
