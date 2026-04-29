// Shapes for auth + tenancy. Mirrors what the backend returns from
// JWT decode and /api/me. Kept narrow — only fields the SPA actually
// uses are typed; richer responses pass through as Mixed.

export type User = {
  id:           string;       // Google profile id (legacy)
  userId:       string;       // persisted User._id
  email:        string;
  name:         string;
  photo?:       string | null;
};

export type Membership = {
  id:           string;
  advertiserId: string;
  advertiserName?: string;
  role:         'owner' | 'admin' | 'editor' | 'viewer';
  status:       'pending' | 'active' | 'revoked';
};

export type MeResponse = {
  user:           User;
  advertiserId:   string | null;
  memberships:    Membership[];
  activeAdvertiser?: { id: string; name: string };
};
