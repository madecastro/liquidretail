(function () {
  // Extract token + user info from OAuth redirect hash.
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('token');
  if (token) {
    localStorage.setItem('auth_token', token);
    const userName  = hash.get('user');
    const userEmail = hash.get('email');
    if (userName)  localStorage.setItem('auth_user',  decodeURIComponent(userName));
    if (userEmail) localStorage.setItem('auth_email', decodeURIComponent(userEmail));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    // Resume an in-flight invite acceptance if the user logged in
    // via the invite page. The token was stashed in localStorage
    // before the OAuth round-trip; if it's still there, route to
    // /invite.html so the user can accept.
    const pendingInvite = localStorage.getItem('pending_invite_token');
    if (pendingInvite && !window.location.pathname.endsWith('invite.html')) {
      window.location.href = `/invite.html?token=${encodeURIComponent(pendingInvite)}`;
      return;
    }
  }

  // Page guards.
  const path = window.location.pathname;
  const isLoginPage      = path.endsWith('login.html');
  const isOnboardingPage = path.endsWith('onboarding.html');
  const isInvitePage     = path.endsWith('invite.html');
  if (!isLoginPage && !isInvitePage && !localStorage.getItem('auth_token')) {
    window.location.href = '/login.html';
    return;
  }

  // Patch fetch to auto-inject Authorization, X-Brand-Id, and
  // X-Advertiser-Id headers, and to handle 401 / 403 NO_ADVERTISER.
  //   - X-Brand-Id        ← localStorage.brand_id      (brand picker)
  //   - X-Advertiser-Id   ← localStorage.advertiser_id (workspace switcher)
  //   Both are optional; backend treats absence + empty the same.
  const _fetch = window.fetch;
  window.fetch = function (url, opts = {}) {
    const t = localStorage.getItem('auth_token');
    const brandId      = localStorage.getItem('brand_id') || '';
    const advertiserId = localStorage.getItem('advertiser_id') || '';
    const headers = Object.assign({}, opts.headers || {});
    if (t)            headers.Authorization     = 'Bearer ' + t;
    if (brandId)      headers['X-Brand-Id']     = brandId;
    if (advertiserId) headers['X-Advertiser-Id'] = advertiserId;
    opts.headers = headers;
    return _fetch(url, opts).then(async function (res) {
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_email');
        localStorage.removeItem('brand_id');
        localStorage.removeItem('advertiser_id');
        window.location.href = '/login.html';
        return res;
      }
      if (res.status === 403 && !isOnboardingPage && !isInvitePage) {
        // Inspect body to detect the NO_ADVERTISER signal — other 403s
        // (per-resource permission denials) shouldn't trigger onboarding.
        try {
          const cloned = res.clone();
          const body = await cloned.json();
          if (body && body.code === 'NO_ADVERTISER') {
            window.location.href = '/onboarding.html';
            return res;
          }
          if (body && body.code === 'ADVERTISER_FORBIDDEN') {
            // Active workspace stale (user removed from advertiser).
            // Clear and reload so the workspace switcher resolves a
            // valid one or routes to onboarding.
            localStorage.removeItem('advertiser_id');
            window.location.reload();
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
  localStorage.removeItem('auth_email');
  localStorage.removeItem('brand_id');
  localStorage.removeItem('brand_name');
  localStorage.removeItem('advertiser_id');
  window.location.href = '/login.html';
}
