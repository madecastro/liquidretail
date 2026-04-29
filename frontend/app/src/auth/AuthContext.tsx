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

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; token: string };

type AuthContextValue = AuthState & {
  signIn:  () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOGIN_URL = '/login.html';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    // 1. Pick up an OAuth bounce token from the URL hash if present.
    consumeHashToken();

    // 2. Read whatever's in localStorage now (including anything just
    //    stashed from the hash) and decide auth state.
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
    signIn:  () => { window.location.assign(LOGIN_URL); },
    signOut: () => {
      clearAuth();
      window.location.assign(LOGIN_URL);
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
