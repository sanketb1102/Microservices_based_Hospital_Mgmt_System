# MediCore HMS

A hospital management system built as five independent Node.js services behind
an Nginx API gateway, with a plain HTML/CSS/JavaScript frontend.

Staff log in, and what they can see and do depends on their role: admin,
doctor, receptionist and billing staff each get a different set of screens and
a different set of permitted API calls.

---

## Architecture

```
                    Browser
                       |
                       | http://localhost
                       v
            +----------------------+
            |  Nginx (api-gateway) |   serves the frontend
            |       port 80        |   + routes by URL path prefix
            +----------------------+
                       |
     +---------+-------+-------+---------+---------+
     |         |               |         |         |
  auth      patient         doctor    appoint-  billing
  :3001      :3002          :3003     ment      :3005
                |                     :3004
                |                        |
             [Redis]              calls patient +
            (cache only)          doctor over HTTP
     |         |               |         |         |
     +---------+-------+-------+---------+---------+
                       |
                  MongoDB Atlas
              (shared "hms" database)
```

| Service | Port | Responsibility |
|---|---|---|
| `auth-service` | 3001 | Signup, OTP email verification, login, invites, JWT |
| `patient-service` | 3002 | Patient CRUD, plus a Redis cache-aside layer |
| `doctor-service` | 3003 | Doctor CRUD |
| `appointment-service` | 3004 | Appointment CRUD + inter-service calls |
| `billing-service` | 3005 | Bill generation and payment tracking |

**Stack:** Node.js, Express, MongoDB (Mongoose), Redis, Nginx, Docker Compose,
JWT, bcrypt, Nodemailer, Axios, and vanilla JavaScript on the frontend.

---

## Gateway routing

Nginx matches on the URL path prefix and forwards to the service that owns it:

| Browser sends | Nginx forwards to |
|---|---|
| `POST /auth/login` | `auth-service:3001/login` |
| `GET /patients/` | `patient-service:3002/patients/` |
| `GET /doctors/` | `doctor-service:3003/doctors/` |
| `GET /appointments/` | `appointment-service:3004/appointments/` |
| `GET /billing/` | `billing-service:3005/billing/` |
| anything else | `index.html`, and the client-side router takes over |

The frontend only ever knows one address and never learns a service's internal
port. Because nothing is cross-origin, there is no CORS to configure.

One subtlety worth knowing: the API locations end in a slash (`/patients/`)
while the client-side routes do not (`/patients`). Nginx automatically 301s a
proxied location's slashless form, which would hand the browser JSON instead of
the app, so each colliding route gets an exact-match `location =` block that
takes priority and serves `index.html` instead.

---

## Auth service endpoints

| Endpoint | Method | What it does |
|---|---|---|
| `/signup` | POST | Register and email an OTP |
| `/verify-signup` | POST | Confirm the OTP and activate the account |
| `/login` | POST | Password login, returns a JWT |
| `/request-otp` | POST | Email a code for passwordless login |
| `/verify-otp` | POST | Confirm the code, returns a JWT |
| `/invite` | POST | An admin invites a staff member by email |
| `/set-password` | POST | The invited user chooses their password |

---

## Running it

You need Docker Desktop and a MongoDB Atlas connection string.

```bash
# 1. Create your environment file
cp .env.example .env

# 2. Open .env and fill in:
#    - MONGO_URI (your Atlas connection string, ending in /hms)
#    - a long random JWT_SECRET:
#        node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
#    - SMTP details, or leave blank to have OTPs printed to the logs

# 3. Start everything
docker compose up --build
```

Open **http://localhost**.

Sign up, choose a role, and confirm the emailed code. If SMTP is not configured
the code appears in the logs instead:

```bash
docker compose logs -f auth-service
```

Useful commands:

```bash
docker compose ps                        # what is running
docker compose logs -f patient-service   # follow one service
docker compose down                      # stop everything
```

---

## Who can do what

Every row below matches an `authorize(...)` call on an actual route. The
frontend hides links to match, but the backend is the authority — anyone can
bypass the UI with Postman.

