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
// OAuth round-trip handling (post 2026-05-11):
// startConnect sends onboarding=true to the connect endpoint; that
// flag rides through OAuth state and tells the callback to bounce
// to /onboarding/connect (this page) instead of /brand. The picker
// modal — IG / Meta Ads / Google Ads — opens RIGHT HERE based on
// the bounce's ig_setup / ads_setup / gads_setup query params. No
// intermediate /brand visit; operator sees their progress on this
// same page as each integration finalizes.

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
import { IGPickerModal } from '../Brand/IGPickerModal';
import { AdsPickerModal } from '../Brand/AdsPickerModal';
import { GoogleAdsPickerModal } from '../Brand/GoogleAdsPickerModal';

// ── State ─────────────────────────────────────────────────────────

type IntegrationStatus = {
  connected: boolean;
  pending?: boolean;
  // True when the advertiser has another brand with creds for this
  // integration. Server-side, the connect endpoint will force the
  // OAuth asset picker / account chooser to re-show; this flag lets
  // the UI surface a hint banner so the operator knows what to expect.
  additionalBrandMode?: boolean;
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
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || localStorage.getItem('brand_id');

  const [statuses, setStatuses] = useState<AllStatuses | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [skipped, setSkipped]   = useState<{ catalog: boolean; social: boolean; ads: boolean }>({
    catalog: false, social: false, ads: false
  });
  const [submitting, setSubmitting] = useState(false);
  // Picker state — set when a post-OAuth bounce includes a setup id.
  // Picker resolves the credential pending → active, then onCompleted
  // refreshes the status grid.
  const [igPickerCredId,        setIgPickerCredId]        = useState<string | null>(null);
  const [adsPickerCredId,       setAdsPickerCredId]       = useState<string | null>(null);
  const [googleAdsPickerCredId, setGoogleAdsPickerCredId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  // Pull current integration state. Three calls in parallel; one is
  // bound to fail noisily (404) if the brand isn't fully resolved
  // yet — we treat any non-200 as "not connected" rather than
  // bubbling the error.
  const refresh = useCallback(async () => {
    try {
      type StatusResp = { credentials: Array<{ status: string; igUserId?: string }>; additionalBrandMode?: boolean };
      const fallback: StatusResp = { credentials: [], additionalBrandMode: false };
      const [ig, meta, google] = await Promise.all([
        apiJson<StatusResp>('/api/integrations/instagram/status').catch(() => fallback),
        apiJson<StatusResp>('/api/integrations/meta-ads/status').catch(() => fallback),
        apiJson<StatusResp>('/api/integrations/google-ads/status').catch(() => fallback)
      ]);
      setStatuses({
        ig:     { connected: ig.credentials.some((c) => c.status === 'active'),     pending: ig.credentials.some((c) => c.status === 'pending'),     additionalBrandMode: !!ig.additionalBrandMode },
        meta:   { connected: meta.credentials.some((c) => c.status === 'active'),   pending: meta.credentials.some((c) => c.status === 'pending'),   additionalBrandMode: !!meta.additionalBrandMode },
        google: { connected: google.credentials.some((c) => c.status === 'active'), pending: google.credentials.some((c) => c.status === 'pending'), additionalBrandMode: !!google.additionalBrandMode }
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

  // OAuth callback bounce: surface success/error toasts AND auto-open
  // the right picker modal when the page loads with provider setup
  // params. The picker finalizes the credential pending → active so
  // the operator never leaves /onboarding/connect.
  useEffect(() => {
    const igStatus    = params.get('ig_status');
    const adsStatus   = params.get('ads_status');
    const gadsStatus  = params.get('gads_status');
    const igSetup     = params.get('ig_setup');
    const adsSetup    = params.get('ads_setup');
    const gadsSetup   = params.get('gads_setup');

    if (igStatus === 'pending' && igSetup) {
      toast({ title: 'Instagram connected — pick your page + catalog', status: 'success', duration: 3500 });
      setIgPickerCredId(igSetup);
    }
    if (igStatus === 'denied' || igStatus === 'error') {
      toast({ title: 'Instagram connect failed', description: params.get('ig_msg') || '', status: 'error', duration: 5000 });
    }
    if (adsStatus === 'pending' && adsSetup) {
      toast({ title: 'Meta Ads connected — pick your ad account', status: 'success', duration: 3500 });
      setAdsPickerCredId(adsSetup);
    }
    if (adsStatus === 'denied' || adsStatus === 'error') {
      toast({ title: 'Meta Ads connect failed', description: params.get('ads_msg') || '', status: 'error', duration: 5000 });
    }
    if (gadsStatus === 'pending' && gadsSetup) {
      toast({ title: 'Google Ads connected — pick your account', status: 'success', duration: 3500 });
      setGoogleAdsPickerCredId(gadsSetup);
    }
    if (gadsStatus === 'denied' || gadsStatus === 'error') {
      toast({ title: 'Google Ads connect failed', description: params.get('gads_msg') || '', status: 'error', duration: 5000 });
    }

    // Strip OAuth bounce params from the URL so a hard refresh doesn't
    // re-trigger the picker / toasts.
    const next = new URLSearchParams(params);
    ['ig_status','ig_msg','ig_setup',
     'ads_status','ads_msg','ads_setup',
     'gads_status','gads_msg','gads_setup'].forEach(k => next.delete(k));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConnect = async (path: string) => {
    if (!brandId) {
      toast({ title: 'No active brand — finish brand setup first', status: 'error', duration: 4000 });
      return;
    }
    try {
      // onboarding=true tells the OAuth callback to bounce back here
      // (/onboarding/connect) instead of the default /brand. The
      // picker modal then auto-opens on this page via the URL-param
      // effect above.
      const res = await apiJson<{ authorizeUrl: string }>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Brand-Id': brandId },
        body: JSON.stringify({ redirect: window.location.origin, onboarding: true })
      });
      window.location.href = res.authorizeUrl;
    } catch (e) {
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
  const additionalBrandMode = !!(ig?.additionalBrandMode || meta?.additionalBrandMode || google?.additionalBrandMode);

  const catalogDecided = !!ig?.connected || !!ig?.pending || skipped.catalog;
  const socialDecided  = !!ig?.connected || !!ig?.pending || skipped.social;     // IG covers both
  const adsDecided     = (!!meta?.connected || !!meta?.pending || !!google?.connected || !!google?.pending) || skipped.ads;
  const allDecided     = catalogDecided && socialDecided && adsDecided;

  const finish = async () => {
    setSubmitting(true);
    try {
      // Server-side dispatch — fans out the catalog / posts / campaigns
      // syncs in the background and returns 202 in ms. We can't fire
      // the per-platform sync routes from the browser anymore: they
      // run synchronously server-side (catalog ~8s, posts ~52s), and
      // the browser aborts in-flight fetches as soon as we navigate
      // away. The dispatch endpoint owns the fan-out so navigation
      // can't cancel it.
      await apiJson<{ dispatched: string[] }>('/api/onboarding/dispatch-syncs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      toast({ title: 'Onboarding done — kicking off background syncs', status: 'success', duration: 3000 });
      // Land on /home so the operator sees the welcome dashboard with
      // the onboarding status panel watching the auto-triggered
      // catalog / posts / detect runs land. /brand stays one click
      // away via the Home page's "Review brand details" card.
      navigate('/home', { replace: true });
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
            {additionalBrandMode ? `Attach integrations to ${activeBrand?.name || 'this brand'}` : 'Step 3 of 3 — Connect'}
          </Text>
          <Heading size="md" color="brand.ink">{additionalBrandMode ? 'Connect a different account for this brand' : 'Plug in your data sources'}</Heading>
          <Text fontSize="sm" color="brand.muted" mt={2}>
            {additionalBrandMode
              ? 'You already have integrations on another brand under this workspace. To connect a different Meta business account / Google account for this brand, click connect — you\'ll be prompted to grant access to additional assets in the OAuth dialog. If you skip the picker, the existing account is reused.'
              : 'We need a product catalog, a social account, and at least one ad account to generate performant ads. You can skip any section, but match quality and reporting will degrade.'}
          </Text>
        </Box>
        {additionalBrandMode && (
          <Box
            bg="rsYellow.50"
            borderWidth="1px"
            borderColor="rsYellow.200"
            borderRadius="lg"
            px={4}
            py={3}
          >
            <HStack spacing={2} align="flex-start">
              <Icon as={AlertCircle} boxSize={4} color="rsOrange.500" mt={0.5} />
              <Box>
                <Text fontSize="sm" fontWeight="700" color="rsOrange.700">Adding a second brand?</Text>
                <Text fontSize="xs" color="brand.muted" mt={1}>
                  When Meta shows the asset picker, check the additional business account / IG page / ad account
                  you want to attach to this brand. Google will show its account chooser so you can pick a
                  different login. If the existing account is the right one, just confirm.
                </Text>
              </Box>
            </HStack>
          </Box>
        )}

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

      {/* Picker modals — opened by the post-OAuth bounce. Each resolves
          its credential from pending → active; onCompleted refreshes
          the status grid so the section flips to Connected in-place. */}
      <IGPickerModal
        isOpen={!!igPickerCredId}
        onClose={() => setIgPickerCredId(null)}
        credentialId={igPickerCredId}
        onCompleted={() => { setIgPickerCredId(null); void refresh(); }}
      />
      <AdsPickerModal
        isOpen={!!adsPickerCredId}
        onClose={() => setAdsPickerCredId(null)}
        credentialId={adsPickerCredId}
        onCompleted={() => { setAdsPickerCredId(null); void refresh(); }}
      />
      <GoogleAdsPickerModal
        isOpen={!!googleAdsPickerCredId}
        onClose={() => setGoogleAdsPickerCredId(null)}
        credentialId={googleAdsPickerCredId}
        onCompleted={() => { setGoogleAdsPickerCredId(null); void refresh(); }}
      />
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
