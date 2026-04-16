(function () {
  // Extract token from OAuth redirect hash
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('token');
  if (token) {
    localStorage.setItem('auth_token', token);
    const userName = hash.get('user');
    if (userName) localStorage.setItem('auth_user', decodeURIComponent(userName));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // Guard all pages except login
  const isLoginPage = window.location.pathname.endsWith('login.html');
  if (!isLoginPage && !localStorage.getItem('auth_token')) {
    window.location.href = '/login.html';
    return;
  }

  // Patch fetch to auto-inject Authorization header and handle 401s
  const _fetch = window.fetch;
  window.fetch = function (url, opts = {}) {
    const t = localStorage.getItem('auth_token');
    if (t) {
      opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + t });
    }
    return _fetch(url, opts).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login.html';
      }
      return res;
    });
  };
})();

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  window.location.href = '/login.html';
}