| | Admin | Doctor | Receptionist | Billing |
|---|:---:|:---:|:---:|:---:|
| View patients | yes | yes | yes | yes |
| Add / edit patients | yes | – | yes | – |
| Delete a patient | yes | – | – | – |
| View doctors | yes | yes | yes | yes |
| Manage the doctor directory | yes | – | – | – |
| View appointments | yes | yes | yes | – |
| Book an appointment | yes | – | yes | – |
| Write vitals, notes, prescriptions | yes | yes | – | – |
| View bills | yes | – | yes | yes |
| Create bills, mark paid | yes | – | – | yes |
| Delete anything | yes | – | – | – |

This is the same matrix the sidebar uses, so nobody is shown a link that
would return 403.

---

## Notable implementation details

**JWT is verified in every service, not just at the gateway.** Each data
service holds the shared secret and checks the signature itself — no network
hop, no shared session store. That is what makes the token stateless.

**Redis failure is survivable.** The patient service catches cache errors and
falls back to MongoDB, so reads still work, just slower. The cache is an
optimisation, not a correctness dependency. The `X-Cache` response header
reports `HIT`, `MISS` or `BYPASS` so you can see which path was taken.

**Inter-service calls forward the caller's token and time out.** When the
appointment service asks whether a patient exists, it passes the user's own JWT
— it has no elevated key of its own — and gives up after 3 seconds so a slow
neighbour cannot pile up requests here.

**Client-side routing is hand-written against the History API.** Clicks on
internal links are intercepted, `history.pushState` changes the URL, and the
matching view is rendered — no page reload, no round trip. `popstate` handles
the Back button, and Nginx returns `index.html` for unmatched paths so a
refresh or a pasted deep link still works.

**All user input is escaped before it reaches the DOM.** Patient names and
notes go through `esc()` in `frontend/js/ui.js`; otherwise one saved `<script>`
tag would run for every member of staff who opened the page.

**No secrets in the repository.** Everything sensitive is read from environment
variables, and each service exits at startup if a required one is missing.

---

## Known limitations

Worth being upfront about these:

- **Shared database.** All five services connect to the same `hms` database.
  Real microservices use database-per-service; this is a deliberate
  simplification, and the trade-off is tight schema coupling.
- **Synchronous inter-service calls.** Timeouts limit the damage, but a message
  broker (RabbitMQ, Kafka) would decouple the services properly.
- **No refresh tokens.** A signed JWT stays valid until it expires, so logging
  out only clears the browser.
- **OTPs are stored in plain text** on the user document. Hashing them at rest
  and rate-limiting attempts would be the next hardening step.
- **No automated tests and no CI pipeline.**
- **Observability is `console.log` plus `/health` endpoints.**
- **Docker Compose, not Kubernetes.** No auto-scaling, self-healing or rolling
  deploys.

---

## Layout

```
medicore-hms/
├── docker-compose.yml
├── .env.example
├── api-gateway/
│   ├── nginx.conf              path routing + static file serving
│   └── proxy_headers.conf
├── frontend/                   plain HTML, CSS and JavaScript
│   ├── index.html              the only HTML file -- the app shell
│   ├── css/style.css
│   └── js/
│       ├── router.js           client-side routing (History API)
│       ├── app.js              the route table
│       ├── auth.js             decodes the JWT
│       ├── api.js              fetch wrapper
│       ├── layout.js           app shell + role-aware navigation
│       ├── ui.js               escaping, modals, toasts, formatting
│       └── pages/
│           ├── login.js        password + OTP login
│           ├── signup.js       signup, then OTP verification
│           ├── setpassword.js  invited users set their password
│           ├── dashboard.js
│           ├── patients.js
│           ├── doctors.js
│           ├── appointments.js
│           └── billing.js
├── auth-service/
├── patient-service/
├── doctor-service/
├── appointment-service/
└── billing-service/
```

Each data service follows the same shape: `index.js` for routes, `models/` for
the Mongoose schema, `middleware/authMiddleware.js` for the JWT and role checks.
