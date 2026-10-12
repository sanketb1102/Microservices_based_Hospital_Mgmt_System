/* Signup -- account details, then OTP verification, in two steps. */

const SignupPage = {
  render(view) {
    view.innerHTML = `
      <div class="brand">
        <span class="brand-mark">MediCore</span>
        <span class="brand-tag">HMS</span>
      </div>

      <h1 id="heading">Create your account</h1>
      <p class="lede" id="lede">We will email you a code to confirm the address.</p>

      <div id="formNotice" class="notice hidden"></div>

      <form id="signupForm" novalidate>
        <div class="field-row">
          <div class="field">
            <label for="firstName">First name</label>
            <input id="firstName" type="text" autocomplete="given-name" required>
          </div>
          <div class="field">
            <label for="lastName">Last name</label>
            <input id="lastName" type="text" autocomplete="family-name">
          </div>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" required>
        </div>

        <div class="field">
          <label for="role">Role</label>
          <select id="role">
            <option value="receptionist">Receptionist</option>
            <option value="doctor">Doctor</option>
            <option value="billing">Billing Staff</option>
            <option value="admin">Administrator</option>
          </select>
          <p class="hint">Your role decides which sections you can open.</p>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="new-password" required>
        </div>

        <button type="submit" class="btn btn-block" id="signupBtn">Sign up</button>
      </form>

      <form id="verifyForm" class="hidden" novalidate>
        <div class="field">
          <label for="otp">Verification code</label>
          <input id="otp" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
                 style="font-family:var(--mono);font-size:20px;letter-spacing:.4em;text-align:center">
          <p class="hint">The code expires in 10 minutes and works once.</p>
        </div>
        <button type="submit" class="btn btn-block" id="verifyBtn">Verify email</button>
      </form>

      <p class="auth-alt">Already registered? <a href="/" data-link>Log in</a></p>`;

    const signupForm = document.getElementById('signupForm');
    const verifyForm = document.getElementById('verifyForm');

    let pendingEmail = sessionStorage.getItem('pendingEmail') || '';

    function showVerifyStep(message) {
      signupForm.classList.add('hidden');
      verifyForm.classList.remove('hidden');
      document.getElementById('heading').textContent = 'Verify your email';
      document.getElementById('lede').textContent = `We sent a 6-digit code to ${pendingEmail}.`;
      if (message) notice('formNotice', message, 'info');
      document.getElementById('otp').focus();
    }

    // Arriving from the login page with an unverified account jumps
    // straight to step 2.
    if (new URLSearchParams(window.location.search).has('verify') && pendingEmail) {
      showVerifyStep('Your email is not verified yet. Enter the code we sent you.');
    }

    /* --- step 1 -------------------------------------------------------- */
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      notice('formNotice', '');

      const payload = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName:  document.getElementById('lastName').value.trim(),
        email:     document.getElementById('email').value.trim(),
        role:      document.getElementById('role').value,
        password:  document.getElementById('password').value
      };

      const button = document.getElementById('signupBtn');

      if (!payload.firstName || !payload.email || !payload.password) {
        notice('formNotice', 'First name, email and password are required.');
        return;
      }

      busy(button, true, 'Creating...');

      try {
        await API.post('/auth/signup', payload);
        pendingEmail = payload.email;
        sessionStorage.setItem('pendingEmail', pendingEmail);
        showVerifyStep('');
      } catch (err) {
        notice('formNotice', err.message);
        busy(button, false);
      }
    });

    /* --- step 2 -------------------------------------------------------- */
    verifyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      notice('formNotice', '');

      const otp = document.getElementById('otp').value.trim();
      const button = document.getElementById('verifyBtn');

      if (!/^\d{6}$/.test(otp)) {
        notice('formNotice', 'Enter the 6-digit code from the email.');
        return;
      }

      busy(button, true, 'Verifying...');

      try {
        await API.post('/auth/verify-signup', { email: pendingEmail, otp });
        sessionStorage.removeItem('pendingEmail');
        notice('formNotice', 'Email verified. Taking you to log in...', 'success');
        setTimeout(() => Router.navigate('/', { replace: true }), 1200);
      } catch (err) {
        notice('formNotice', err.message);
        busy(button, false);
      }
    });
  }
};
