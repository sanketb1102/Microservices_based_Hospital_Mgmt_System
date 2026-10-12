const jwt = require('jsonwebtoken');

/**
 * authenticate -- proves WHO the caller is.
 *
 * Each data service verifies the JWT signature itself using the shared
 * secret. It does not call the auth service to do it -- that is the point
 * of a stateless token: no network hop, no shared session store.
 */
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).send({ message: 'No token provided' });
  }

  // Accepts both "Bearer <token>" and a bare token.
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }
};

/**
 * authorize -- decides WHAT the caller may do.
 *
 * A higher-order function: authorize('admin', 'doctor') returns the
 * middleware that checks req.user.role against that list.
 *
 * This runs on the server on every protected route. The frontend also hides
 * links the user cannot use, but that is only for a tidy interface --
 * anyone can bypass the UI with Postman, so the server is the real gate.
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).send({ message: 'Forbidden' });
  }
  next();
};

module.exports = { authenticate, authorize };
