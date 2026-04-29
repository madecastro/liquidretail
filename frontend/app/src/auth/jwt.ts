// Tiny JWT payload decoder. Doesn't verify the signature — the backend
// already does that on every request — we just want the user fields out
// of the locally-stored token for display.

export type JwtPayload = {
  id?:     string;
  userId?: string;
  email?:  string;
  name?:   string;
  photo?:  string | null;
  iat?:    number;
  exp?:    number;
};

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function jwtIsExpired(payload: JwtPayload): boolean {
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now();
}
