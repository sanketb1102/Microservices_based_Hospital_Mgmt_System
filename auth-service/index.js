require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const User = require('./models/User');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

/* ------------------------------------------------------------------
 * Nodemailer transport.
 * The credentials come from environment variables -- nothing sensitive
 * is written in the source. If SMTP is not configured the OTP is printed
 * to the console instead, so the flow is still testable in development.
 * ------------------------------------------------------------------ */
const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

async function sendMail(to, subject, text) {
  if (!transporter) {
    console.log(`[mailer] SMTP not configured. To: ${to} | ${subject} | ${text}`);
    return;
  }
  await transporter.sendMail({
    from: `"MediCore Security" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text
  });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// The JWT payload carries the identity and the role. Every other service
// reads the role from here to decide what the user is allowed to do.
function createToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

/* ==================================================================
 * 1. POST /signup -- register and send an OTP
 * ================================================================== */
app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).send({ message: 'Email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).send({ message: 'User already exists' });
    }

    // bcrypt is deliberately slow and salts automatically -- the right tool
    // for passwords, unlike a fast hash such as SHA-256.
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 'receptionist',
      isVerified: false,
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
    });
    await user.save();

    await sendMail(email, 'Your MediCore Verification Code',
      `Your OTP is ${otp}. It will expire in 10 minutes.`);

    res.send({ message: 'Signup successful. Check your email for the OTP.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * 2. POST /verify-signup -- confirm the OTP and activate the account
 * ================================================================== */
app.post('/verify-signup', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: 'User not found' });

    // Three checks: does it match, has it expired, is it still unused.
    if (!user.otp || user.otp !== otp) {
      return res.status(400).send({ message: 'Invalid OTP' });
    }
    if (user.otpExpiry < new Date()) {
      return res.status(400).send({ message: 'OTP has expired' });
    }

    user.isVerified = true;
    user.otp = undefined;        // cleared so the same code cannot be replayed
    user.otpExpiry = undefined;
    await user.save();

    res.send({ message: 'Email verified. You can log in now.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * 3. POST /login -- password login
 * ================================================================== */
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).send({ message: 'Invalid credentials' });

    if (user.isVerified === false) {
      return res.status(403).send({ message: 'Please verify your email first' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send({ message: 'Invalid credentials' });

    res.send({ token: createToken(user) });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * 4. POST /request-otp -- send a code for passwordless login
 * ================================================================== */
app.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: 'User not found' });

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendMail(email, 'Your Login Verification Code',
      `Your OTP is ${otp}. It will expire in 10 minutes.`);

    res.send({ message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * 5. POST /verify-otp -- passwordless login
 * ================================================================== */
app.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: 'User not found' });

    if (!user.otp || user.otp !== otp) {
      return res.status(400).send({ message: 'Invalid OTP' });
    }
    if (user.otpExpiry < new Date()) {
      return res.status(400).send({ message: 'OTP has expired' });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;
    await user.save();

    res.send({ token: createToken(user) });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * 6. POST /invite -- an admin invites a staff member by email
 * ================================================================== */
app.post('/invite', async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).send({ message: 'User already exists' });

    const inviteToken = crypto.randomBytes(24).toString('hex');

    const user = new User({
      firstName,
      lastName,
      email,
      password: await bcrypt.hash('invited', 10),  // placeholder until they set their own
      role: role || 'receptionist',
      inviteToken,
      isVerified: true
    });
    await user.save();

    const base = process.env.FRONTEND_URL || 'http://localhost';
    await sendMail(email, 'You have been invited to MediCore',
      `Set your password here: ${base}/set-password.html?token=${inviteToken}`);

    res.send({ message: 'Invite sent' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

/* ==================================================================
 * 7. POST /set-password -- an invited user chooses their password
 * ================================================================== */
app.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).send({ message: 'Token and password are required' });
    }

    const user = await User.findOne({ inviteToken: token });
    if (!user) return res.status(400).send({ message: 'Invalid or expired invite link' });

    user.password = await bcrypt.hash(password, 10);
    user.inviteToken = undefined;   // single use
    user.isVerified = true;
    await user.save();

    res.send({ message: 'Password set. You can log in now.' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get('/health', (req, res) => res.send({ service: 'auth-service', status: 'ok' }));

/* ================================================================== */
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing environment variables: MONGO_URI, JWT_SECRET');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Auth Service connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`Auth Service running on ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
