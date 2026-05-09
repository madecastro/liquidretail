// Campaigns page — primary nav entry for the campaign-driven ad-gen flow.
//
// Lists synced campaigns from Campaign collection (populated by
// services/campaignSyncService → metaAdsCampaignService /
// googleAdsCampaignService adapters). The picker save fires an
// initial sync; "Sync now" triggers a re-fetch on demand.

import { useEffect, useState, useCallback } from 'react';
import {
  Card, CardBody, VStack, HStack, Text, Heading, Button, Badge, Box, Spinner,
  useToast, useDisclosure
} from '@chakra-ui/react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { NewCampaignModal } from './NewCampaignModal';

export type CampaignInsights = {
  impressions:           number | null;
  reach:                 number | null;
  clicks:                number | null;
  ctr:                   number | null;
  cpcMicros:             number | null;
  cpmMicros:             number | null;
  spendMicros:           number | null;
  frequency:             number | null;
  conversions:           number | null;
  conversionValueMicros: number | null;
  videoViews:            number | null;
  currency:              string | null;
  rangeDays:             number | null;
  fetchedAt:             string | null;
};

type Campaign = {
  id:            string;
  platform:      'meta-ads' | 'google-ads' | string;
  externalId:    string;
  name:          string;
  status:        string | null;
  objective:     string | null;
  kind:          string | null;

  budget:        { dailyMicros: number | null; lifetimeMicros: number | null; currency: string | null } | null;
  schedule:      { start: string | null; end: string | null } | null;
  productSetIds: string[];
  matchedProductCount: number;
  mediaCount:        number;
  adSetCount:    number;
  adCount:       number;          // platform-side ad-set ad count (synced campaigns)
  renderedAdCount:   number;      // in-app rendered creatives for this campaign
  insights:      CampaignInsights | null;
  lastSyncedAt:  string | null;
};

export function CampaignsPage() {
  const toast = useToast();
  const newCampaignModal = useDisclosure();
  const [params, setParams] = useSearchParams();

  // Auto-open the New Campaign modal when the page is reached via
  // /campaigns?new=1 (e.g. the Media Library's "Add to Campaign →
  // + New campaign…" affordance). Strip the param after opening so
  // a refresh doesn't re-trigger.
  useEffect(() => {
    if (params.get('new') === '1') {
      newCampaignModal.onOpen();
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          <Button size="sm" variant="outline" onClick={newCampaignModal.onOpen}>
            New campaign
          </Button>
          <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
            Generate Ads
          </Button>
        </HStack>
      </HStack>

      <NewCampaignModal isOpen={newCampaignModal.isOpen} onClose={newCampaignModal.onClose} />

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
                <Button onClick={newCampaignModal.onOpen} variant="brand" size="sm">
                  New campaign
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
    <Card
      as={RouterLink}
      to={`/campaigns/${c.id}`}
      variant="outline"
      _hover={{ borderColor: 'rsViolet.300', transform: 'translateY(-1px)', boxShadow: 'sm' }}
      transition="all 120ms"
    >
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
              <Text>{c.matchedProductCount} product{c.matchedProductCount === 1 ? '' : 's'}</Text>
              <Text>·</Text>
              <Text>{c.mediaCount || 0} media</Text>
              <Text>·</Text>
              <Text fontWeight={c.renderedAdCount > 0 ? '700' : '400'} color={c.renderedAdCount > 0 ? 'rsViolet.600' : 'brand.muted'}>
                {c.renderedAdCount} rendered ad{c.renderedAdCount === 1 ? '' : 's'}
              </Text>
              {c.adSetCount > 0 && (
                <>
                  <Text>·</Text>
                  <Text>{c.adSetCount} platform ad set{c.adSetCount === 1 ? '' : 's'}</Text>
                </>
              )}
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
            {c.insights && <InsightsRow insights={c.insights} fallbackCurrency={c.budget?.currency || null} />}
          </Box>
          <Button
            as={RouterLink}
            to={`/generate-ads?campaignId=${c.id}&step=${c.kind === 'brand' ? 'settings' : 'products'}`}
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

function InsightsRow({ insights, fallbackCurrency }: { insights: CampaignInsights; fallbackCurrency: string | null }) {
  const cur = insights.currency || fallbackCurrency || 'USD';
  const cells: Array<{ label: string; value: string | null }> = [
    { label: 'Spend',       value: formatMicrosCurrency(insights.spendMicros, cur) },
    { label: 'Impressions', value: formatCompact(insights.impressions) },
    { label: 'Clicks',      value: formatCompact(insights.clicks) },
    { label: 'CTR',         value: formatPercent(insights.ctr) },
    { label: 'CPC',         value: formatMicrosCurrency(insights.cpcMicros, cur) },
    { label: 'Conv.',       value: formatCompact(insights.conversions) }
  ];
  const present = cells.filter(c => c.value);
  if (present.length === 0) return null;
  return (
    <HStack spacing={4} mt={2.5} pt={2} borderTopWidth="1px" borderTopColor="brand.border" wrap="wrap">
      {present.map(c => (
        <Box key={c.label} minW="50px">
          <Text fontSize="9px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">{c.label}</Text>
          <Text fontSize="sm" fontWeight="700" color="brand.ink">{c.value}</Text>
        </Box>
      ))}
    </HStack>
  );
}

function formatMicrosCurrency(micros: number | null | undefined, currency: string | null | undefined): string | null {
  if (micros == null || !Number.isFinite(micros)) return null;
  const amount = micros / 1_000_000;
  const cur = currency || 'USD';
  try {
    const opts: Intl.NumberFormatOptions = amount >= 1000
      ? { style: 'currency', currency: cur, maximumFractionDigits: 0 }
      : { style: 'currency', currency: cur, maximumFractionDigits: 2 };
    return new Intl.NumberFormat('en-US', opts).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

function formatCompact(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000)     return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

function formatPercent(fraction: number | null | undefined): string | null {
  if (fraction == null || !Number.isFinite(fraction)) return null;
  return `${(fraction * 100).toFixed(2)}%`;
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
