// Onboarding step 1 — create the user's first workspace (Advertiser).
//
// Routed at /onboarding/workspace. Users land here either by clicking
// the "Create workspace" CTA on OnboardingPage (after a 403
// NO_ADVERTISER bounce) or directly via the post-OAuth redirect once
// we wire it. Self-serve is gated by the backend's
// WORKSPACE_SIGNUP_ALLOWED_DOMAINS env allowlist; we pre-check via
// /api/onboarding/eligibility so users on disallowed domains see a
// clear message instead of a button that 403s.
//
// On successful create:
//   - Backend returns { advertiser } and writes both the Advertiser
//     and AdvertiserMembership rows.
//   - The next /api/* call resolves the new active membership
//     server-side (requireAuth re-fetches per request), so no client
//     auth state needs to change — we just navigate.
//   - V1 redirects to /brand. Once /onboarding/brand ships in Phase
//     2 it'll redirect there instead.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardBody, FormControl, FormLabel, Input,
  Heading, Text, VStack, HStack, Spinner, useToast, Link
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';

type Eligibility = {
  email:         string;
  hasAdvertiser: boolean;
  canSelfCreate: boolean;
  reason:        'already_has_advertiser' | 'domain_not_allowed' | null;
};

type CreateResponse = {
  advertiser: { id: string; name: string; slug: string };
  brand:      { id: string } | null;
};

export function WorkspacePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<Eligibility>('/api/onboarding/eligibility');
        if (cancelled) return;
        setEligibility(res);
        // Already has a workspace — bounce them back into the app.
        if (res.hasAdvertiser) navigate('/brand', { replace: true });
      } catch (e) {
        if (!cancelled) setEligibilityError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [auth.status, navigate]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting && !!eligibility?.canSelfCreate;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiJson<CreateResponse>('/api/onboarding/advertiser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      toast({ title: 'Workspace created', status: 'success', duration: 2500 });
      // Hand off to brand-create (Phase 2). Phase 3 will pick up
      // from there with the connect-flow stepper.
      navigate('/onboarding/brand', { replace: true });
    } catch (e) {
      toast({
        title:       'Could not create workspace',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    6000
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.status === 'loading') {
    return <CenteredSpinner label="Checking session…" />;
  }
  if (auth.status === 'unauthenticated') {
    return (
      <Shell>
        <VStack align="stretch" spacing={4}>
          <Heading size="md" color="brand.ink">Sign in to continue</Heading>
          <Text fontSize="sm" color="brand.muted">
            Workspace creation requires a signed-in account.
          </Text>
          <Button variant="brand" onClick={auth.signIn}>Sign in with Google</Button>
        </VStack>
      </Shell>
    );
  }
  if (eligibilityError) {
    return (
      <Shell>
        <Heading size="md" color="brand.ink">Something went wrong</Heading>
        <Text fontSize="sm" color="red.600" mt={3}>{eligibilityError}</Text>
        <Button variant="outline" mt={4} onClick={() => window.location.reload()}>Retry</Button>
      </Shell>
    );
  }
  if (!eligibility) {
    return <CenteredSpinner label="Checking eligibility…" />;
  }
  if (!eligibility.canSelfCreate && eligibility.reason === 'domain_not_allowed') {
    return (
      <Shell>
        <VStack align="stretch" spacing={4}>
          <Box>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
              Account setup
            </Text>
            <Heading size="md" color="brand.ink">Self-serve isn't open for your account yet</Heading>
          </Box>
          <Text fontSize="sm" color="brand.muted" lineHeight="1.7">
            Workspace creation is currently limited to invited domains. <b>{eligibility.email}</b> isn't on
            the allowlist, but if you were expecting access, drop us a line and we'll get you set up.
          </Text>
          <HStack spacing={3}>
            <Button variant="outline" onClick={auth.signOut}>Sign out</Button>
            <Button as={Link} href="mailto:hello@reachsocial.io" variant="brand">
              Request access
            </Button>
          </HStack>
        </VStack>
      </Shell>
    );
  }

  return (
    <Shell>
      <VStack align="stretch" spacing={5}>
        <Box>
          <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
            Step 1 of 3 — Workspace
          </Text>
          <Heading size="md" color="brand.ink">Name your workspace</Heading>
          <Text fontSize="sm" color="brand.muted" mt={2}>
            Your workspace is the top-level account that holds brands, integrations, and ad runs. You can
            rename it later in Settings.
          </Text>
        </Box>

        <FormControl isRequired>
          <FormLabel fontSize="sm">Workspace name</FormLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
            autoFocus
            isDisabled={submitting}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
          />
        </FormControl>

        <HStack justify="flex-end">
          <Button variant="outline" onClick={auth.signOut} isDisabled={submitting}>
            Sign out
          </Button>
          <Button
            variant="brand"
            onClick={submit}
            isLoading={submitting}
            loadingText="Creating…"
            isDisabled={!canSubmit}
          >
            Continue
          </Button>
        </HStack>
      </VStack>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Box minH="100vh" bg="brand.canvas" py={20} px={4}>
      <Box maxW="560px" mx="auto">
        <Card>
          <CardBody p={8}>{children}</CardBody>
        </Card>
      </Box>
    </Box>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <Box minH="60vh" display="grid" placeItems="center">
      <HStack spacing={3}>
        <Spinner size="sm" />
        <Text fontSize="sm" color="brand.muted">{label}</Text>
      </HStack>
    </Box>
  );
}
