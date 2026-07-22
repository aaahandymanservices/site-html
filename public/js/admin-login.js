(function () {
  const form = document.getElementById('login-form');
  const button = document.getElementById('login-button');
  const errorBox = document.getElementById('login-error');
  const passwordForm = document.getElementById('password-form');
  const passwordButton = document.getElementById('password-button');
  const passwordErrorBox = document.getElementById('password-error');

  const callbackParams = new URLSearchParams(window.location.hash.slice(1));
  const inviteToken = callbackParams.get('invite_token');
  const recoveryToken = callbackParams.get('recovery_token');
  const passwordFlow = inviteToken ? 'invite' : recoveryToken ? 'recovery' : null;
  const passwordToken = inviteToken || recoveryToken;

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  if (passwordFlow) {
    form.hidden = true;
    passwordForm.hidden = false;
    if (passwordFlow === 'recovery') {
      document.getElementById('password-heading').textContent = 'Reset your password';
      document.getElementById('password-description').textContent = 'Choose a new password for your administrator account.';
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } else {
    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then((response) => {
        if (response.ok) window.location.replace('/admin/customers');
      })
      .catch(() => {});
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    button.disabled = true;
    button.textContent = 'Signing in…';

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      window.location.href = '/admin/customers';
    } catch (error) {
      showError(error.message || 'Unable to sign in.');
      button.disabled = false;
      button.textContent = 'Sign in to dashboard';
    }
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordErrorBox.hidden = true;

    const password = document.getElementById('new-password').value;
    const confirmation = document.getElementById('confirm-password').value;

    if (password !== confirmation) {
      passwordErrorBox.textContent = 'The passwords do not match.';
      passwordErrorBox.hidden = false;
      return;
    }

    passwordButton.disabled = true;
    passwordButton.textContent = 'Saving password…';

    try {
      const response = await fetch('/api/admin/session', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: passwordFlow,
          token: passwordToken,
          password,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to set your password.');
      window.location.replace('/admin/customers');
    } catch (error) {
      passwordErrorBox.textContent = error.message || 'Unable to set your password.';
      passwordErrorBox.hidden = false;
      passwordButton.disabled = false;
      passwordButton.textContent = 'Set password and continue';
    }
  });
})();
