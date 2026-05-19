// Team page — manage members + invitations for the active Advertiser
// (workspace). V1 ships copy-invite-link (operator pastes into their
// own email/Slack); SendGrid integration is a follow-on commit.
//
// Memberships are workspace-scoped, not brand-scoped — every member
// has access to every brand under the active workspace. The page
// header copy makes that explicit so operators don't expect per-brand
// gating from this surface.
//
// Role gating: viewers + editors see a read-only member list; only
// owners + admins see invite/role-edit/revoke controls. Backend
// enforces independently so a tampered UI still can't escalate.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardBody, VStack, HStack, Heading, Text, Button, Badge,
  Input, Select, useToast, IconButton, Tooltip, Avatar,
  SimpleGrid, Divider, Spinner
} from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';
const ROLES: Role[] = ['owner', 'admin', 'editor', 'viewer'];

type Member = {
  membershipId: string;
  userId:       string;
  email:        string;
  name:         string;
  photoUrl:     string | null;
  role:         Role;
  acceptedAt:   string | null;
  lastLoginAt:  string | null;
  isYou:        boolean;
};
type PendingInvitation = {
  id:        string;
  email:     string;
  role:      Role;
  status:    string;
  token:     string;
  invitedAt: string;
  invitedBy: string | null;
};

