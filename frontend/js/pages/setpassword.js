/* Invited users land here from the emailed link, which carries ?token=... */

const SetPasswordPage = {
  render(view) {
    view.innerHTML = `
      <div class="brand">
        <span class="brand-mark">MediCore</span>
        <span class="brand-tag">HMS</span>
      </div>

      <h1>Set your password</h1>
      <p class="lede">You were invited to MediCore. Choose a password to finish.</p>

      <div id="formNotice" class="notice hidden"></div>

      <form id="setPasswordForm" novalidate>
        <div class="field">
          <label for="password">New password</label>
          <input id="password" type="password" autocomplete="new-password" required>
        </div>
        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" type="password" autocomplete="new-password" required>
        </div>
        <button type="submit" class="btn btn-block" id="submitBtn">Set password</button>
      </form>

      <p class="auth-alt"><a href="/" data-link>Back to log in</a></p>`;

    const inviteToken = new URLSearchParams(window.location.search).get('token');

    if (!inviteToken) {
      notice('formNotice', 'This link is missing its invite token. Ask your administrator to resend it.');
      document.getElementById('submitBtn').disabled = true;
    }

    document.getElementById('setPasswordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      notice('formNotice', '');

      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      const button = document.getElementById('submitBtn');

      if (!password) {
        notice('formNotice', 'Choose a password.');
        return;
      }
      if (password !== confirm) {
        notice('formNotice', 'The two passwords do not match.');
        return;
      }

      busy(button, true, 'Saving...');

      try {
        await API.post('/auth/set-password', { token: inviteToken, password });
        notice('formNotice', 'Password set. Taking you to log in...', 'success');
        setTimeout(() => Router.navigate('/', { replace: true }), 1200);
      } catch (err) {
        notice('formNotice', err.message);
        busy(button, false);
      }
    });
  }
};
