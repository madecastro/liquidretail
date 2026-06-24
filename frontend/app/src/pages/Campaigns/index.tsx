// Campaigns page — primary nav entry for the campaign-driven ad-gen flow.
//
// Lists synced campaigns from Campaign collection (populated by
// services/campaignSyncService → metaAdsCampaignService /
// googleAdsCampaignService adapters). The picker save fires an
// initial sync; "Sync now" triggers a re-fetch on demand.

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Card, CardBody, VStack, HStack, Text, Button, Badge, Box, Spinner, Image, Progress,
  Tooltip, useToast, useDisclosure, SimpleGrid, Select, Input, InputGroup, InputLeftElement
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { NewCampaignModal } from './NewCampaignModal';
import { useAdReadiness, type AdReadiness } from '../../brand/useAdReadiness';
import { useBrand } from '../../brand/BrandContext';

// Legacy Campaign / CampaignInsights types were retired with the
// product-ads-style redesign — the new endpoint /api/campaigns/ads-summary
// returns CampaignSummary + CampaignRowData (defined below). The legacy
// /api/campaigns endpoint still serves the original projection for the
// detail page consumer.

// Shape returned by GET /api/campaigns/ads-summary — drives the new
// product-ads-style table layout.
type CampaignSummary = {
  totalCampaigns:      number;
  campaignsWithAds:    number;
  campaignCoveragePct: number;
  adsCreated:          number;
  adsReadyToExport:    number;
  goodOpportunities:   number | null;
};

type CampaignRowData = {
  campaignId:        string;
  name:              string;
  status:            string | null;
  kind:              string | null;
  platform:          string | null;
  thumbUrl:          string | null;
  productCount:      number;
  productsWithAds:   number;
  ugcCount:          number;
  adCount:           number;
  readyToExport:     number;
  coveragePct:       number;
  channels:          string[];
  opportunityScore:  number | null;
  lastActivityAt:    string | null;
  lastActivityLabel: string;
  isExpired:         boolean;
};

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60)   return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60)   return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24)    return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function coverageLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'Excellent', color: 'green' };
  if (pct >= 60) return { label: 'Good',      color: 'green' };
  if (pct >= 30) return { label: 'Moderate',  color: 'orange' };
  if (pct >  0)  return { label: 'Low',       color: 'orange' };
  return         { label: 'No ads',           color: 'gray' };
}

// Compose the tooltip body when ad-readiness blocks a button. Lists
// each blocker on its own line. Shown via Chakra Tooltip when the user
// hovers the disabled trigger.
function readinessTooltip(r: AdReadiness): string {
  if (r.ready) return '';
  const lines = (r.blockers || []).map(b => `• ${b.message}`);
  return [r.reason, ...lines].filter(Boolean).join('\n');
}

