// Phase 4c — Integrations card.
//
// Fetches connection status for Instagram + Meta Ads + Google Ads in
// parallel. Renders a 4-tile grid (the 4th slot is a TikTok Shop stub
// since we don't have a backend integration for it yet — Google
// Merchant Center is the same; both render as "Not connected" with a
// "Coming soon" disabled CTA).
//
// Connect → POST /connect → redirect to the OAuth authorize URL.
// After auth, Meta bounces to the legacy /brand.html callback handler
// (it drives the picker modal). Once the user finishes setup there,
// they navigate back to /brand and see the connected state. Long-term
// fix: rebuild the picker modal in the new app + update the callback
// to honor a `redirect` state param like /auth/google does.
//
// Disconnect → DELETE /api/integrations/{type}/:credentialId.
//
// Bottom strip shows the brand's syncSettings (auto-sync toggle +
// cadences) with a Sync Now button that triggers an immediate
// catalog + posts sync via the existing endpoints.

import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Card, CardBody, HStack, VStack, Text, Heading, Box, Button, Badge,
  SimpleGrid, Flex, Divider, useToast, Icon, Spinner
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import type { Brand } from './types';
import { IGPickerModal } from './IGPickerModal';
import { AdsPickerModal } from './AdsPickerModal';

// Imperative handle exposed by IntegrationsCard so parents (like the
// /brand page) can pop the picker open after the post-OAuth bounce
// — see the useSearchParamsConsumer wiring in Brand/index.tsx.
export type IntegrationsCardHandle = {
  openIGPicker:  (credentialId: string) => void;
  openAdsPicker: (credentialId: string) => void;
};

type IntegrationKind = 'instagram' | 'meta-ads' | 'google-merchant' | 'tiktok-shop';

type StatusRow = {
  configured: boolean;
  credential: null | {
    id:           string;
    status:       'active' | 'pending';
    igUsername?:  string | null;
    pageName?:    string | null;
    selectedAdAccountName?: string | null;
    accountLabel?: string | null;
    lastUsedAt?:  string | null;
    connectedAt?: string | null;
  };
};

type Props = {
  brand: Brand;
};

