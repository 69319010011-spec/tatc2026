function refreshLangUI() {
  document.getElementById('lang-th').classList.toggle('active', getLang() === 'th');
  document.getElementById('lang-en').classList.toggle('active', getLang() === 'en');
  applyI18n();
}
document.getElementById('lang-th').addEventListener('click', () => { setLang('th'); refreshLangUI(); });
document.getElementById('lang-en').addEventListener('click', () => { setLang('en'); refreshLangUI(); });
refreshLangUI();

if (localStorage.getItem('admin_token')) {
  window.location.href = 'dashboard.html';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error-text');
  errorEl.textContent = '';
  try {
    const data = await api.adminLogin(username, password);
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_info', JSON.stringify(data.admin));
    window.location.href = 'dashboard.html';
  } catch (err) {
    errorEl.textContent = t('login_failed');
  }
});
