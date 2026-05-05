import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { decodeJwt, jwtIsExpired } from './jwt';
import { clearAuth } from './apiFetch';
import type { User } from './types';

// Reads the JWT from localStorage on mount and exposes a stable user
// shape. Also handles the OAuth bounce — if the page loaded with
// `#token=...` in the URL hash (Google callback redirected here),
// extract + persist + clean the URL before the rest of the app reads
// localStorage.
//
// IMPORTANT: hash consumption runs at module-LOAD time (the line
// below), not in AuthProvider's useEffect. Reason: <Navigate> from
// react-router-dom calls history.replace synchronously in its own
// effect, which runs BEFORE the parent AuthProvider's effect (React
// runs child effects first). The replace strips the hash, so by the
// time consumeHashToken would have run inside useEffect, the token
// is gone. Doing it at import time guarantees we beat all React
// effects to the URL.

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; token: string };

type AuthContextValue = AuthState & {
  signIn:  () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Initiate Google OAuth directly via the backend (proxied through
// Netlify's /auth/* rule). The `redirect` param tells the backend
// to bounce the post-auth #token=... payload back to OUR origin
// rather than the default FRONTEND_URL — needed during cohabitation
// where the new Chakra app and the legacy app live on different
// hostnames. Backend allowlist-validates the origin.
function buildLoginUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin
    ? `/auth/google?redirect=${encodeURIComponent(origin)}`
    : '/auth/google';
}
function buildLogoutLandingUrl(): string {
  // Keep the legacy /login.html for the post-logout screen. Netlify's
  // SPA fallback returns index.html which our AuthProvider then
  // re-renders as the unauthenticated gate. Same UX, no missing-page
  // 404 noise in the network tab.
  return '/';
}

// Consume the OAuth bounce hash NOW, before any component (including
// the Router's <Navigate> children) gets a chance to mutate the URL.
// Idempotent — runs once at import; subsequent calls are no-ops.
if (typeof window !== 'undefined') {
  consumeHashToken();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    // The hash was already consumed at module load. Just read the
    // resulting localStorage state and decide auth state.
    const token = localStorage.getItem('token');
    if (!token) {
      setState({ status: 'unauthenticated' });
      return;
    }
    const payload = decodeJwt(token);
    if (!payload || jwtIsExpired(payload)) {
      clearAuth();
      setState({ status: 'unauthenticated' });
      return;
    }
    setState({
      status: 'authenticated',
      token,
      user: {
        id:     payload.id     ?? '',
        userId: payload.userId ?? '',
        email:  payload.email  ?? '',
        name:   payload.name   ?? '',
        photo:  payload.photo  ?? null
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signIn:  () => { window.location.assign(buildLoginUrl()); },
    signOut: () => {
      clearAuth();
      window.location.assign(buildLogoutLandingUrl());
    }
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Read #token=...&user=...&email=... from the URL hash, persist into
// localStorage, then clean the hash so a refresh doesn't re-process.
function consumeHashToken() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#')) return;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('token');
  if (!token) return;
  localStorage.setItem('token', token);
  // The legacy auth.js also stashed name + email for the invitation
  // flow's email-bound check. Replicating here so /invite.html keeps
  // working when invoked from the SPA.
  const name = params.get('user');
  const email = params.get('email');
  if (name)  localStorage.setItem('user_name', name);
  if (email) localStorage.setItem('user_email', email);
  // Remove the hash so a refresh doesn't replay.
  window.history.replaceState({}, '', window.location.pathname + window.location.search);
}
