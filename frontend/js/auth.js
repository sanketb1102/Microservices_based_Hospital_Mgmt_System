/* ==========================================================================
   auth.js -- reading the logged-in user out of the JWT.
   (Same job as the original React utils/auth.js.)
   ========================================================================== */

/**
 * A JWT is three base64url segments joined by dots:
 *   header.payload.signature
 * The middle one is only encoded, not encrypted, so the browser can read it
 * without asking the server.
 *
 * Important: this is NOT verification. Anyone can hand-craft a payload. It
 * exists so the interface can show the right name and hide links the user
 * cannot use. Every service re-verifies the signature on every request.
 */
const getUserFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = token.split('.')[1];            // the middle segment
    const decoded = JSON.parse(atob(payload));      // base64 decode, then parse

    // exp is in seconds; Date.now() is in milliseconds.
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return null;
    }

    return {
      email: decoded.email,
      role: decoded.role || 'user',
      firstName: decoded.firstName || '',
      lastName: decoded.lastName || '',
      fullName:
        ((decoded.firstName || '') + (decoded.lastName ? ' ' + decoded.lastName : '')).trim()
        || 'User'
    };
  } catch (err) {
    localStorage.removeItem('token');
    return null;
  }
};

const logout = () => {
  // A signed JWT stays technically valid until it expires -- that is the cost
  // of statelessness. Dropping it ends the session for this browser; a short
  // expiry keeps the remaining window small.
  localStorage.removeItem('token');
  Router.navigate('/', { replace: true });
};
