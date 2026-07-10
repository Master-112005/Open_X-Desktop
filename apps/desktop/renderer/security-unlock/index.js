const appNameEl = document.getElementById('app-name');
const passwordEl = document.getElementById('password');
const formEl = document.getElementById('unlock-form');
const cancelBtn = document.getElementById('cancel-btn');
const statusEl = document.getElementById('status');

window.openx?.onSecurityUnlockContext?.(context => {
  appNameEl.textContent = context?.displayName || 'Locked app';
});

formEl.addEventListener('submit', async event => {
  event.preventDefault();
  statusEl.textContent = '';
  const password = passwordEl.value;
  if (!password) {
    statusEl.textContent = 'Enter the app password.';
    return;
  }
  const result = await window.openx.submitSecurityUnlock({ password });
  if (!result?.success) {
    statusEl.textContent = result?.error || 'Incorrect password.';
    passwordEl.select();
  }
});

cancelBtn.addEventListener('click', () => {
  window.openx?.cancelSecurityUnlock?.();
});
