/* ==========================================================================
   layout.js -- the application shell and the role-aware navigation.

   This is the same filter the original React Dashboard used. It mirrors the
   authorize(...) calls on the backend routes -- the backend is what actually
   enforces access; this only keeps the menu honest, so nobody is shown a
   link that would come back 403.
   ========================================================================== */

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard' },
  { to: '/patients',     label: 'Patients' },
  { to: '/doctors',      label: 'Doctors' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/billing',      label: 'Billing' }
];

const ROLE_LABEL = {
  admin: 'Administrator',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  billing: 'Billing Staff'
};

function allowedNavItems(user) {
  return NAV_ITEMS.filter((item) => {
    if (user.role === 'admin') return true;              // admin sees everything
    if (user.role === 'doctor')
      return ['/dashboard', '/patients', '/appointments'].includes(item.to);
    if (user.role === 'receptionist')
      return ['/dashboard', '/patients', '/doctors', '/appointments', '/billing'].includes(item.to);
    if (user.role === 'billing')
      return ['/dashboard', '/patients', '/billing'].includes(item.to);
    return false;
  });
}

/** Draws the sidebar and the page frame once, on entering the app. */
function buildShell(user) {
  const nav = allowedNavItems(user)
    // data-link is what tells the router to intercept the click instead of
    // letting the browser do a full page load.
    .map((item) => `<a href="${item.to}" data-link>${item.label}</a>`)
    .join('');

  document.getElementById('app').innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">MediCore</span>
          <span class="brand-tag">HMS</span>
        </div>

        <nav class="nav" id="nav" aria-label="Sections">${nav}</nav>

        <div class="who">
          <div class="who-name">${esc(user.fullName)}</div>
          <div class="who-role">${esc(ROLE_LABEL[user.role] || user.role)}</div>
          <button type="button" class="link-button" id="signOut">Log out</button>
        </div>
      </aside>

      <main class="main">
        <header class="page-head">
          <div>
            <h1 id="pageTitle"></h1>
            <p id="pageSubtitle"></p>
          </div>
          <div id="headActions"></div>
        </header>

        <div id="view"></div>
      </main>
    </div>`;

  document.getElementById('signOut').addEventListener('click', logout);
}

/** Highlights the current section without redrawing the sidebar. */
function setActiveNav(path) {
  document.querySelectorAll('#nav a').forEach((link) => {
    const active = link.getAttribute('href') === path;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function setPageHeading(title, subtitle) {
  document.getElementById('pageTitle').textContent = title || '';
  document.getElementById('pageSubtitle').textContent = subtitle || '';
  document.title = title ? `${title} - MediCore` : 'MediCore HMS';
}

function setHeadActions(html) {
  const el = document.getElementById('headActions');
  if (el) el.innerHTML = html || '';
}

/** Convenience check used to show or hide buttons. */
function can(user, ...roles) {
  return roles.includes(user.role);
}
