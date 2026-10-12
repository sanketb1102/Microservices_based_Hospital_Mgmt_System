/* ==========================================================================
   app.js -- the route table, then start the router.

   Same routes the original React App.js declared, with the roles that may
   open each one. The roles here match the authorize(...) calls on the
   backend services.
   ========================================================================== */

const ALL_STAFF = ['admin', 'doctor', 'receptionist', 'billing'];

Router
  .add('/',              LoginPage,        { layout: 'auth' })
  .add('/signup',        SignupPage,       { layout: 'auth' })
  .add('/set-password',  SetPasswordPage,  { layout: 'auth' })

  .add('/dashboard',     DashboardPage,    { roles: ALL_STAFF })
  .add('/patients',      PatientsPage,     { roles: ALL_STAFF })
  .add('/doctors',       DoctorsPage,      { roles: ALL_STAFF })
  .add('/appointments',  AppointmentsPage, { roles: ['admin', 'doctor', 'receptionist'] })
  .add('/billing',       BillingPage,      { roles: ['admin', 'billing', 'receptionist'] });

Router.start();