export function CampaignsPage() {
  const toast = useToast();
  const newCampaignModal = useDisclosure();
  const [params, setParams] = useSearchParams();
  const readiness = useAdReadiness();
  const gateDisabled = !readiness.ready;
  const gateTip = readinessTooltip(readiness);

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
  const { activeBrand } = useBrand();
  const activeBrandId = activeBrand?.id ?? null;
  const navigate = useNavigate();

  const [summary, setSummary]   = useState<CampaignSummary | null>(null);
  const [rows, setRows]         = useState<CampaignRowData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  // Filters (search + 3 dropdowns) — applied client-side over the
  // rows. The endpoint returns everything for the brand; with hundreds
  // of campaigns we can revisit server-side pagination + filter.
  const [search, setSearch]                   = useState('');
  const [statusFilter, setStatusFilter]       = useState('');
  const [channelFilter, setChannelFilter]     = useState('');
  const [oppFilter, setOppFilter]             = useState('');

  // Per-row Refresh-Ads in-flight tracking — keyed by campaignId so
  // multiple Refresh clicks don't collide with each other.
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ summary: CampaignSummary; campaigns: CampaignRowData[] }>(
        `/api/campaigns/ads-summary?brandId=${encodeURIComponent(activeBrandId)}`
      );
      setSummary(res.summary);
      setRows(res.campaigns || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Filter the rows client-side. Status / channel / opportunity-bucket
  // dropdowns combine with the search input via AND.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (statusFilter) {
        const status = (r.status || '').toUpperCase();
        if (statusFilter === 'ACTIVE'  && !/ACTIVE|ENABLED/.test(status)) return false;
        if (statusFilter === 'PAUSED'  && !/PAUSED/.test(status))         return false;
        if (statusFilter === 'EXPIRED' && !r.isExpired)                   return false;
      }
      if (channelFilter && !r.channels.includes(channelFilter))          return false;
      if (oppFilter) {
        const s = r.opportunityScore;
        if (oppFilter === 'strong'   && !(s != null && s >= 70))         return false;
        if (oppFilter === 'moderate' && !(s != null && s >= 40 && s < 70)) return false;
        if (oppFilter === 'low'      && !(s != null && s < 40))          return false;
        if (oppFilter === 'unscored' && s != null)                       return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, channelFilter, oppFilter]);

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setChannelFilter('');
    setOppFilter('');
  }

  const generateForCampaign = (campaignId: string) => {
    navigate(`/generate-ads?campaignId=${encodeURIComponent(campaignId)}`);
  };

  const refreshAdsForCampaign = async (campaignId: string) => {
    setRefreshing(prev => { const next = new Set(prev); next.add(campaignId); return next; });
    try {
      const res = await apiJson<{ campaignRunId: string }>('/api/ads/runs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ campaignId })
      });
      toast({
        title:       'Refresh started',
        description: 'Draining queued ads — opening run progress.',
        status:      'success',
        duration:    2500
      });
      navigate(`/ads?campaignRunId=${encodeURIComponent(res.campaignRunId)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 422 means no queued ads left — common, treat as info not error.
      const isEmpty = /no queued ads remaining/i.test(msg);
      toast({
        title:       isEmpty ? 'Nothing queued' : 'Refresh failed',
        description: isEmpty ? 'This campaign has no queued ads to render. Use Generate Ads to queue more.' : msg,
        status:      isEmpty ? 'info' : 'error',
        duration:    isEmpty ? 4000 : 6000
      });
    } finally {
      setRefreshing(prev => { const next = new Set(prev); next.delete(campaignId); return next; });
    }
  };

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

  if (!activeBrandId) {
    return (
      <VStack align="stretch" spacing={4}>
        <PageHeader title="Campaigns" description="Manage campaign-level ad generation and exports at scale." />
        <Card variant="outline"><CardBody><Text fontSize="sm" color="brand.muted">Select a brand to continue.</Text></CardBody></Card>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="flex-start">
        <PageHeader title="Campaigns" description="Manage campaign-level ad generation and exports at scale." />
        <HStack spacing={2}>
          {/* Phase 3 placeholder — automation rules engine. The button
              is visible so the affordance is discoverable; clicking
              toasts that the feature is on the roadmap. Real
              automation lives in docs/backlog.csv. */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast({
              title: 'Automation rules are coming',
              description: 'Cron-driven triggers + actions land in Phase 3 (see backlog).',
              status: 'info',
              duration: 3500
            })}
          >
            Automation
          </Button>
          <Tooltip label={gateTip} isDisabled={!gateDisabled} hasArrow whiteSpace="pre-line">
            {gateDisabled
              ? <Button variant="brand" size="sm" isDisabled>Generate Ads</Button>
              : <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">Generate Ads</Button>
            }
          </Tooltip>
        </HStack>
      </HStack>

      {/* ── KPI tiles ─────────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <CampaignKpiTile
          label="Campaign Coverage"
          value={summary ? `${summary.campaignCoveragePct}%` : '—'}
          sub={summary ? `${summary.campaignsWithAds} of ${summary.totalCampaigns} campaigns` : ''}
          progressPct={summary?.campaignCoveragePct ?? null}
        />
        <CampaignKpiTile
          label="Good Opportunities"
          value={summary?.goodOpportunities ?? '—'}
          sub="Campaigns with high opportunity score"
          tooltip="Phase 2 — opportunity scoring engine (see backlog)"
        />
        <CampaignKpiTile
          label="Ads Created"
          value={summary?.adsCreated ?? '—'}
          sub="Total ads generated"
        />
        <CampaignKpiTile
          label="Ready to Export"
          value={summary?.adsReadyToExport ?? '—'}
          sub="Ads ready to push"
        />
      </SimpleGrid>

      {/* ── Filter bar — search + status + channel + opportunity ── */}
      <Card variant="outline">
        <CardBody py={3}>
          <HStack spacing={3} wrap="wrap">
            <InputGroup size="sm" maxW="280px" flex="1 1 220px">
              <InputLeftElement pointerEvents="none" fontSize="xs" color="brand.muted">🔍</InputLeftElement>
              <Input
                placeholder="Search campaigns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Select size="sm" maxW="170px" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="EXPIRED">Expired</option>
            </Select>
            <Select size="sm" maxW="170px" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="">All Channels</option>
              <option value="Meta">Meta</option>
              <option value="Google">Google</option>
              <option value="TikTok">TikTok</option>
            </Select>
            <Select size="sm" maxW="210px" value={oppFilter} onChange={(e) => setOppFilter(e.target.value)}>
              <option value="">All Opportunity Scores</option>
              <option value="strong">Strong (≥70)</option>
              <option value="moderate">Moderate (40–69)</option>
              <option value="low">Low (&lt;40)</option>
              <option value="unscored">Unscored</option>
            </Select>
            {(search || statusFilter || channelFilter || oppFilter) && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>
            )}
            <Box flex="1 1 0" />
            <Button size="sm" variant="outline" onClick={syncAll} isLoading={syncing} loadingText="Syncing…">
              Sync now
            </Button>
            <Tooltip label={gateTip} isDisabled={!gateDisabled} hasArrow whiteSpace="pre-line">
              <Button size="sm" variant="outline" onClick={newCampaignModal.onOpen} isDisabled={gateDisabled}>
                + New campaign
              </Button>
            </Tooltip>
          </HStack>
        </CardBody>
      </Card>

      {/* Legacy: gate banner + new-campaign modal */}
      <HStack justify="space-between" align="center" display="none">
        <Box />
        <Box />
      </HStack>

      {/* Account-setup gate banner — unchanged from the legacy
          layout; preserves the onboarding nudge when the brand
          isn't ad-ready yet. */}
      {gateDisabled && !readiness.loading && (
        <Card variant="outline" borderColor="orange.300" bg="orange.50">
          <CardBody py={3}>
            <VStack align="stretch" spacing={1}>
              <Text fontSize="11px" fontWeight="700" color="orange.700" textTransform="uppercase" letterSpacing="0.06em">
                Account setup incomplete
              </Text>
              <Text fontSize="sm" color="brand.ink">{readiness.reason}</Text>
              {readiness.blockers.length > 0 && (
                <VStack align="stretch" spacing={0.5} pt={1}>
                  {readiness.blockers.map(b => (
                    <Text key={b.code} fontSize="11px" color="brand.muted">• {b.message}</Text>
                  ))}
                </VStack>
              )}
              <HStack pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="xs">
                  Open onboarding status
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      <NewCampaignModal isOpen={newCampaignModal.isOpen} onClose={newCampaignModal.onClose} />

      {/* ── Table ────────────────────────────────────────────────── */}
      {loading && (
        <Card variant="outline">
          <CardBody>
            <HStack py={6} justify="center"><Spinner /><Text fontSize="sm" color="brand.muted">Loading campaigns…</Text></HStack>
          </CardBody>
        </Card>
      )}
      {error && !loading && (
        <Card variant="outline"><CardBody><Text fontSize="sm" color="red.600">{error}</Text></CardBody></Card>
      )}
      {!loading && !error && rows.length === 0 && (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No campaigns synced yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="lg">
                Connect Meta Ads or Google Ads, or create a new campaign.
              </Text>
              <HStack justify="center" spacing={2} pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="sm">Connect integrations</Button>
                <Tooltip label={gateTip} isDisabled={!gateDisabled} hasArrow whiteSpace="pre-line">
                  <Button onClick={newCampaignModal.onOpen} variant="brand" size="sm" isDisabled={gateDisabled}>
                    New campaign
                  </Button>
                </Tooltip>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}
      {!loading && !error && rows.length > 0 && (
        <Card variant="outline">
          <CardBody p={0}>
            {/* Column header */}
            <HStack
              px={4}
              py={3}
              spacing={4}
              fontSize="11px"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.06em"
              color="brand.muted"
              borderBottomWidth="1px"
              borderColor="brand.border"
            >
              <Box flex="2.4 1 0">Campaign</Box>
              <Box flex="1.4 1 0">Coverage</Box>
              <Box flex="0.7 1 0" textAlign="center">Products</Box>
              <Box flex="0.7 1 0" textAlign="center">UGC</Box>
              <Box flex="0.7 1 0" textAlign="center">Ads</Box>
              <Box flex="0.9 1 0">Opportunity</Box>
              <Box flex="1.1 1 0">Last Activity</Box>
              <Box flex="1.6 1 0" textAlign="right">Actions</Box>
            </HStack>

            <VStack align="stretch" spacing={0} divider={<Box borderTopWidth="1px" borderColor="brand.border" />}>
              {filteredRows.map(r => (
                <CampaignRow
                  key={r.campaignId}
                  row={r}
                  gateDisabled={gateDisabled}
                  isRefreshing={refreshing.has(r.campaignId)}
                  onGenerate={() => generateForCampaign(r.campaignId)}
                  onRefreshAds={() => refreshAdsForCampaign(r.campaignId)}
                  onView={() => navigate(`/campaigns/${encodeURIComponent(r.campaignId)}`)}
                />
              ))}
            </VStack>

            {/* Pagination strip — purely informational for v1; no
                server-side paging yet (the brand's full set comes back
                in one query). Add real pagination if catalogs exceed
                ~200 campaigns. */}
            <HStack px={4} py={3} justify="space-between" borderTopWidth="1px" borderColor="brand.border" fontSize="11px" color="brand.muted">
              <Text>
                Showing {filteredRows.length} of {rows.length} campaign{rows.length === 1 ? '' : 's'}
                {filteredRows.length !== rows.length && ' (filtered)'}
              </Text>
              <Box />
            </HStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function CampaignKpiTile({
  label, value, sub, progressPct, tooltip
}: {
  label:        string;
  value:        number | string;
  sub?:         string;
  progressPct?: number | null;
  tooltip?:     string;
}) {
  return (
    <Card variant="outline" title={tooltip || undefined}>
      <CardBody py={3} px={4}>
        <Text fontSize="10px" fontWeight="800" textTransform="uppercase" letterSpacing="0.08em" color="brand.muted" mb={1}>
          {label}
        </Text>
        <Text fontSize="2xl" fontWeight="800" color="brand.ink" lineHeight="1.1">
          {value}
        </Text>
        {sub && <Text fontSize="11px" color="brand.muted" mt={0.5} noOfLines={1}>{sub}</Text>}
        {typeof progressPct === 'number' && (
          <Progress value={progressPct} size="xs" colorScheme="purple" mt={2} borderRadius="md" />
        )}
      </CardBody>
    </Card>
  );
}

function CampaignRow({
  row, gateDisabled, isRefreshing, onGenerate, onRefreshAds, onView
}: {
  row:          CampaignRowData;
  gateDisabled: boolean;
  isRefreshing: boolean;
  onGenerate:   () => void;
  onRefreshAds: () => void;
  onView:       () => void;
}) {
  const cov = coverageLabel(row.coveragePct);
  const status = (row.status || '').toUpperCase();
  const isActive = /ACTIVE|ENABLED/.test(status);
  const isPaused = /PAUSED/.test(status);
  const statusColor = row.isExpired ? 'red' : isActive ? 'green' : isPaused ? 'yellow' : 'gray';
  const statusLabel = row.isExpired ? 'Expired'
                    : isActive ? 'Active'
                    : isPaused ? 'Paused'
                    : (row.status || 'Unknown');

  // Primary action depends on state:
  //   active + has ads + has queued inventory → Refresh Ads (best CTA)
  //   active + has ads + nothing queued        → Generate Ads (need more)
  //   paused / expired                         → View Campaign (read-only)
  // We don't have queuedRemaining yet on this row, so fall back to:
  //   paused/expired   → View
  //   has ads          → Refresh (will toast if nothing queued)
  //   no ads           → Generate
  const primaryActionLabel = (isPaused || row.isExpired) ? 'View Campaign'
                           : row.adCount > 0 ? 'Refresh Ads'
                           : 'Generate Ads';
  const primaryAction = (isPaused || row.isExpired) ? onView
                      : row.adCount > 0 ? onRefreshAds
                      : onGenerate;
  const primaryDisabled = gateDisabled && primaryActionLabel !== 'View Campaign';

  return (
    <HStack px={4} py={3} spacing={4} align="center" _hover={{ bg: 'gray.50' }}>
      <HStack flex="2.4 1 0" spacing={3} align="center" minW={0}>
        {row.thumbUrl ? (
          <Image
            src={row.thumbUrl}
            alt={row.name}
            boxSize="48px"
            objectFit="cover"
            borderRadius="md"
            borderWidth="1px"
            borderColor="brand.border"
            flexShrink={0}
          />
        ) : (
          <Box boxSize="48px" bg="gray.100" borderRadius="md" flexShrink={0} />
        )}
        <VStack align="stretch" spacing={0} minW={0}>
          <HStack spacing={1.5}>
            <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{row.name}</Text>
          </HStack>
          <HStack spacing={1.5} mt={0.5}>
            <Badge fontSize="9px" colorScheme={statusColor} variant="subtle">{statusLabel}</Badge>
            {row.channels.length > 0 && (
              <Text fontSize="10px" color="brand.muted" noOfLines={1}>{row.channels.join(', ')}</Text>
            )}
            {row.channels.length === 0 && row.platform && (
              <Text fontSize="10px" color="brand.muted">{row.platform}</Text>
            )}
          </HStack>
        </VStack>
      </HStack>
      <Box flex="1.4 1 0">
        <Text fontSize="sm" fontWeight="700" color={cov.color === 'gray' ? 'brand.muted' : 'brand.ink'}>
          {row.coveragePct}%
        </Text>
        <Progress value={row.coveragePct} size="xs" colorScheme={cov.color === 'gray' ? 'gray' : cov.color === 'orange' ? 'orange' : 'green'} mt={1} borderRadius="md" />
        <Text fontSize="10px" color="brand.muted" mt={0.5}>{cov.label}</Text>
      </Box>
      <Box flex="0.7 1 0" textAlign="center">
        <Text fontSize="sm" fontWeight="700" color="brand.ink">{row.productCount}</Text>
      </Box>
      <Box flex="0.7 1 0" textAlign="center">
        <Text fontSize="sm" fontWeight="700" color="brand.ink">{row.ugcCount}</Text>
      </Box>
      <Box flex="0.7 1 0" textAlign="center">
        <Text fontSize="sm" fontWeight="700" color="brand.ink">{row.adCount}</Text>
        {row.readyToExport > 0 && <Text fontSize="10px" color="brand.muted">{row.readyToExport} ready</Text>}
      </Box>
      <Box flex="0.9 1 0">
        {row.opportunityScore == null ? (
          <Text fontSize="11px" color="brand.muted">—</Text>
        ) : (
          <Text fontSize="sm" fontWeight="700" color={
            row.opportunityScore >= 70 ? 'green.600'
          : row.opportunityScore >= 40 ? 'orange.500'
          :                              'red.500'
          }>{row.opportunityScore}</Text>
        )}
      </Box>
      <Box flex="1.1 1 0">
        <Text fontSize="11px" color="brand.muted">{relativeTime(row.lastActivityAt)}</Text>
        <Text fontSize="10px" color="brand.muted" noOfLines={1}>{row.lastActivityLabel}</Text>
      </Box>
      <HStack flex="1.6 1 0" justify="flex-end" spacing={1}>
        <Button
          size="xs"
          variant="outline"
          onClick={primaryAction}
          isLoading={primaryActionLabel === 'Refresh Ads' && isRefreshing}
          isDisabled={primaryDisabled}
        >
          {primaryActionLabel}
        </Button>
        {primaryActionLabel !== 'View Campaign' && (
          <Button size="xs" variant="ghost" onClick={onView}>View</Button>
        )}
      </HStack>
    </HStack>
  );
}

