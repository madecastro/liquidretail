// /invite/:token — SPA-native invitation accept page.
//
// Replaces the legacy /invite.html (which lived on a different Netlify
// site and had localStorage-key mismatches with the new SPA). Mounted
// as a public route — no PipelineShell, no RequireAuth — so anonymous
// invitees can preview before signing in.
//
// Flow:
//   1. Unauth'd  → preview + "Sign in with Google" CTA. Click stashes
//      the invite token in localStorage and starts OAuth.
//   2. AuthContext (after the OAuth bounce) detects the pending token
//      and hard-navigates back here.
//   3. Authed (matching email)  → preview + Accept button. Accept POST
//      flips membership active, then we hard-nav to /home so
//      BrandContext re-hydrates under the new advertiser_id.
//   4. Authed (mismatching email) → mismatch banner + "Use a different
//      account" — preserves pending_invite_token across the re-auth.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Card, CardBody, VStack, HStack, Heading, Text, Button, Badge, Spinner
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';
type InvitePreview = {
  email:          string;
  role:           Role;
  invitedAt:      string;
  invitedByName:  string | null;
  advertiser:     { id: string; name: string; slug: string | null };
};

const ROLE_COLOR: Record<Role, string> = {
  owner:  'red',
  admin:  'purple',
  editor: 'blue',
  viewer: 'gray'
};

export function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const auth = useAuth();

  const [preview,   setPreview]   = useState<InvitePreview | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadErr,   setLoadErr]   = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptErr, setAcceptErr] = useState<string | null>(null);

  // Preview load — public endpoint, token IS the auth.
  useEffect(() => {
    if (!token) { setLoading(false); setLoadErr('Missing invitation token'); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<{ invitation: InvitePreview }>(
          `/api/invitations/by-token/${encodeURIComponent(token)}`
        );
        if (!cancelled) setPreview(data.invitation);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const signInForInvite = useCallback(() => {
    // Persist so AuthContext can bounce back to /invite/:token after
    // the OAuth round-trip lands on the SPA root with #token=...
    localStorage.setItem('pending_invite_token', token);
    auth.signIn();
  }, [token, auth]);

  const useDifferentAccount = useCallback(() => {
    // Keep the pending invite around so we resume the accept flow
    // after the next OAuth round-trip.
    localStorage.setItem('pending_invite_token', token);
    localStorage.removeItem('token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('advertiser_id');
    localStorage.removeItem('brand_id');
    localStorage.removeItem('brand_name');
    auth.signIn();
  }, [token, auth]);

  const accept = useCallback(async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptErr(null);
    try {
      const data = await apiJson<{ advertiserId: string; role: Role }>(
        `/api/invitations/by-token/${encodeURIComponent(token)}/accept`,
        { method: 'POST' }
      );
      // Switch workspace context. Clear active brand so BrandContext
      // picks the new advertiser's first brand on the next load.
      localStorage.setItem('advertiser_id', data.advertiserId);
      localStorage.removeItem('brand_id');
      localStorage.removeItem('brand_name');
      localStorage.removeItem('pending_invite_token');
      // Hard nav so BrandContext re-hydrates cleanly. Soft nav would
      // keep stale brands cached until a manual refresh.
      window.location.replace('/home');
    } catch (e) {
      setAcceptErr(e instanceof Error ? e.message : String(e));
      setAccepting(false);
    }
  }, [token]);

  const currentEmail = auth.status === 'authenticated' ? auth.user.email : null;
  const emailMismatch =
    currentEmail && preview
      ? currentEmail.toLowerCase() !== preview.email.toLowerCase()
      : false;

  return (
    <Box minH="100vh" bg="brand.canvas" py={20} px={4}>
      <Box maxW="560px" mx="auto">
        <Card>
          <CardBody p={8}>
            <VStack align="stretch" spacing={5}>
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
                  Team invitation
                </Text>

                {loading && (
                  <HStack spacing={3} py={2}>
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="brand.muted">Loading invitation…</Text>
                  </HStack>
                )}

                {loadErr && (
                  <>
                    <Heading size="md" color="brand.ink" mb={2}>Couldn't load invitation</Heading>
                    <Text color="red.600" fontSize="sm">{loadErr}</Text>
                    <Text fontSize="xs" color="brand.muted" mt={3}>
                      If the invite was already accepted or revoked, ask the inviter to send a new one.
                    </Text>
                  </>
                )}

                {preview && (
                  <Heading size="md" color="brand.ink">
                    Join <Box as="span" color="rsViolet.500">{preview.advertiser.name}</Box>
                  </Heading>
                )}
              </Box>

              {preview && (
                <Text fontSize="sm" color="brand.muted" lineHeight="1.7">
                  {preview.invitedByName ? <>Invited by <b>{preview.invitedByName}</b> </> : null}
                  as a <Badge colorScheme={ROLE_COLOR[preview.role]} variant="subtle">{preview.role}</Badge>.
                </Text>
              )}

              {/* Unauthenticated — sign in to proceed. */}
              {preview && auth.status === 'unauthenticated' && (
                <>
                  <Text fontSize="sm" color="brand.muted">
                    Sign in with the email this invitation was sent to:{' '}
                    <Box as="span" fontFamily="mono" color="brand.ink">{preview.email}</Box>
                  </Text>
                  <Button variant="brand" onClick={signInForInvite}>Sign in with Google</Button>
                </>
              )}

              {/* Authenticated + matching email — accept. */}
              {preview && auth.status === 'authenticated' && !emailMismatch && (
                <>
                  <Text fontSize="sm" color="brand.muted">
                    Signed in as <Box as="span" color="brand.ink" fontWeight="700">{currentEmail}</Box>.
                  </Text>
                  <Button
                    variant="brand"
                    onClick={accept}
                    isLoading={accepting}
                    loadingText="Accepting…"
                  >
                    Accept invitation
                  </Button>
                  {acceptErr && <Text color="red.600" fontSize="sm">{acceptErr}</Text>}
                  <Text fontSize="xs" color="brand.muted">
                    Wrong account?{' '}
                    <Box
                      as="button"
                      color="rsViolet.500"
                      textDecoration="underline"
                      onClick={useDifferentAccount}
                    >
                      Sign out and use a different one
                    </Box>
                  </Text>
                </>
              )}

              {/* Authenticated + mismatched email — block accept. */}
              {preview && auth.status === 'authenticated' && emailMismatch && (
                <>
                  <Card variant="outline" bg="red.50" borderColor="red.200">
                    <CardBody py={3}>
                      <Text fontSize="sm" color="brand.ink">
                        This invitation was sent to{' '}
                        <Box as="span" fontFamily="mono" fontWeight="700">{preview.email}</Box>,
                        but you're signed in as{' '}
                        <Box as="span" fontFamily="mono" fontWeight="700">{currentEmail}</Box>.
                      </Text>
                    </CardBody>
                  </Card>
                  <Button variant="brand" onClick={useDifferentAccount}>
                    Sign in with a different Google account
                  </Button>
                </>
              )}

              {auth.status === 'loading' && (
                <HStack spacing={3}>
                  <Spinner size="sm" />
                  <Text fontSize="sm" color="brand.muted">Checking session…</Text>
                </HStack>
              )}
            </VStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}

export default InvitePage;
