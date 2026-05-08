// Onboarding page — landing for authenticated users who don't yet
// have an Advertiser membership. Triggered by the apiFetch redirect
// chain: any /api/* call that returns 403 NO_ADVERTISER bounces the
// browser here so the user isn't stuck in the auth-loop state.
//
// CTA branches on backend eligibility:
//   canSelfCreate=true  → "Create your workspace" (→ /onboarding/workspace)
//   canSelfCreate=false → "Sign out" + "Request access" (mailto)
//
// The eligibility check is server-side (WORKSPACE_SIGNUP_ALLOWED_DOMAINS
// env allowlist) so the UI can't leak the rule. We read it via
// /api/onboarding/eligibility on mount.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardBody, Heading, Text, VStack, HStack, Link, Spinner
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';

type Eligibility = {
  email:         string;
  hasAdvertiser: boolean;
  canSelfCreate: boolean;
  reason:        'already_has_advertiser' | 'domain_not_allowed' | null;
};

export function OnboardingPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const email = auth.status === 'authenticated' ? auth.user.email : null;

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<Eligibility>('/api/onboarding/eligibility');
        if (cancelled) return;
        setEligibility(res);
        // Already has a workspace — apiFetch shouldn't have bounced
        // here, but defend against the race.
        if (res.hasAdvertiser) navigate('/brand', { replace: true });
      } catch {
        // Eligibility check failure is non-fatal — fall through to
        // the contact-admin message so the user has a path forward.
        if (!cancelled) setEligibility({ email: email || '', hasAdvertiser: false, canSelfCreate: false, reason: 'domain_not_allowed' });
      }
    })();
    return () => { cancelled = true; };
  }, [auth.status, email, navigate]);

  return (
    <Box minH="100vh" bg="brand.canvas" py={20} px={4}>
      <Box maxW="560px" mx="auto">
        <Card>
          <CardBody p={8}>
            <VStack align="stretch" spacing={5}>
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
                  Account setup
                </Text>
                <Heading size="md" color="brand.ink">You're signed in, but not in a workspace yet</Heading>
              </Box>

              {!eligibility && (
                <HStack spacing={3} py={4}>
                  <Spinner size="sm" />
                  <Text fontSize="sm" color="brand.muted">Checking your account…</Text>
                </HStack>
              )}

              {eligibility?.canSelfCreate && (
                <>
                  <Text color="brand.muted" fontSize="sm" lineHeight="1.7">
                    {email ? <>You're signed in as <b>{email}</b>.</> : null}
                    {' '}Create your workspace to start matching content with your products.
                  </Text>
                  <HStack spacing={3}>
                    <Button variant="outline" onClick={auth.signOut}>Sign out</Button>
                    <Button variant="brand" onClick={() => navigate('/onboarding/workspace')}>
                      Create your workspace
                    </Button>
                  </HStack>
                </>
              )}

              {eligibility && !eligibility.canSelfCreate && (
                <>
                  <Text color="brand.muted" fontSize="sm" lineHeight="1.7">
                    {email ? <>Your Google account <b>{email}</b> isn't a member of any Reach Social workspace yet, and self-serve isn't open for this account.</> : 'Your account isn\'t a member of any Reach Social workspace yet.'}
                    {' '}If you were expecting an invite, ask your admin to (re)send it. If you're setting up a new
                    workspace, please reach out to your account contact.
                  </Text>
                  <HStack spacing={3}>
                    <Button variant="outline" onClick={auth.signOut}>Sign out</Button>
                    <Button as={Link} href="mailto:hello@reachsocial.io" variant="brand">
                      Request access
                    </Button>
                  </HStack>
                </>
              )}
            </VStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
