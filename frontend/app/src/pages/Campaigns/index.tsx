// Campaigns page — primary nav entry for the campaign-driven ad-gen flow.
//
// Lists synced campaigns from Campaign collection (populated by
// services/campaignSyncService → metaAdsCampaignService /
// googleAdsCampaignService adapters). The picker save fires an
// initial sync; "Sync now" triggers a re-fetch on demand.

import { useEffect, useState, useCallback } from 'react';
import {
  Card, CardBody, VStack, HStack, Text, Heading, Button, Badge, Box, Spinner, useToast
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';

type Campaign = {
  id:            string;
  platform:      'meta-ads' | 'google-ads' | string;
  externalId:    string;
  name:          string;
  status:        string | null;
  objective:     string | null;
  budget:        { dailyMicros: number | null; lifetimeMicros: number | null; currency: string | null } | null;
  schedule:      { start: string | null; end: string | null } | null;
  productSetIds: string[];
  adSetCount:    number;
  adCount:       number;
  lastSyncedAt:  string | null;
};

export function CampaignsPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [error,   setError]       = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ campaigns: Campaign[] }>('/api/campaigns');
      setCampaigns(res.campaigns || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const syncAll = async () => {
    setSyncing(true);
    try {
      const results = await Promise.allSettled([
        apiJson('/api/integrations/meta-ads/sync-campaigns',  { method: 'POST' }),
        apiJson('/api/integrations/google-ads/sync-campaigns', { method: 'POST' })
      ]);
      const okCount = results.filter(r => r.status === 'fulfilled').length;
      toast({
        title: okCount > 0 ? 'Sync started' : 'No active integrations',
        description: okCount > 0
          ? 'Campaigns are refreshing from connected ad platforms.'
          : 'Connect Meta Ads or Google Ads to sync campaigns.',
        status: okCount > 0 ? 'success' : 'info',
        duration: 3500
      });
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Step 2 / 3"
        title="Campaigns"
        description="Connected campaigns from Meta Ads and Google Ads. Pick one to generate a fresh batch of ads."
      />

      <HStack justify="space-between" align="center">
        <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
          Synced campaigns {!loading && campaigns.length > 0 && `(${campaigns.length})`}
        </Heading>
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="outline"
            onClick={syncAll}
            isLoading={syncing}
            loadingText="Syncing…"
          >
            Sync now
          </Button>
          <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
            Generate Ads
          </Button>
        </HStack>
      </HStack>

      {loading ? (
        <Card variant="outline">
          <CardBody>
            <HStack py={6} justify="center"><Spinner /><Text fontSize="sm" color="brand.muted">Loading campaigns…</Text></HStack>
          </CardBody>
        </Card>
      ) : error ? (
        <Card variant="outline">
          <CardBody>
            <Text color="red.600" fontSize="sm">{error}</Text>
          </CardBody>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No campaigns synced yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="lg">
                Connect Meta Ads or Google Ads to pull your campaigns.
              </Text>
              <Text color="brand.muted" fontSize="sm" maxW="520px" mx="auto">
                Once a credential lands here, the initial sync runs automatically.
                You can also click Sync now anytime to refresh from the platform.
              </Text>
              <HStack justify="center" spacing={2} pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="sm">
                  Connect integrations
                </Button>
                <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
                  Start without a campaign
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <VStack align="stretch" spacing={3}>
          {campaigns.map(c => (
            <CampaignRow key={c.id} campaign={c} />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function CampaignRow({ campaign: c }: { campaign: Campaign }) {
  const platformLabel = c.platform === 'meta-ads' ? 'Meta'
                      : c.platform === 'google-ads' ? 'Google'
                      : c.platform;
  const statusColor = !c.status ? 'gray'
                    : /active|enabled/i.test(c.status) ? 'green'
                    : /paused/i.test(c.status) ? 'yellow'
                    : /deleted|archived/i.test(c.status) ? 'red'
                    : 'gray';
  const productSetCount = c.productSetIds?.length || 0;
  const dailyBudget = formatBudget(c.budget?.dailyMicros, c.budget?.currency);
  const lifetimeBudget = formatBudget(c.budget?.lifetimeMicros, c.budget?.currency);

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" align="flex-start">
          <Box flex={1} minW={0}>
            <HStack spacing={2} wrap="wrap">
              <Text fontWeight="700" color="brand.ink" noOfLines={1}>{c.name}</Text>
              <Badge fontSize="9px" colorScheme="purple" variant="subtle">{platformLabel}</Badge>
              {c.status && (
                <Badge fontSize="9px" colorScheme={statusColor} variant="subtle">{c.status}</Badge>
              )}
              {c.objective && (
                <Badge fontSize="9px" colorScheme="gray" variant="outline">{c.objective}</Badge>
              )}
            </HStack>
            <HStack spacing={3} mt={1.5} fontSize="11px" color="brand.muted" wrap="wrap">
              <Text>{c.adSetCount} ad set{c.adSetCount === 1 ? '' : 's'}</Text>
              <Text>·</Text>
              <Text>{c.adCount} ad{c.adCount === 1 ? '' : 's'}</Text>
              {productSetCount > 0 && (
                <>
                  <Text>·</Text>
                  <Text>{productSetCount} product set{productSetCount === 1 ? '' : 's'}</Text>
                </>
              )}
              {dailyBudget && (
                <>
                  <Text>·</Text>
                  <Text>{dailyBudget}/day</Text>
                </>
              )}
              {!dailyBudget && lifetimeBudget && (
                <>
                  <Text>·</Text>
                  <Text>{lifetimeBudget} lifetime</Text>
                </>
              )}
              {c.lastSyncedAt && (
                <>
                  <Text>·</Text>
                  <Text>Synced {timeSince(c.lastSyncedAt)}</Text>
                </>
              )}
            </HStack>
          </Box>
          <Button
            as={RouterLink}
            to={`/generate-ads?campaignId=${c.id}`}
            variant="brand"
            size="sm"
            flexShrink={0}
          >
            Generate Ads
          </Button>
        </HStack>
      </CardBody>
    </Card>
  );
}

function formatBudget(micros: number | null | undefined, currency: string | null | undefined): string | null {
  if (!micros || !Number.isFinite(micros)) return null;
  const amount = micros / 1_000_000;
  const cur = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${cur}`;
  }
}

function timeSince(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
