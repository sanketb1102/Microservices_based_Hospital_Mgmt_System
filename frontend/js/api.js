/* ==========================================================================
   api.js -- the single place where the browser talks to the backend.

   Every request goes to this same origin. Nginx sits there and forwards it
   to whichever service owns that path prefix:
     /auth/...          -> auth-service:3001
     /patients/...      -> patient-service:3002
     /doctors/...       -> doctor-service:3003
     /appointments/...  -> appointment-service:3004
     /billing/...       -> billing-service:3005

   The browser never learns a service hostname or port, and because nothing
   is cross-origin there is no CORS to configure.
   ========================================================================== */

const API = {
  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = token;
    }

    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });
    } catch (err) {
      throw new ApiError('Cannot reach the server. Check your connection.', 0);
    }

    // 401 means the token is missing, expired or invalid. Whatever page the
    // user is on, the only way forward is to log in again.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      localStorage.removeItem('token');
      Router.navigate('/?expired=1', { replace: true });
      throw new ApiError('Session expired', 401);
    }

    const text = await response.text();
    const data = text ? safeJson(text) : null;

    if (!response.ok) {
      throw new ApiError(
        (data && data.message) || `Request failed (${response.status})`,
        response.status
      );
    }

    return data;
  },

  get(path)        { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body }); },
  put(path, body)  { return this.request(path, { method: 'PUT', body }); },
  delete(path)     { return this.request(path, { method: 'DELETE' }); }
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
