// Onboarding step 3 — connect integrations.
//
// Three sections; each can be Connect-ed (OAuth round trip) or
// Skip-ped (with a degraded-UX warning). Continue is enabled once
// every section has a decision (connected OR skipped). On submit:
//   - For each connected integration, fire its sync (catalog →
//     posts → campaigns) so the user lands on /brand with data
//     already populating.
//   - Navigate to /brand.
//
// OAuth round-trip handling:
// The integrations callbacks always bounce back to /brand (per
// buildIntegrationBounceUrl). We can't change that without a
// backend touch, so instead we stash localStorage.onboarding_resume_to
// = '/onboarding/connect' before navigating to OAuth, and the /brand
// page reads it on mount and bounces back here preserving the
// callback's status query params.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Card, CardBody, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Spinner, Badge, useToast, Tooltip
} from '@chakra-ui/react';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';

// ── State ─────────────────────────────────────────────────────────

type IntegrationStatus = {
  connected: boolean;
  pending?: boolean;
  // Provider-specific fields are flattened into the `details` blob.
  details?: Record<string, unknown>;
};

type AllStatuses = {
  ig:      IntegrationStatus;
  meta:    IntegrationStatus;
  google:  IntegrationStatus;
};

// ── Page ──────────────────────────────────────────────────────────

