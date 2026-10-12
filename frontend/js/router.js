/* ==========================================================================
   router.js -- client-side routing.

   The same job React Router does, written by hand against the browser's
   History API.

   Server-side routing (the traditional model): every click sends a request,
   the server returns a whole new HTML page, and the browser reloads.

   Client-side routing (this): the app is loaded once. After that a click on
   an internal link is intercepted, the URL is changed with
   history.pushState, and the matching view is rendered into the page. No
   reload, no round trip -- only the data fetches go out.

   Two things this has to get right that a full reload gives you for free:
     - The Back button. window.onpopstate fires when the user goes back or
       forward, and the router re-renders for the new URL.
     - Deep links. Someone pasting /patients hits the server directly, so
       Nginx is configured to return index.html for any unmatched path and
       let the router take it from there.
   ========================================================================== */

const Router = {
  routes: [],
  current: null,

  /**
   * options:
   *   layout : 'auth' for the centred card screens, 'app' for the sidebar shell
   *   roles  : which roles may open it (omit for public pages)
   */
  add(path, page, options = {}) {
    this.routes.push({ path, page, layout: options.layout || 'app', roles: options.roles || null });
    return this;
  },

  start() {
    // One listener on the document handles every internal link, including
    // links that do not exist yet -- event delegation, so newly rendered
    // markup needs no extra wiring.
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-link]');
      if (!link) return;

      // Let modified clicks (new tab, new window) behave normally.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      this.navigate(link.getAttribute('href'));
    });

    // Back and forward buttons.
    window.addEventListener('popstate', () => this.render());

    this.render();
  },

  navigate(path, { replace = false } = {}) {
    if (path === window.location.pathname + window.location.search) return;

    if (replace) {
      history.replaceState({}, '', path);
    } else {
      history.pushState({}, '', path);
    }
    this.render();
  },

  async render() {
    const path = window.location.pathname;
    const route = this.routes.find((r) => r.path === path);

    if (!route) return this.renderNotFound();

    const user = getUserFromToken();

    /* ---- route guards ------------------------------------------------
       These run before the view does. They are convenience, not security:
       every API call is authorised again on the server, so a user who
       edits their way past a guard still gets a 401 or 403 from the
       service.
       ------------------------------------------------------------------ */

    // A protected page with no valid token -> back to login.
    if (route.roles && !user) {
      return this.navigate('/', { replace: true });
    }

    // A role that is not allowed here -> back to the dashboard.
    if (route.roles && !route.roles.includes(user.role)) {
      return this.navigate('/dashboard', { replace: true });
    }

    // Already logged in, sitting on the login screen -> straight to work.
    if (!route.roles && user && path === '/') {
      return this.navigate('/dashboard', { replace: true });
    }

    const app = document.getElementById('app');
    let container;

    if (route.layout === 'auth') {
      app.innerHTML = '<main class="auth-screen"><div class="auth-card" id="view"></div></main>';
      container = document.getElementById('view');
      this.current = null;   // the app shell will need rebuilding next time
    } else {
      // Rebuilding the sidebar on every navigation would make it flicker,
      // so it is only drawn when arriving from outside the shell.
      if (this.current === null) {
        buildShell(user);
      }
      setActiveNav(path);
      setHeadActions('');
      setPageHeading(route.page.title, route.page.subtitle);
      container = document.getElementById('view');
      this.current = path;
    }

    container.innerHTML = '<div class="empty">Loading...</div>';

    try {
      await route.page.render(container, user);
    } catch (err) {
      container.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }

    window.scrollTo(0, 0);
  },

  renderNotFound() {
    document.getElementById('app').innerHTML = `
      <main class="auth-screen">
        <div class="auth-card">
          <div class="brand">
            <span class="brand-mark">MediCore</span>
            <span class="brand-tag">HMS</span>
          </div>
          <h1>Page not found</h1>
          <p class="lede">There is nothing at <code>${esc(window.location.pathname)}</code>.</p>
          <a class="btn btn-block" href="/dashboard" data-link>Go to the dashboard</a>
        </div>
      </main>`;
    this.current = null;
  }
};
