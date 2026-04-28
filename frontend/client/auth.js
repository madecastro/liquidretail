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

  // Page guards.
  const path = window.location.pathname;
  const isLoginPage      = path.endsWith('login.html');
  const isOnboardingPage = path.endsWith('onboarding.html');
  if (!isLoginPage && !localStorage.getItem('auth_token')) {
    window.location.href = '/login.html';
    return;
  }

  // Patch fetch to auto-inject Authorization + X-Brand-Id headers and
  // handle 401 (sign-out) + 403 NO_ADVERTISER (route to onboarding).
  // The active brand id is whatever brandPicker / ad-generation code
  // wrote to localStorage.brand_id. Empty string when no brand
  // selected — backend treats absence and empty the same.
  const _fetch = window.fetch;
  window.fetch = function (url, opts = {}) {
    const t = localStorage.getItem('auth_token');
    const brandId = localStorage.getItem('brand_id') || '';
    const headers = Object.assign({}, opts.headers || {});
    if (t)       headers.Authorization = 'Bearer ' + t;
    if (brandId) headers['X-Brand-Id'] = brandId;
    opts.headers = headers;
    return _fetch(url, opts).then(async function (res) {
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('brand_id');
        window.location.href = '/login.html';
        return res;
      }
      if (res.status === 403 && !isOnboardingPage) {
        // Inspect body to detect the NO_ADVERTISER signal — other 403s
        // (per-resource permission denials) shouldn't trigger onboarding.
        try {
          const cloned = res.clone();
          const body = await cloned.json();
          if (body && body.code === 'NO_ADVERTISER') {
            window.location.href = '/onboarding.html';
            return res;
          }
        } catch (_) { /* not JSON, fall through */ }
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