export const IntegrationsCard = forwardRef<IntegrationsCardHandle, Props>(function IntegrationsCard({ brand }, ref) {
  const toast = useToast();
  const [igStatus,    setIgStatus]    = useState<StatusRow | null>(null);
  const [metaStatus,  setMetaStatus]  = useState<StatusRow | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [igPickerCredId,  setIgPickerCredId]  = useState<string | null>(null);
  const [adsPickerCredId, setAdsPickerCredId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openIGPicker:  (credId) => setIgPickerCredId(credId),
    openAdsPicker: (credId) => setAdsPickerCredId(credId)
  }), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ig, meta] = await Promise.allSettled([
        apiJson<StatusRow>('/api/integrations/instagram/status'),
        apiJson<{ configured: boolean; credential: StatusRow['credential'] }>('/api/integrations/meta-ads/status')
      ]);
      setIgStatus(ig.status   === 'fulfilled' ? ig.value   : null);
      setMetaStatus(meta.status === 'fulfilled' ? meta.value : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = async (kind: IntegrationKind) => {
    if (kind !== 'instagram' && kind !== 'meta-ads') return;
    try {
      const path = kind === 'instagram' ? '/api/integrations/instagram/connect' : '/api/integrations/meta-ads/connect';
      // Tell the backend where to bounce back after OAuth. The server
      // validates against FRONTEND_URLS allowlist and round-trips
      // through the OAuth state — see services/frontendOriginValidator.
      const redirect = typeof window !== 'undefined' ? window.location.origin : null;
      const res = await apiJson<{ authorizeUrl: string }>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect })
      });
      window.location.assign(res.authorizeUrl);
    } catch (err: unknown) {
      toast({
        title: 'Connect failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    }
  };

  const disconnect = async (kind: 'instagram' | 'meta-ads', credentialId: string, name: string) => {
    const ok = window.confirm(`Disconnect ${name}? This stops syncs and removes the credential.`);
    if (!ok) return;
    try {
      await apiJson(`/api/integrations/${kind}/${credentialId}`, { method: 'DELETE' });
      toast({ title: `${name} disconnected`, status: 'success', duration: 2500 });
      await refresh();
    } catch (err: unknown) {
      toast({
        title: 'Disconnect failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      // Fire catalog + posts in parallel; either may legitimately not
      // be configured (e.g. no IG attached). Settled allows the other
      // to land even when one fails.
      const results = await Promise.allSettled([
        apiJson('/api/integrations/instagram/sync-catalog', { method: 'POST' }),
        apiJson('/api/integrations/instagram/sync-posts',   { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      ]);
      const errCount = results.filter(r => r.status === 'rejected').length;
      const okCount  = results.filter(r => r.status === 'fulfilled').length;
      toast({
        title: errCount === 0 ? 'Sync started' : `Sync partial (${okCount} ok, ${errCount} failed)`,
        description: errCount === 0
          ? 'Catalog + posts syncs are running.'
          : (results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason?.message,
        status: errCount === 0 ? 'success' : 'warning',
        duration: 4000
      });
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">Integrations</Heading>
          <Button
            size="xs"
            variant="outline"
            isDisabled
            title="Connecting new platforms ships with each provider's row below"
          >
            Connect New Source
          </Button>
        </HStack>

        {loading ? (
          <Flex py={6} align="center" justify="center"><Spinner /></Flex>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3}>
            <IntegrationTile
              kind="instagram"
              label="Instagram"
              gradient="linear-gradient(135deg, #FEDA77, #F58529, #DD2A7B, #8134AF, #515BD4)"
              status={igStatus}
              onConnect={() => connect('instagram')}
              onDisconnect={(id) => disconnect('instagram', id, 'Instagram')}
              onManage={(id) => setIgPickerCredId(id)}
            />
            <IntegrationTile
              kind="meta-ads"
              label="Meta Ads"
              gradient="#0866FF"
              status={metaStatus}
              onConnect={() => connect('meta-ads')}
              onDisconnect={(id) => disconnect('meta-ads', id, 'Meta Ads')}
              onManage={(id) => setAdsPickerCredId(id)}
            />
            <IntegrationTile
              kind="google-merchant"
              label="Google Merchant Center"
              gradient="linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)"
              status={null}
              comingSoon
            />
            <IntegrationTile
              kind="tiktok-shop"
              label="TikTok Shop"
              gradient="#000000"
              status={null}
              comingSoon
            />
          </SimpleGrid>
        )}

        <Divider my={4} />

        <HStack justify="space-between" align="center">
          <HStack spacing={3}>
            <Box w="8px" h="8px" borderRadius="full" bg={brand.syncSettings?.autoSyncEnabled ? 'green.400' : 'gray.300'} />
            <Box>
              <Text fontSize="sm" fontWeight="700" color="brand.ink">
                Auto-sync is {brand.syncSettings?.autoSyncEnabled ? 'ON' : 'OFF'}
              </Text>
              <Text fontSize="xs" color="brand.muted">
                {brand.syncSettings?.autoSyncEnabled
                  ? `Catalog every ${brand.syncSettings?.catalogCadenceHours || 24}h · Posts every ${brand.syncSettings?.postsCadenceHours || 1}h`
                  : 'Schedule disabled — toggle it in Automation Engine'}
              </Text>
            </Box>
          </HStack>
          <Button size="sm" variant="outline" onClick={syncNow} isLoading={syncing} leftIcon={<RefreshIcon />}>
            Sync Now
          </Button>
        </HStack>
      </CardBody>

      <IGPickerModal
        isOpen={!!igPickerCredId}
        onClose={() => setIgPickerCredId(null)}
        credentialId={igPickerCredId}
        onCompleted={refresh}
      />
      <AdsPickerModal
        isOpen={!!adsPickerCredId}
        onClose={() => setAdsPickerCredId(null)}
        credentialId={adsPickerCredId}
        onCompleted={refresh}
      />
    </Card>
  );
});

function IntegrationTile({
  label, gradient, status, onConnect, onDisconnect, onManage, comingSoon
}: {
  kind: IntegrationKind;       // accepted for caller readability; not used inside
  label: string;
  gradient: string;
  status: StatusRow | null;
  onConnect?:    () => void;
  onDisconnect?: (credentialId: string) => void;
  onManage?:     (credentialId: string) => void;
  comingSoon?:   boolean;
}) {
  const cred = status?.credential || null;
  const isConnected = !!cred && cred.status === 'active';
  const isPending   = !!cred && cred.status === 'pending';
  const accountLabel = cred?.igUsername      ? `@${cred.igUsername}`
                    : cred?.pageName        ? cred.pageName
                    : cred?.selectedAdAccountName ? cred.selectedAdAccountName
                    : cred?.accountLabel    ? cred.accountLabel
                    : null;
  const lastSynced = cred?.lastUsedAt ? timeSince(cred.lastUsedAt) : null;

  return (
    <Box
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="lg"
      p={3}
      bg="brand.surface"
      h="100%"
    >
      <HStack spacing={3} align="flex-start" mb={2}>
        <Box
          w="36px" h="36px"
          flexShrink={0}
          borderRadius="md"
          bg={typeof gradient === 'string' && gradient.startsWith('linear') ? undefined : gradient}
          bgImage={typeof gradient === 'string' && gradient.startsWith('linear') ? gradient : undefined}
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="white"
          fontWeight="800"
          fontSize="lg"
        >
          {label.charAt(0)}
        </Box>
        <Box flex={1} minW={0}>
          <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{label}</Text>
          <StatusBadge connected={isConnected} pending={isPending} comingSoon={comingSoon} />
        </Box>
      </HStack>

      <VStack align="stretch" spacing={1} mb={3} minH="40px">
        {accountLabel && (
          <Text fontSize="xs" color="brand.ink" noOfLines={1}>{accountLabel}</Text>
        )}
        {lastSynced && (
          <Text fontSize="xs" color="brand.muted">Last synced {lastSynced}</Text>
        )}
        {isPending && (
          <Text fontSize="10px" color="orange.600">Setup incomplete — finish on the legacy Brand page.</Text>
        )}
        {comingSoon && (
          <Text fontSize="10px" color="brand.muted" fontStyle="italic">Provider integration not yet wired.</Text>
        )}
      </VStack>

      {comingSoon ? (
        <Button size="xs" variant="outline" w="100%" isDisabled>Connect</Button>
      ) : isConnected || isPending ? (
        <HStack spacing={2}>
          <Button
            size="xs"
            variant={isPending ? 'brand' : 'outline'}
            flex={1}
            onClick={() => cred && onManage?.(cred.id)}
          >
            {isPending ? 'Finish setup' : 'Manage'}
          </Button>
          <Button
            size="xs"
            variant="outline"
            colorScheme="red"
            flex={1}
            onClick={() => cred && onDisconnect?.(cred.id)}
          >
            Disconnect
          </Button>
        </HStack>
      ) : (
        <Button size="xs" variant="brand" w="100%" onClick={onConnect}>Connect</Button>
      )}
    </Box>
  );
}

function StatusBadge({ connected, pending, comingSoon }: { connected: boolean; pending: boolean; comingSoon?: boolean }) {
  if (comingSoon) return <Badge fontSize="9px" colorScheme="gray" variant="subtle">Coming soon</Badge>;
  if (pending)    return <Badge fontSize="9px" colorScheme="orange" variant="subtle">Pending setup</Badge>;
  if (connected)  return <Badge fontSize="9px" colorScheme="green" variant="subtle">Connected</Badge>;
  return <Badge fontSize="9px" colorScheme="gray" variant="subtle">Not connected</Badge>;
}

function timeSince(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60)  return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch { return iso; }
}

function RefreshIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.7 10h-2.06A6 6 0 1 1 12 6a5.95 5.95 0 0 1 4.22 1.78L13 11h7V4l-2.35 2.35z" /></Icon>;
}