export function TeamPage() {
  const toast = useToast();
  const { memberships, activeAdvertiserId, loading: brandLoading } = useBrand();
  const auth = useAuth();

  // Resolve the operator's role on the active workspace. Three sources
  // checked in order of trust:
  //   1. exact match by advertiserId — the precise membership row
  //   2. single-workspace fallback — when activeAdvertiserId hasn't
  //      hydrated yet but the user has exactly one membership, pick
  //      it (covers the just-signed-in / localStorage-empty edge case
  //      that triggers a transient "signed in as unknown" banner)
  //   3. JWT role from /api/me — present on auth.user.role when the
  //      auth-resolved active workspace was set server-side
  const activeMembership = useMemo(() => {
    if (!memberships?.length) return null;
    const byAdvertiser = activeAdvertiserId
      ? memberships.find(m => String(m.advertiserId) === String(activeAdvertiserId))
      : null;
    if (byAdvertiser) return byAdvertiser;
    if (memberships.length === 1) return memberships[0];
    return null;
  }, [memberships, activeAdvertiserId]);

  // Resolution still in flight when BrandContext is hydrating (initial
  // page load before /api/me lands). Treat that as a non-final state
  // so the "unknown role" banner doesn't flash misleadingly.
  const resolutionInFlight = brandLoading || (memberships?.length === 0 && auth.status === 'authenticated');

  // Fall back to the JWT-encoded role when no membership row matched —
  // /api/me populates auth.user.role with the user's role on whichever
  // workspace requireAuth resolved as active. Covers single-workspace
  // users whose hydration race hasn't completed yet.
  const jwtRole = (auth.status === 'authenticated' ? auth.user.role : null) as
    'owner' | 'admin' | 'editor' | 'viewer' | undefined | null;
  const resolvedRole = activeMembership?.role || jwtRole || null;

  // UI write-gate: backend gates independently; this is just to keep
  // controls out of operators' faces when they have no business
  // touching them.
  const canManage = resolvedRole === 'owner' || resolvedRole === 'admin';

  const [members, setMembers]         = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Invite form state — never auto-clears on success since the
  // operator typically invites multiple folks in sequence and a
  // half-typed email lost to a misclick is worse than a stale form.
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState<Role>('editor');
  const [submitting, setSubmitting]   = useState(false);

  const refresh = useCallback(async () => {
    if (auth.status !== 'authenticated') return;
    setLoading(true);
    setError(null);
    try {
      const [m, i] = await Promise.all([
        apiJson<{ members: Member[] }>('/api/members'),
        apiJson<{ invitations: PendingInvitation[] }>('/api/invitations')
      ]);
      setMembers(m.members || []);
      setInvitations(i.invitations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [auth.status]);

  useEffect(() => { void refresh(); }, [refresh]);

  function inviteUrlFor(token: string): string {
    // Legacy /invite.html handles the accept flow today. When we ship
    // the SPA-native accept page (separate ticket) this becomes
    // /invite/${token} on the same origin.
    return `${window.location.origin}/invite.html?token=${encodeURIComponent(token)}`;
  }

  async function copyToClipboard(text: string, what = 'link') {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied`, status: 'success', duration: 2000 });
    } catch (e) {
      toast({
        title:       'Copy failed',
        description: e instanceof Error ? e.message : 'Clipboard unavailable — copy the URL manually',
        status:      'warning',
        duration:    4000
      });
    }
  }

  async function submitInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast({ title: 'Enter a valid email', status: 'warning', duration: 2500 });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiJson<{ invitation: PendingInvitation }>('/api/invitations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, role: inviteRole })
      });
      const url = inviteUrlFor(res.invitation.token);
      await copyToClipboard(url, 'Invite link');
      toast({
        title:       'Invitation created',
        description: `Link copied to clipboard — paste into your email or Slack to ${email}.`,
        status:      'success',
        duration:    4500
      });
      setInviteEmail('');
      void refresh();
    } catch (e) {
      toast({
        title:       'Could not create invitation',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(userId: string, role: Role) {
    try {
      await apiJson(`/api/members/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role })
      });
      toast({ title: 'Role updated', status: 'success', duration: 2000 });
      void refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title:       'Role update failed',
        description: msg,    // backend returns "cannot demote the only owner" verbatim
        status:      'error',
        duration:    5500
      });
    }
  }

  async function revokeMember(userId: string, email: string) {
    if (!window.confirm(`Revoke ${email}'s access? They'll lose access immediately.`)) return;
    try {
      await apiJson(`/api/members/${userId}`, { method: 'DELETE' });
      toast({ title: `${email} revoked`, status: 'success', duration: 2500 });
      void refresh();
    } catch (e) {
      toast({
        title:       'Revoke failed',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5500
      });
    }
  }

  async function revokeInvitation(id: string, email: string) {
    if (!window.confirm(`Cancel the pending invitation to ${email}?`)) return;
    try {
      await apiJson(`/api/invitations/${id}`, { method: 'DELETE' });
      toast({ title: 'Invitation revoked', status: 'success', duration: 2000 });
      void refresh();
    } catch (e) {
      toast({
        title:       'Revoke failed',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    }
  }

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Workspace"
        title="Team"
        description="Manage who has access to this workspace. Members can see every brand under the workspace; per-brand restrictions land later."
      />

      {!canManage && !resolutionInFlight && (
        <Card variant="outline" bg="orange.50" borderColor="orange.200">
          <CardBody py={3}>
            <Text fontSize="sm" color="brand.ink">
              You're signed in as <Badge variant="subtle">{resolvedRole || 'unknown'}</Badge> on this workspace. Only owners and admins can invite, change roles, or revoke access.
            </Text>
          </CardBody>
        </Card>
      )}

      {canManage && (
        <Card variant="outline">
          <CardBody>
            <Heading size="sm" color="brand.ink" mb={3}>Invite a teammate</Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} alignItems="end">
              <Box>
                <Text fontSize="9px" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={1}>Email</Text>
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  size="sm"
                  isDisabled={submitting}
                />
              </Box>
              <Box>
                <Text fontSize="9px" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={1}>Role</Text>
                <Select
                  size="sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  isDisabled={submitting}
                >
                  <option value="admin">Admin — full workspace control except billing/deletion</option>
                  <option value="editor">Editor — create campaigns, ads, edit brand</option>
                  <option value="viewer">Viewer — read-only</option>
                </Select>
              </Box>
              <Button
                variant="brand"
                size="sm"
                onClick={submitInvite}
                isLoading={submitting}
                loadingText="Creating…"
                isDisabled={!inviteEmail.trim()}
              >
                Create invite link
              </Button>
            </SimpleGrid>
            <Text fontSize="11px" color="brand.muted" mt={3}>
              We'll generate a one-time link and copy it to your clipboard. Paste it into your email/Slack — once the invitee signs in via Google with this email, they'll join the workspace.
            </Text>
          </CardBody>
        </Card>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card variant="outline">
          <CardBody>
            <HStack mb={3} justify="space-between">
              <Heading size="sm" color="brand.ink">Pending invitations ({invitations.length})</Heading>
            </HStack>
            <VStack align="stretch" spacing={2} divider={<Divider />}>
              {invitations.map(inv => (
                <HStack key={inv.id} justify="space-between" align="center" py={1}>
                  <Box flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{inv.email}</Text>
                    <HStack spacing={2} mt={0.5}>
                      <Badge variant="outline" fontSize="9px">{inv.role}</Badge>
                      <Text fontSize="11px" color="brand.muted">
                        invited {new Date(inv.invitedAt).toLocaleDateString()}
                      </Text>
                    </HStack>
                  </Box>
                  <HStack spacing={2}>
                    <Tooltip label="Copy invite link" hasArrow>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => copyToClipboard(inviteUrlFor(inv.token), 'Invite link')}
                      >
                        Copy link
                      </Button>
                    </Tooltip>
                    {canManage && (
                      <Tooltip label="Cancel this invitation" hasArrow>
                        <IconButton
                          aria-label="Revoke invitation"
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => revokeInvitation(inv.id, inv.email)}
                          icon={<Text fontSize="11px">✕</Text>}
                        />
                      </Tooltip>
                    )}
                  </HStack>
                </HStack>
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Active members */}
      <Card variant="outline">
        <CardBody>
          <HStack mb={3} justify="space-between">
            <Heading size="sm" color="brand.ink">Active members ({members.length})</Heading>
          </HStack>
          {loading ? (
            <HStack py={4} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading…</Text></HStack>
          ) : error ? (
            <Text color="red.600" fontSize="sm">{error}</Text>
          ) : members.length === 0 ? (
            <Text fontSize="sm" color="brand.muted" py={2}>No active members yet.</Text>
          ) : (
            <VStack align="stretch" spacing={2} divider={<Divider />}>
              {members.map(m => (
                <HStack key={m.membershipId} justify="space-between" align="center" py={1}>
                  <HStack spacing={3} flex={1} minW={0}>
                    <Avatar size="sm" name={m.name} src={m.photoUrl || undefined} />
                    <Box minW={0}>
                      <HStack spacing={2} wrap="wrap">
                        <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{m.name}</Text>
                        {m.isYou && <Badge colorScheme="purple" variant="subtle" fontSize="9px">You</Badge>}
                      </HStack>
                      <Text fontSize="11px" color="brand.muted" noOfLines={1}>{m.email}</Text>
                    </Box>
                  </HStack>
                  <HStack spacing={2}>
                    {canManage && !m.isYou ? (
                      <Select
                        size="xs"
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value as Role)}
                        width="110px"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    ) : (
                      <Badge variant="solid" colorScheme={m.role === 'owner' ? 'purple' : 'gray'} fontSize="9px">
                        {m.role}
                      </Badge>
                    )}
                    {canManage && !m.isYou && (
                      <Tooltip label="Revoke access" hasArrow>
                        <IconButton
                          aria-label="Revoke member"
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => revokeMember(m.userId, m.email)}
                          icon={<Text fontSize="11px">✕</Text>}
                        />
                      </Tooltip>
                    )}
                  </HStack>
                </HStack>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
}

export default TeamPage;
