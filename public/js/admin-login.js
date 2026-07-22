(function () {
  const form = document.getElementById('login-form');
  const button = document.getElementById('login-button');
  const errorBox = document.getElementById('login-error');

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  fetch('/api/admin/session', { credentials: 'same-origin' })
    .then((response) => {
      if (response.ok) window.location.replace('/admin/customers');
    })
    .catch(() => {});

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
})();
