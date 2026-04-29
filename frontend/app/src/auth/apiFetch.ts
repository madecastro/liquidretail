// Authenticated fetch wrapper. Mirrors what the legacy auth.js does
// for vanilla pages, but as an explicit function instead of a global
// window.fetch monkey-patch — easier to reason about and to test.
//
// Headers injected:
//   Authorization: Bearer <jwt>           ← localStorage.token
//   X-Brand-Id:    <brandId>              ← localStorage.brand_id (if set)
//   X-Advertiser-Id: <advertiserId>       ← localStorage.advertiser_id (if set)
//
// Status handling:
//   401              → clear token + redirect to login
//   403 NO_ADVERTISER → redirect to /onboarding.html
//   403 ADVERTISER_FORBIDDEN → clear advertiser_id + reload
//   anything else    → return the response untouched
//
// Caller deals with non-2xx outcomes the same way the legacy code did.

const LOGIN_URL = '/login.html';
const ONBOARDING_URL = '/onboarding.html';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const brandId = localStorage.getItem('brand_id');
  if (brandId) headers['X-Brand-Id'] = brandId;
  const advertiserId = localStorage.getItem('advertiser_id');
  if (advertiserId) headers['X-Advertiser-Id'] = advertiserId;
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(authHeaders())) headers.set(k, v);
  const res = await fetch(input, { ...init, headers });
  await maybeHandleAuthFailure(res);
  return res;
}

// On 401 / specific 403 codes, mutate auth state + navigate. Returns
// nothing — the caller still receives the Response object so it can
// log/measure if it wants. The navigation always wins because we
// replace location after.
async function maybeHandleAuthFailure(res: Response): Promise<void> {
  if (res.status === 401) {
    clearAuth();
    window.location.replace(LOGIN_URL);
    return;
  }
  if (res.status === 403) {
    // We need to peek at the error code without consuming the body —
    // clone first so callers can still read the body.
    let code: string | null = null;
    try {
      const cloned = res.clone();
      const body = await cloned.json();
      code = body?.code || body?.error || null;
    } catch { /* not JSON, ignore */ }

    if (code === 'NO_ADVERTISER') {
      window.location.replace(ONBOARDING_URL);
      return;
    }
    if (code === 'ADVERTISER_FORBIDDEN') {
      localStorage.removeItem('advertiser_id');
      window.location.reload();
      return;
    }
  }
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('brand_id');
  localStorage.removeItem('brand_name');
  localStorage.removeItem('advertiser_id');
}

// Convenience wrapper — calls apiFetch + asserts JSON. Throws on
// non-2xx with the server's error message when present.
export async function apiJson<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { /* keep null */ }
  if (!res.ok) {
    const msg = (data as { error?: string; message?: string } | null)?.error
             || (data as { error?: string; message?: string } | null)?.message
             || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