export function ConnectPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || localStorage.getItem('brand_id');

  const [statuses, setStatuses] = useState<AllStatuses | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [skipped, setSkipped]   = useState<{ catalog: boolean; social: boolean; ads: boolean }>({
    catalog: false, social: false, ads: false
  });
  const [submitting, setSubmitting] = useState(false);

  // Pull current integration state. Three calls in parallel; one is
  // bound to fail noisily (404) if the brand isn't fully resolved
  // yet — we treat any non-200 as "not connected" rather than
  // bubbling the error.
  const refresh = useCallback(async () => {
    try {
      const [ig, meta, google] = await Promise.all([
        apiJson<{ credentials: Array<{ status: string; igUserId?: string }> }>('/api/integrations/instagram/status').catch(() => ({ credentials: [] })),
        apiJson<{ credentials: Array<{ status: string }> }>('/api/integrations/meta-ads/status').catch(() => ({ credentials: [] })),
        apiJson<{ credentials: Array<{ status: string }> }>('/api/integrations/google-ads/status').catch(() => ({ credentials: [] }))
      ]);
      setStatuses({
        ig:     { connected: ig.credentials.some((c) => c.status === 'active'),     pending: ig.credentials.some((c) => c.status === 'pending') },
        meta:   { connected: meta.credentials.some((c) => c.status === 'active'),   pending: meta.credentials.some((c) => c.status === 'pending') },
        google: { connected: google.credentials.some((c) => c.status === 'active'), pending: google.credentials.some((c) => c.status === 'pending') }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      navigate('/landing', { replace: true });
      return;
    }
    if (auth.status !== 'authenticated') return;
    void refresh();
  }, [auth.status, navigate, refresh]);

  // OAuth callback bounce: surface success/error toasts when the
  // page loads with provider status params.
  useEffect(() => {
    const igStatus    = searchParams.get('ig_status');
    const adsStatus   = searchParams.get('ads_status');
    const googleStatus = searchParams.get('google_status');
    if (igStatus === 'pending')  toast({ title: 'Instagram connected — finalize in the brand page', status: 'success', duration: 3500 });
    if (igStatus === 'denied' || igStatus === 'error') toast({ title: 'Instagram connect failed', description: searchParams.get('ig_msg') || '', status: 'error', duration: 5000 });
    if (adsStatus === 'pending') toast({ title: 'Meta Ads connected', status: 'success', duration: 3500 });
    if (adsStatus === 'denied' || adsStatus === 'error') toast({ title: 'Meta Ads connect failed', status: 'error', duration: 5000 });
    if (googleStatus === 'pending') toast({ title: 'Google Ads connected', status: 'success', duration: 3500 });
    if (googleStatus === 'denied' || googleStatus === 'error') toast({ title: 'Google Ads connect failed', status: 'error', duration: 5000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConnect = async (path: string) => {
    if (!brandId) {
      toast({ title: 'No active brand — finish brand setup first', status: 'error', duration: 4000 });
      return;
    }
    // Stash the resume target so the /brand page bounces us back
    // here after the integration callback's hardcoded bounce.
    localStorage.setItem('onboarding_resume_to', '/onboarding/connect');
    try {
      const res = await apiJson<{ authorizeUrl: string }>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Brand-Id': brandId },
        body: JSON.stringify({ redirect: window.location.origin })
      });
      window.location.href = res.authorizeUrl;
    } catch (e) {
      localStorage.removeItem('onboarding_resume_to');
      toast({
        title:       'Could not start the connect flow',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    }
  };

  // Section decision derivation: connected OR skipped → decided.
  const ig     = statuses?.ig;
  const meta   = statuses?.meta;
  const google = statuses?.google;

  const catalogDecided = !!ig?.connected || !!ig?.pending || skipped.catalog;
  const socialDecided  = !!ig?.connected || !!ig?.pending || skipped.social;     // IG covers both
  const adsDecided     = (!!meta?.connected || !!meta?.pending || !!google?.connected || !!google?.pending) || skipped.ads;
  const allDecided     = catalogDecided && socialDecided && adsDecided;

  const finish = async () => {
    setSubmitting(true);
    try {
      // Trigger the syncs for whatever connected. Fire-and-forget;
      // we don't wait. Each sync runs server-side over the next few
      // minutes; the /brand page surfaces progress.
      const triggers: Promise<unknown>[] = [];
      if (ig?.connected || ig?.pending) {
        triggers.push(apiJson('/api/integrations/instagram/sync-catalog', { method: 'POST' }).catch(() => null));
        triggers.push(apiJson('/api/integrations/instagram/sync-posts',   { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => null));
      }
      if (meta?.connected || google?.connected || meta?.pending || google?.pending) {
        triggers.push(apiJson('/api/integrations/meta-ads/sync-campaigns',   { method: 'POST' }).catch(() => null));
        triggers.push(apiJson('/api/integrations/google-ads/sync-campaigns', { method: 'POST' }).catch(() => null));
      }
      // Don't await — let them run in the background while we redirect.
      void Promise.allSettled(triggers);
      toast({ title: 'Onboarding done — kicking off background syncs', status: 'success', duration: 3000 });
      navigate('/brand', { replace: true });
    } catch (e) {
      toast({ title: 'Continue failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.status === 'loading' || !statuses) {
    return (
      <Box minH="60vh" display="grid" placeItems="center">
        <HStack spacing={3}><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading integrations…</Text></HStack>
      </Box>
    );
  }
  if (error) {
    return (
      <Shell>
        <Heading size="md" color="brand.ink">Couldn't load integration status</Heading>
        <Text fontSize="sm" color="red.600" mt={3}>{error}</Text>
        <Button variant="outline" mt={4} onClick={refresh}>Retry</Button>
      </Shell>
    );
  }

  return (
    <Shell maxW="780px">
      <VStack align="stretch" spacing={6}>
        <Box>
          <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
            Step 3 of 3 — Connect
          </Text>
          <Heading size="md" color="brand.ink">Plug in your data sources</Heading>
          <Text fontSize="sm" color="brand.muted" mt={2}>
            We need a product catalog, a social account, and at least one ad account to generate
            performant ads. You can skip any section, but match quality and reporting will degrade.
          </Text>
        </Box>

        <Section
          title="Catalog"
          subtitle="One product source. Drives the products the renderer pulls from."
          decided={catalogDecided}
          skipped={skipped.catalog}
          onSkip={() => setSkipped(s => ({ ...s, catalog: true }))}
          warningOnSkip="Without a catalog, you can't generate product-driven ads — only brand-mode ads."
        >
          <ProviderRow
            name="Instagram Catalog"
            badge="Includes posts + catalog"
            connected={!!ig?.connected || !!ig?.pending}
            onConnect={() => startConnect('/api/integrations/instagram/connect')}
          />
          <ProviderRow
            name="Google Merchant Center"
            badge="Coming soon"
            connected={false}
            disabled
          />
        </Section>

        <Section
          title="Social"
          subtitle="Where customer content comes from. Required for UGC matching."
          decided={socialDecided}
          skipped={skipped.social}
          onSkip={() => setSkipped(s => ({ ...s, social: true }))}
          warningOnSkip="Without social, there's no customer content to match against — ads land in brand-mode only."
        >
          <ProviderRow
            name="Instagram"
            badge={ig?.connected ? 'Connected via catalog' : undefined}
            connected={!!ig?.connected || !!ig?.pending}
            onConnect={() => startConnect('/api/integrations/instagram/connect')}
            disabled={!!ig?.connected || !!ig?.pending}
          />
        </Section>

        <Section
          title="Ad Accounts"
          subtitle="Connect the platforms you'll publish to. Both are encouraged."
          decided={adsDecided}
          skipped={skipped.ads}
          onSkip={() => setSkipped(s => ({ ...s, ads: true }))}
          warningOnSkip="Without ad accounts, generated ads can't push to a campaign — you'll need to download and upload manually."
        >
          <ProviderRow
            name="Meta Ads"
            connected={!!meta?.connected || !!meta?.pending}
            onConnect={() => startConnect('/api/integrations/meta-ads/connect')}
          />
          <ProviderRow
            name="Google Ads"
            connected={!!google?.connected || !!google?.pending}
            onConnect={() => startConnect('/api/integrations/google-ads/connect')}
          />
        </Section>

        <HStack justify="flex-end">
          <Tooltip
            label={allDecided ? '' : 'Connect or skip every section to continue.'}
            isDisabled={allDecided}
            hasArrow
          >
            <Button
              variant="brand"
              onClick={finish}
              isLoading={submitting}
              loadingText="Finishing…"
              isDisabled={!allDecided}
              rightIcon={<Icon as={ArrowRight} boxSize={4} />}
            >
              Finish setup
            </Button>
          </Tooltip>
        </HStack>
      </VStack>
    </Shell>
  );
}

// ── Building blocks ───────────────────────────────────────────────

function Section({
  title, subtitle, decided, skipped, onSkip, warningOnSkip, children
}: {
  title:         string;
  subtitle:      string;
  decided:       boolean;
  skipped:       boolean;
  onSkip:        () => void;
  warningOnSkip: string;
  children:      React.ReactNode;
}) {
  return (
    <Card>
      <CardBody>
        <HStack justify="space-between" align="flex-start" mb={3}>
          <Box flex={1} minW={0}>
            <HStack spacing={2}>
              <Heading size="sm" color="brand.ink">{title}</Heading>
              {decided && <Icon as={CheckCircle2} color="green.500" boxSize={4} />}
              {skipped && !decided && <Badge colorScheme="orange" variant="subtle">Skipped</Badge>}
            </HStack>
            <Text fontSize="13px" color="brand.muted" mt={1}>{subtitle}</Text>
          </Box>
          {!decided && (
            <Button size="sm" variant="ghost" onClick={onSkip}>
              Skip
            </Button>
          )}
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          {children}
        </SimpleGrid>

        {skipped && !decided && (
          <HStack mt={3} spacing={2} fontSize="12px" color="orange.700" bg="orange.50" px={3} py={2} borderRadius="md">
            <Icon as={AlertCircle} boxSize={3.5} />
            <Text>{warningOnSkip}</Text>
          </HStack>
        )}
      </CardBody>
    </Card>
  );
}

function ProviderRow({
  name, badge, connected, onConnect, disabled
}: {
  name:        string;
  badge?:      string;
  connected:   boolean;
  onConnect?:  () => void;
  disabled?:   boolean;
}) {
  return (
    <Card variant="outline" boxShadow="none">
      <CardBody py={3}>
        <HStack justify="space-between" align="center">
          <Box flex={1} minW={0}>
            <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{name}</Text>
            {badge && <Text fontSize="11px" color="brand.muted" noOfLines={1}>{badge}</Text>}
          </Box>
          {connected ? (
            <Badge colorScheme="green" variant="subtle">Connected</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={onConnect} isDisabled={disabled}>
              Connect
            </Button>
          )}
        </HStack>
      </CardBody>
    </Card>
  );
}

function Shell({ children, maxW = '560px' }: { children: React.ReactNode; maxW?: string }) {
  return (
    <Box minH="100vh" bg="brand.canvas" py={20} px={4}>
      <Box maxW={maxW} mx="auto">{children}</Box>
    </Box>
  );
}
