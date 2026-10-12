/* Login -- password login and passwordless OTP login. */

const LoginPage = {
  render(view) {
    view.innerHTML = `
      <div class="brand">
        <span class="brand-mark">MediCore</span>
        <span class="brand-tag">HMS</span>
      </div>

      <h1>Log in</h1>
      <p class="lede">Use your hospital staff account.</p>

      <div class="tabs" role="tablist">
        <button type="button" class="tab active" id="tabPassword" role="tab">Password</button>
        <button type="button" class="tab" id="tabOtp" role="tab">Email OTP</button>
      </div>

      <div id="formNotice" class="notice hidden"></div>

      <form id="passwordForm" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn-block" id="passwordBtn">Log in</button>
      </form>

      <form id="otpForm" class="hidden" novalidate>
        <div class="field">
          <label for="otpEmail">Email</label>
          <input id="otpEmail" type="email" autocomplete="username">
        </div>
        <div id="otpStep" class="hidden">
          <div class="field">
            <label for="otpCode">Verification code</label>
            <input id="otpCode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
                   style="font-family:var(--mono);font-size:20px;letter-spacing:.4em;text-align:center">
            <p class="hint">The code expires in 10 minutes.</p>
          </div>
        </div>
        <button type="submit" class="btn btn-block" id="otpBtn">Send me a code</button>
      </form>

      <p class="auth-alt">No account yet? <a href="/signup" data-link>Sign up</a></p>`;

    if (new URLSearchParams(window.location.search).has('expired')) {
      notice('formNotice', 'Your session ended. Log in again to continue.', 'info');
    }

    /* --- tab switching ------------------------------------------------ */
    const tabPassword = document.getElementById('tabPassword');
    const tabOtp = document.getElementById('tabOtp');
    const passwordForm = document.getElementById('passwordForm');
    const otpForm = document.getElementById('otpForm');

    tabPassword.addEventListener('click', () => {
      tabPassword.classList.add('active');
      tabOtp.classList.remove('active');
      passwordForm.classList.remove('hidden');
      otpForm.classList.add('hidden');
      notice('formNotice', '');
    });

    tabOtp.addEventListener('click', () => {
      tabOtp.classList.add('active');
      tabPassword.classList.remove('active');
      otpForm.classList.remove('hidden');
      passwordForm.classList.add('hidden');
      notice('formNotice', '');
    });

    /* --- password login ----------------------------------------------- */
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      notice('formNotice', '');

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const button = document.getElementById('passwordBtn');

      if (!email || !password) {
        notice('formNotice', 'Enter your email and password.');
        return;
      }

      busy(button, true, 'Logging in...');

      try {
        const result = await API.post('/auth/login', { email, password });
        localStorage.setItem('token', result.token);
        Router.navigate('/dashboard', { replace: true });
      } catch (err) {
        // 403 means the account exists but the email was never verified.
        if (err.status === 403) {
          sessionStorage.setItem('pendingEmail', email);
          Router.navigate('/signup?verify=1');
          return;
        }
        notice('formNotice', err.message);
        busy(button, false);
      }
    });

    /* --- OTP login, two steps in one form ------------------------------ */
    let otpSent = false;

    otpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      notice('formNotice', '');

      const email = document.getElementById('otpEmail').value.trim();
      const button = document.getElementById('otpBtn');

      if (!email) {
        notice('formNotice', 'Enter your email.');
        return;
      }

      // Step 1 -- ask the auth service to email a code.
      if (!otpSent) {
        busy(button, true, 'Sending...');
        try {
          await API.post('/auth/request-otp', { email });
          otpSent = true;
          document.getElementById('otpStep').classList.remove('hidden');
          notice('formNotice', 'Code sent. Check your email.', 'success');
          busy(button, false);
          button.textContent = 'Verify and log in';
          document.getElementById('otpCode').focus();
        } catch (err) {
          notice('formNotice', err.message);
          busy(button, false);
        }
        return;
      }

      // Step 2 -- exchange the code for a token.
      const otp = document.getElementById('otpCode').value.trim();
      if (!/^\d{6}$/.test(otp)) {
        notice('formNotice', 'Enter the 6-digit code from the email.');
        return;
      }

      busy(button, true, 'Verifying...');
      try {
        const result = await API.post('/auth/verify-otp', { email, otp });
        localStorage.setItem('token', result.token);
        Router.navigate('/dashboard', { replace: true });
      } catch (err) {
        notice('formNotice', err.message);
        busy(button, false);
      }
    });
  }
};
