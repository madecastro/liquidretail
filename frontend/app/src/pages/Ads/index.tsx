// Ads page — gallery of rendered creatives produced by the renderer.
//
// Phase 1: lists Ad docs from GET /api/ads filtered by current
// brand. Each row is a Cloudinary thumbnail + the on-doc copy
// snapshot + template/ratio/status. Click opens a detail modal.
//
// Filter state: campaignId from query string (set by the wizard's
// post-generate redirect to /ads?campaignRunId=...). campaignRunId
// scopes to a single Generate Ads click (one batch). Status filter
// defaults to "draft" since freshly-rendered ads land in draft.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardBody, VStack, HStack, Text, Heading, Button, SimpleGrid,
  Badge, Image, Box, Spinner, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, Select, Progress, useToast, Link
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// Visual treatment for the POLISHING state — slow breathing purple
// overlay so the unfinished render reads distinctly from a final ad
// at a glance. Paired with a desaturate/dim filter on the image itself.
const polishPulse = keyframes`
  0%, 100% { opacity: 0; }
  50% { opacity: 0.22; }
`;
const POLISHING_IMG_FILTER = 'grayscale(0.4) brightness(0.9) contrast(0.95)';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type AdRow = {
  id:           string;
  brandId:      string;
  campaignId:   string;
  // Every run that selected this Ad. Empty until the Ad is first
  // picked by a CampaignRun; re-render dedupe hits append the new
  // runId so /ads?campaignRunId=X always finds the Ad if it's ever
  // been part of run X.
  campaignRunIds: string[];
  mediaId:      string | null;
  productId:    string | null;
  template:     string;
  aspectRatio:  string;
  matchTier:    'product_match' | 'product_category' | 'brand_match' | 'brand_only';
  variantKind:  'product_image' | 'ugc';
  readinessScore: number | null;
  campaignKind: string | null;
  kind:         'image' | 'video';
  // What the SEED Media was, regardless of what shipped. When kind='image'
  // but sourceFileType='video', the composite failed and the ad fell back
  // to static — image-ref polish correctly skips video sources, so polish
  // never lands and POLISHING badge would otherwise stick forever.
  sourceFileType?: 'image' | 'video' | null;
  // Render-output fields null until status transitions to 'draft' or beyond.
  renderUrl:    string | null;
  // Phase B — gpt-image-1 polished version, joined from AiFullRender-
  // Artifact by the Ad's cache key. Frontend displays this instead of
  // renderUrl when useImageRefAsProduction is true AND populated.
  photorealUrl: string | null;
  useImageRefAsProduction: boolean;
  posterUrl:    string | null;
  width:        number | null;
  height:       number | null;
  bytes:        number | null;
  copy: {
    headline?:     string;
    cta_text?:     string;
    quote?:        string;
    productName?:  string;
    productPrice?: string;
  };
  ctaText:      string;
  ctaUrl:       string;
  ctaUrlParams: string;
  status:       'queued' | 'rendering' | 'draft' | 'live' | 'archived' | 'failed';
  queuedAt:     string | null;
  renderedAt:   string | null;
  generatedAt:  string;
  // Meta Ads sync — populated once the operator pushes the ad to a
  // connected Meta ad account. Drives the per-card "Synced to Meta"
  // / "Push failed" pill and the detail-modal "View on Meta" link.
  metaAdId:           string | null;
  metaAdCreativeId:   string | null;
  metaAdsetId:        string | null;
  metaCampaignId:     string | null;
  metaAdAccountId:    string | null;
  metaSyncStatus:     'synced' | 'failed' | null;
  metaSyncError:      string | null;
  metaSyncedAt:       string | null;
};

// Photoreal-only display. The HTML render still happens internally
// (it's the seed gpt-image-1 polishes from), but the tile only ever
// shows the photoreal output once it's landed. While the polish is
// still cooking we fall back to the HTML render with a POLISHING
// badge so the operator knows it's transient.
//
// Video ads always use renderUrl (the Cloudinary composite). gpt-image-1
// doesn't produce video and the backend skips image-ref for video sources,
// so photorealUrl should stay null — guarding here too in case a stale
// row exists from before the backend guard landed.
function displayUrl(ad: AdRow): string | null {
  if (ad.kind === 'video') return ad.renderUrl;
  return ad.photorealUrl || ad.renderUrl;
}

function isShowingPhotoreal(ad: AdRow): boolean {
  return ad.kind !== 'video' && !!ad.photorealUrl;
}

// True when only the HTML render has landed but the photoreal polish
// hasn't yet — used to paint a POLISHING badge so the operator knows
// the tile will refresh to the photoreal once the gpt-image-1 call
// completes. Two cases excluded:
//   1. ad.kind='video' — gpt-image-1 doesn't produce video, so
//      photorealUrl is permanently null for them.
//   2. sourceFileType='video' but the ad fell back to image (composite
//      failed) — image-ref's guard correctly skips video sources, so
//      photorealUrl will never land. Without this check the POLISHING
//      badge sticks forever on the stuck-fallback case.
function isAwaitingPolish(ad: AdRow): boolean {
  if (ad.kind === 'video') return false;
  if (ad.sourceFileType === 'video') return false;
  return !!(ad.renderUrl && !ad.photorealUrl);
}

type MetaAdsetRow = {
  adsetId:        string;
  adsetName:      string;
  adsetStatus:    string | null;
  campaignId:     string;
  campaignName:   string;
  campaignStatus: string | null;
};

type PushResult = {
  pushed: number;
  failed: number;
  perAd:  Array<{ adId: string; ok: boolean; metaAdId?: string; error?: string }>;
};

type AdsResponse = { ads: AdRow[]; total: number; limit: number; offset: number };

type RunStatus = {
  runId:           string;
  brandId:         string;
  campaignId:      string;
  total:           number;
  succeeded:       number;
  skipped:         number;
  failed:          number;
  status:          'running' | 'done' | 'failed';
  queuedRemaining: number;
  errors:          Array<{ index: number; stage: string; template: string; aspectRatio: string; message: string }>;
  startedAt:       string;
  completedAt:     string | null;
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS  = 10 * 60 * 1000;   // 10 minutes — generous for full Puppeteer batch

type CampaignOption = { id: string; name: string };

export function AdsPage() {
  const { activeBrand } = useBrand();
  const activeBrandId = activeBrand?.id || null;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const campaignRunId = params.get('campaignRunId');
  const campaignId    = params.get('campaignId');

  const [status, setStatus] = useState<string>('draft');
  const [rows, setRows]     = useState<AdRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [selected, setSelected] = useState<AdRow | null>(null);
  const [run, setRun]       = useState<RunStatus | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const detailModal = useDisclosure();

  // Meta-push selection + modal state. selectedIds holds the ad ids
  // the operator has ticked for batch push; the toolbar appears when
  // the set is non-empty. metaAdsets is fetched lazily on modal open.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metaAdsets, setMetaAdsets]   = useState<MetaAdsetRow[]>([]);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [chosenAdsetId, setChosenAdsetId] = useState<string>('');
  const [pushing, setPushing] = useState(false);
  const pushModal = useDisclosure();

  function toggleSelect(adId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(adId)) next.delete(adId); else next.add(adId);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  // Fetch the brand's Meta AdSets when the push modal opens. Always
  // fresh (don't cache across opens) so a newly-synced AdSet shows
  // up without a page reload.
  const openPushModal = async () => {
    if (!activeBrandId) return;
    setChosenAdsetId('');
    setMetaAdsets([]);
    pushModal.onOpen();
    setAdsetsLoading(true);
    try {
      const res = await apiJson<{ adsets: MetaAdsetRow[] }>(
        `/api/ads/meta-adsets?brandId=${encodeURIComponent(activeBrandId)}`
      );
      setMetaAdsets(res.adsets || []);
    } catch (e) {
      toast({
        title:       'Could not load Meta AdSets',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    } finally {
      setAdsetsLoading(false);
    }
  };

  const submitPush = async () => {
    if (!activeBrandId || !chosenAdsetId || selectedIds.size === 0) return;
    setPushing(true);
    try {
      const adIds = Array.from(selectedIds);
      const result = await apiJson<PushResult>('/api/ads/push-to-meta', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brandId: activeBrandId, adsetId: chosenAdsetId, adIds })
      });
      const summary = result.failed === 0
        ? `Pushed ${result.pushed} ad${result.pushed === 1 ? '' : 's'} as PAUSED.`
        : `Pushed ${result.pushed}, failed ${result.failed}. Check the failed pills for the error.`;
      toast({
        title:       result.failed === 0 ? 'Synced to Meta' : 'Pushed with errors',
        description: summary,
        status:      result.failed === 0 ? 'success' : 'warning',
        duration:    5000
      });
      pushModal.onClose();
      clearSelection();
      // Refresh the list so the new metaSyncStatus pills show up.
      await fetchRef.current?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title:       'Push failed',
        description: msg,
        status:      'error',
        duration:    7000
      });
    } finally {
      setPushing(false);
    }
  };

  // Group AdSets by campaign for the dropdown rendering.
  const adsetsByCampaign = useMemo(() => {
    const groups = new Map<string, { campaignName: string; adsets: MetaAdsetRow[] }>();
    for (const a of metaAdsets) {
      const k = a.campaignId;
      if (!groups.has(k)) groups.set(k, { campaignName: a.campaignName, adsets: [] });
      groups.get(k)!.adsets.push(a);
    }
    return Array.from(groups.values());
  }, [metaAdsets]);

  // Pull the brand's campaigns once per active-brand change for the
  // campaign filter dropdown. Failure is silent — the dropdown just
  // shows "All campaigns" and the URL-driven campaignId still works.
  useEffect(() => {
    if (!activeBrandId) { setCampaigns([]); return; }
    let cancelled = false;
    apiJson<{ campaigns: CampaignOption[] }>(`/api/campaigns?brandId=${encodeURIComponent(activeBrandId)}`)
      .then(res => { if (!cancelled) setCampaigns(res.campaigns || []); })
      .catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, [activeBrandId]);

  const setCampaignFilter = (nextCampaignId: string) => {
    const next = new URLSearchParams(params);
    if (nextCampaignId) next.set('campaignId', nextCampaignId);
    else                next.delete('campaignId');
    // Changing the campaign filter invalidates an open run scope —
    // a run belongs to one campaign, so cross-campaign filtering
    // shouldn't keep the run-tied view in the URL.
    next.delete('campaignRunId');
    setParams(next, { replace: false });
  };

  const activeCampaignName = useMemo(
    () => campaigns.find(c => c.id === campaignId)?.name || null,
    [campaigns, campaignId]
  );

  // Reset run state when the campaignRunId param changes (e.g. user
  // bookmarks a different run, or navigates back to /ads with no run).
  useEffect(() => {
    setRun(null);
    setPollTimedOut(false);
  }, [campaignRunId]);

  // Ad list fetcher. Memoized into a stable callback via ref so the
  // poller can re-trigger it without re-running this effect.
  const fetchRef = useRef<() => Promise<void>>();

  // Mirror `rows` into a ref so the run poller can check awaiting-
  // polish state from inside its tick closure without forcing the
  // effect to re-subscribe on every row update. The poller keeps
  // ticking while ANY visible row is still waiting on its photoreal
  // — image-ref runs fire-and-forget post-persist and frequently
  // lands AFTER the run.status flips to 'done', so a poll that
  // stopped purely on run.status left photorealUrl updates stranded
  // and the operator had to manually refresh to see the polished
  // image (renderUrl → photorealUrl swap never happened in-session).
  const rowsRef = useRef<AdRow[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => {
    fetchRef.current = async () => {
      if (!activeBrandId) return;
      const qp = new URLSearchParams({ brandId: activeBrandId, limit: '120' });
      if (status)          qp.set('status', status);
      if (campaignId)      qp.set('campaignId', campaignId);
      try {
        const res = await apiJson<AdsResponse>(`/api/ads?${qp.toString()}`);
        const filtered = campaignRunId
          ? res.ads.filter(a => Array.isArray(a.campaignRunIds) && a.campaignRunIds.includes(campaignRunId))
          : res.ads;
        setRows(filtered);
        setTotal(filtered.length);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    };
  }, [activeBrandId, status, campaignId, campaignRunId]);

  // Initial / param-change ad list load.
  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      await fetchRef.current?.();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeBrandId, status, campaignId, campaignRunId]);

  // ── Status actions (Approve / Archive / Restore / Delete) ──
  // Optimistically updates local state, fires PATCH/DELETE, rolls
  // back on failure with a toast. Avoids a full gallery refetch
  // because the gallery is already showing the row we mutated.

  const [actioning, setActioning] = useState(false);

  const setAdStatus = async (ad: AdRow, nextStatus: AdRow['status']) => {
    if (!activeBrandId) return;
    setActioning(true);
    const prevRows = rows;
    const prevSelected = selected;
    setRows(prevRows.map(r => r.id === ad.id ? { ...r, status: nextStatus } : r));
    if (prevSelected?.id === ad.id) setSelected({ ...prevSelected, status: nextStatus });
    try {
      await apiJson<{ ad: AdRow }>(`/api/ads/${ad.id}?brandId=${encodeURIComponent(activeBrandId)}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: nextStatus })
      });
      toast({
        title:    nextStatus === 'live'     ? 'Ad approved'
                : nextStatus === 'archived' ? 'Ad archived'
                : 'Ad restored to draft',
        status:   'success',
        duration: 2500
      });
    } catch (e) {
      // rollback
      setRows(prevRows);
      if (prevSelected) setSelected(prevSelected);
      toast({
        title:       'Status change failed',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    } finally {
      setActioning(false);
    }
  };

  const deleteAd = async (ad: AdRow) => {
    if (!activeBrandId) return;
    const confirmed = window.confirm('Delete this ad? Removes the doc + the Cloudinary asset. Cannot be undone.');
    if (!confirmed) return;
    setActioning(true);
    const prevRows = rows;
    setRows(prevRows.filter(r => r.id !== ad.id));
    setSelected(null);
    detailModal.onClose();
    try {
      await apiJson(`/api/ads/${ad.id}?brandId=${encodeURIComponent(activeBrandId)}`, { method: 'DELETE' });
      toast({ title: 'Ad deleted', status: 'success', duration: 2500 });
    } catch (e) {
      setRows(prevRows);
      toast({
        title:       'Delete failed',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    } finally {
      setActioning(false);
    }
  };

  // Run-status poller — fires only when the URL has a campaignRunId.
  // Polls /api/ads/runs/:id, refetches the ad list each tick, and
  // stops when status flips to done|failed (or the timeout trips).
  useEffect(() => {
    if (!activeBrandId || !campaignRunId) return;
    let cancelled = false;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const next = await apiJson<RunStatus>(
          `/api/ads/runs/${encodeURIComponent(campaignRunId)}?brandId=${encodeURIComponent(activeBrandId)}`
        );
        if (cancelled) return;
        setRun(next);
        await fetchRef.current?.();
        // Keep ticking while EITHER the run is still rendering OR any
        // visible ad is still waiting on its photoreal polish. Image-
        // ref is a shadow process kicked off post-persist; it routinely
        // lands after run.status flips to 'done'. Without this second
        // condition the operator never sees the renderUrl → photorealUrl
        // swap until they manually refresh.
        const stillAwaitingPolish = rowsRef.current.some(isAwaitingPolish);
        if (next.status === 'running' || stillAwaitingPolish) {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            setPollTimedOut(true);
            return;
          }
          timer = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (e) {
        // Run lookup failed — surface the error but keep any ads we've
        // already loaded. Stop polling.
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeBrandId, campaignRunId]);

  const headline = useMemo(() => {
    if (campaignRunId) return `Latest batch — ${total} creative${total === 1 ? '' : 's'}`;
    if (campaignId)    return `Campaign — ${total} creative${total === 1 ? '' : 's'}`;
    return `${total} creative${total === 1 ? '' : 's'}`;
  }, [total, campaignId, campaignRunId]);

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Step 3 / 3"
        title="Ads"
        description="Every ad creative the renderer has produced for this brand. Filter by campaign or status; click for the full creative + copy + tracking URL."
      />

      {/* Campaign filter — primary slice of the page. Pulled out of
          the secondary toolbar and styled prominently so operators
          can re-scope the gallery at a glance. */}
      <Card variant="outline" borderColor={campaignId ? 'brand.accent' : 'brand.border'} borderWidth={campaignId ? '2px' : '1px'}>
        <CardBody py={3} px={4}>
          <HStack spacing={4} align="center" wrap="wrap">
            <Text
              fontSize="11px"
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing="0.1em"
              color="brand.muted"
              flexShrink={0}
            >
              Campaign
            </Text>
            <Select
              size="md"
              fontSize="sm"
              fontWeight="700"
              width={{ base: '100%', md: '380px' }}
              value={campaignId || ''}
              onChange={(e) => setCampaignFilter(e.target.value)}
              placeholder=""
            >
              <option value="">All campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            {campaignId && (
              <Badge colorScheme="purple" fontSize="10px" px={2} py={1} borderRadius="md">
                Filtered{activeCampaignName ? ` · ${activeCampaignName}` : ''}
              </Badge>
            )}
            <Box flex={1} />
            {campaignId && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setCampaignFilter('')}
              >
                Clear
              </Button>
            )}
          </HStack>
        </CardBody>
      </Card>

      <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
        <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
          {headline}
        </Heading>
        <HStack spacing={3}>
          <Select
            size="sm"
            width="140px"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="rendering">Rendering</option>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            <option value="archived">Archived</option>
            <option value="failed">Failed</option>
          </Select>
          <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
            Generate Ads
          </Button>
        </HStack>
      </HStack>

      {run && (
        <RunProgress
          run={run}
          timedOut={pollTimedOut}
          onGenerateMore={async () => {
            try {
              const res = await apiJson<{ campaignRunId: string }>(`/api/ads/runs`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ campaignId: run.campaignId })
              });
              const nextParams = new URLSearchParams(params);
              nextParams.set('campaignRunId', res.campaignRunId);
              nextParams.set('campaignId',    run.campaignId);
              setParams(nextParams, { replace: false });
              toast({ title: 'Next batch started', status: 'success', duration: 2500 });
            } catch (e) {
              toast({
                title:       'Could not start next batch',
                description: e instanceof Error ? e.message : String(e),
                status:      'error',
                duration:    5000
              });
            }
          }}
        />
      )}

      {loading && (
        <Box textAlign="center" py={6}>
          <Spinner size="md" />
        </Box>
      )}

      {err && (
        <Card variant="outline">
          <CardBody>
            <Text color="red.500" fontSize="sm">Failed to load ads: {err}</Text>
          </CardBody>
        </Card>
      )}

      {!loading && !err && rows.length === 0 && (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No rendered ads yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="lg">
                Run the Generate Ads wizard from a campaign to produce your first batch.
              </Text>
              <HStack justify="center" pt={2}>
                <Button as={RouterLink} to="/campaigns" variant="outline" size="sm">
                  Pick a campaign
                </Button>
                <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
                  Generate Ads
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Selection toolbar — appears once the operator ticks any
          checkbox. Image and video creatives both push; videos go
          through Meta's async upload + processing pipeline (~30s–3min
          per video) so larger video batches will take a while. */}
      {selectedIds.size > 0 && (
        <Card variant="outline" borderColor="blue.300" bg="blue.50">
          <CardBody py={3}>
            <HStack justify="space-between" align="center">
              <HStack spacing={3}>
                <Badge colorScheme="blue" fontSize="11px">
                  {selectedIds.size} selected
                </Badge>
                <Text fontSize="sm" color="brand.ink">
                  Push these ads to Meta as PAUSED creatives. Videos take a bit longer (Meta processes them async).
                </Text>
              </HStack>
              <HStack spacing={2}>
                <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
                <Button
                  size="sm"
                  variant="brand"
                  onClick={openPushModal}
                  isDisabled={!activeBrandId}
                >
                  Push {selectedIds.size} to Meta
                </Button>
              </HStack>
            </HStack>
          </CardBody>
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
          {rows.map((ad) => (
            <Card
              key={ad.id}
              variant="outline"
              cursor="pointer"
              _hover={{ borderColor: 'brand.accent', transform: 'translateY(-1px)' }}
              transition="all 120ms"
              onClick={() => { setSelected(ad); detailModal.onOpen(); }}
            >
              {/* Uniform 1:1 tile — non-square ads letterbox inside
                  the shared frame so every card in the grid matches
                  height. Detail modal below still shows the ad at
                  its native aspect ratio. */}
              <Box
                position="relative"
                bg="gray.900"
                borderTopRadius="md"
                overflow="hidden"
                style={{ aspectRatio: '1 / 1' }}
              >
                {displayUrl(ad) ? (
                  ad.kind === 'video' ? (
                    <video
                      src={displayUrl(ad) || undefined}
                      poster={ad.posterUrl || undefined}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'contain', display: 'block',
                        background: '#000'
                      }}
                    />
                  ) : (
                    <Image
                      src={displayUrl(ad) || ''}
                      alt={ad.copy.headline || ad.template}
                      width="100%"
                      height="100%"
                      objectFit="contain"
                      loading="lazy"
                      style={isAwaitingPolish(ad) ? { filter: POLISHING_IMG_FILTER } : undefined}
                    />
                  )
                ) : (
                  <Box
                    w="100%" h="100%"
                    display="flex" alignItems="center" justifyContent="center"
                    color="gray.400"
                    fontSize="11px"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                  >
                    {ad.status === 'queued' ? 'Queued' : ad.status === 'rendering' ? 'Rendering…' : ad.status === 'failed' ? 'Render failed' : 'No render'}
                  </Box>
                )}
                <Badge
                  position="absolute"
                  top={2}
                  right={2}
                  colorScheme={ad.status === 'live' ? 'green' : ad.status === 'archived' ? 'gray' : 'orange'}
                  fontSize="9px"
                  textTransform="uppercase"
                >
                  {ad.status}
                </Badge>
                {/* Selection checkbox — clickable independent of the
                    card body so toggling doesn't open the detail modal. */}
                <Box
                  position="absolute"
                  top={2}
                  left={2}
                  bg="blackAlpha.700"
                  borderRadius="md"
                  p={1}
                  cursor="pointer"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(ad.id); }}
                >
                  <Box
                    w="18px" h="18px"
                    borderRadius="sm"
                    borderWidth="2px"
                    borderColor={selectedIds.has(ad.id) ? 'blue.400' : 'whiteAlpha.700'}
                    bg={selectedIds.has(ad.id) ? 'blue.400' : 'transparent'}
                    display="flex" alignItems="center" justifyContent="center"
                    color="white"
                    fontSize="11px"
                    fontWeight="800"
                  >
                    {selectedIds.has(ad.id) ? '✓' : ''}
                  </Box>
                </Box>
                {/* POLISHING state — desaturate filter on the image
                    above plus a slow breathing purple overlay here so
                    the unfinished render reads visually distinct from
                    a final ad at a glance. Badge stays prominent. */}
                {isAwaitingPolish(ad) && (
                  <>
                    <Box
                      position="absolute"
                      inset={0}
                      bg="purple.400"
                      pointerEvents="none"
                      animation={`${polishPulse} 2.6s ease-in-out infinite`}
                    />
                    <Badge
                      position="absolute" top={2} left={10}
                      bg="purple.600" color="white"
                      fontSize="9px" px={1.5} py={0.5}
                      pointerEvents="none"
                    >
                      POLISHING…
                    </Badge>
                  </>
                )}
                {/* Phase B — Photoreal pill (top-left of tile). Now
                    fires whenever the photoreal landed (legacy toggle
                    deprecated; display always prefers photoreal). */}
                {isShowingPhotoreal(ad) && (
                  <Badge
                    position="absolute" top={2} left={2}
                    colorScheme="purple" fontSize="9px"
                    px={1.5} py={0.5}
                    pointerEvents="none"
                  >
                    PHOTOREAL
                  </Badge>
                )}
                {/* Meta sync pill — bottom-right of the tile. Synced
                    pill links to Ads Manager; failed pill surfaces the
                    error in a tooltip. */}
                {ad.metaSyncStatus === 'synced' && (
                  <Badge
                    as="a"
                    href={ad.metaAdId
                      ? `https://www.facebook.com/adsmanager/manage/ads?selected_ad_ids=${ad.metaAdId}`
                      : 'https://www.facebook.com/adsmanager'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    position="absolute" bottom={2} right={2}
                    colorScheme="blue" fontSize="9px"
                    cursor="pointer"
                  >
                    Synced ↗
                  </Badge>
                )}
                {ad.metaSyncStatus === 'failed' && (
                  <Badge
                    title={ad.metaSyncError || 'Push failed'}
                    position="absolute" bottom={2} right={2}
                    colorScheme="red" fontSize="9px"
                  >
                    Push failed
                  </Badge>
                )}
              </Box>
              <CardBody py={3}>
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between" spacing={2}>
                    <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
                      {ad.template}
                    </Text>
                    <Text fontSize="9px" color="brand.muted">{ad.aspectRatio}</Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={2}>
                    {ad.copy.headline || '—'}
                  </Text>
                  {ad.copy.productName && (
                    <Text fontSize="11px" color="brand.muted" noOfLines={1}>
                      {ad.copy.productName} {ad.copy.productPrice ? `· ${ad.copy.productPrice}` : ''}
                    </Text>
                  )}
                  {/* Dev preview — three-column render-stage comparison
                      page (LLM HTML vs Puppeteer overlay PNG vs final
                      composite). Lets us spot variance the pipeline is
                      introducing. Token embedded in URL so window.open
                      (which can't set Authorization headers) still
                      authenticates via the server-side adapter middleware
                      that lifts ?_token= to the header before requireAuth.
                      Only renders when the ad has actually rendered. */}
                  {(ad.renderUrl || ad.photorealUrl) && (
                    <Link
                      fontSize="10px"
                      color="brand.muted"
                      href={`/api/ads/${ad.id}/preview-page?_token=${encodeURIComponent(localStorage.getItem('token') || '')}`}
                      isExternal
                      onClick={(e) => e.stopPropagation()}
                      _hover={{ color: 'rsViolet.500', textDecoration: 'underline' }}
                    >
                      Preview render stages →
                    </Link>
                  )}
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal isOpen={detailModal.isOpen} onClose={detailModal.onClose} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selected?.copy.headline || 'Ad detail'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selected && (
              <VStack align="stretch" spacing={4}>
                <Box bg="gray.900" borderRadius="md" overflow="hidden" style={{ aspectRatio: `${selected.width} / ${selected.height}` }}>
                  {displayUrl(selected) ? (
                    selected.kind === 'video' ? (
                      <video
                        src={displayUrl(selected) || undefined}
                        poster={selected.posterUrl || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
                      />
                    ) : (
                      <Image src={displayUrl(selected) || ''} alt={selected.copy.headline || selected.template} width="100%" height="100%" objectFit="contain" />
                    )
                  ) : (
                    <Box w="100%" h="100%" display="flex" alignItems="center" justifyContent="center" color="gray.400" fontSize="12px">
                      {selected.status === 'queued' ? 'Queued for render' : selected.status === 'rendering' ? 'Rendering…' : selected.status === 'failed' ? 'Render failed' : 'No render'}
                    </Box>
                  )}
                </Box>
                <SimpleGrid columns={2} spacing={3}>
                  <DetailRow label="Template" value={selected.template} />
                  <DetailRow label="Aspect ratio" value={selected.aspectRatio} />
                  <DetailRow label="Status" value={selected.status} />
                  <DetailRow label="Match tier" value={selected.matchTier} />
                  <DetailRow label="Variant" value={selected.variantKind} />
                  <DetailRow label="CTA" value={selected.copy.cta_text || selected.ctaUrl} />
                  <DetailRow label="Generated" value={new Date(selected.generatedAt).toLocaleString()} />
                </SimpleGrid>
                {selected.copy.quote && (
                  <DetailRow label="Quote" value={selected.copy.quote} />
                )}
                <HStack justify="space-between" spacing={2}>
                  <Button
                    onClick={() => deleteAd(selected)}
                    variant="outline"
                    colorScheme="red"
                    size="sm"
                    isDisabled={actioning}
                  >
                    Delete
                  </Button>
                  <HStack spacing={2}>
                    {selected.renderUrl && (
                      <Button as="a" href={selected.renderUrl} target="_blank" variant="outline" size="sm">
                        Open in Cloudinary
                      </Button>
                    )}
                    {selected.status === 'draft' && (
                      <>
                        <Button
                          onClick={() => setAdStatus(selected, 'archived')}
                          variant="outline"
                          size="sm"
                          isDisabled={actioning}
                        >
                          Archive
                        </Button>
                        <Button
                          onClick={() => setAdStatus(selected, 'live')}
                          variant="brand"
                          size="sm"
                          isDisabled={actioning}
                        >
                          Approve
                        </Button>
                      </>
                    )}
                    {selected.status === 'live' && (
                      <Button
                        onClick={() => setAdStatus(selected, 'archived')}
                        variant="outline"
                        size="sm"
                        isDisabled={actioning}
                      >
                        Archive
                      </Button>
                    )}
                    {selected.status === 'archived' && (
                      <Button
                        onClick={() => setAdStatus(selected, 'draft')}
                        variant="brand"
                        size="sm"
                        isDisabled={actioning}
                      >
                        Restore to draft
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Push-to-Meta modal — single AdSet dropdown grouped by Meta
          Campaign. Submitting fans out the selected adIds to the
          backend's batch endpoint; the toast summarizes the per-ad
          result and the gallery refreshes to show the new pills. */}
      <Modal isOpen={pushModal.isOpen} onClose={pushModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Push {selectedIds.size} ad{selectedIds.size === 1 ? '' : 's'} to Meta</ModalHeader>
          <ModalCloseButton isDisabled={pushing} />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm" color="brand.muted">
                Pick the AdSet that the new ads will belong to. They'll be created as <strong>PAUSED</strong> — activate them in Meta Ads Manager when you're ready.
              </Text>
              {adsetsLoading ? (
                <HStack py={4} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading AdSets…</Text></HStack>
              ) : metaAdsets.length === 0 ? (
                <Box bg="orange.50" borderColor="orange.300" borderWidth="1px" borderRadius="md" p={3}>
                  <Text fontSize="sm" color="orange.700" fontWeight="700">No Meta AdSets found.</Text>
                  <Text fontSize="xs" color="brand.muted" mt={1}>
                    Connect Meta Ads on the Brand page and run a campaign sync, then come back here.
                  </Text>
                </Box>
              ) : (
                <Box>
                  <Text fontSize="xs" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={1}>
                    Target AdSet
                  </Text>
                  <Select
                    value={chosenAdsetId}
                    onChange={(e) => setChosenAdsetId(e.target.value)}
                    placeholder="Pick an AdSet…"
                  >
                    {adsetsByCampaign.map(group => (
                      <optgroup key={group.campaignName} label={group.campaignName}>
                        {group.adsets.map(a => (
                          <option key={a.adsetId} value={a.adsetId}>
                            {a.adsetName}{a.adsetStatus ? ` · ${a.adsetStatus}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Box>
              )}
              <HStack justify="flex-end" spacing={2}>
                <Button variant="outline" size="sm" onClick={pushModal.onClose} isDisabled={pushing}>Cancel</Button>
                <Button
                  variant="brand"
                  size="sm"
                  onClick={submitPush}
                  isDisabled={!chosenAdsetId || pushing}
                  isLoading={pushing}
                  loadingText="Pushing…"
                >
                  Push as PAUSED
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
        {label}
      </Text>
      <Text fontSize="sm" color="brand.ink" fontWeight="600">
        {value || '—'}
      </Text>
    </Box>
  );
}

function RunProgress({
  run, timedOut, onGenerateMore
}: {
  run: RunStatus;
  timedOut: boolean;
  onGenerateMore: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const finished = run.succeeded + run.skipped + run.failed;
  const pct = run.total > 0 ? Math.round((finished / run.total) * 100) : 0;

  const handleGenerateMore = async () => {
    setBusy(true);
    try { await onGenerateMore(); }
    finally { setBusy(false); }
  };

  // "Generate more" affordance — appears whenever the run has settled
  // (done OR timed-out) and there's queued inventory left for this
  // campaign. Drains the next batch via POST /api/ads/runs.
  const generateMoreBtn = (run.queuedRemaining > 0 && (run.status === 'done' || timedOut)) ? (
    <Button
      variant="brand"
      size="sm"
      onClick={handleGenerateMore}
      isLoading={busy}
      loadingText="Starting…"
    >
      Generate more ({run.queuedRemaining} queued)
    </Button>
  ) : null;

  if (timedOut) {
    return (
      <Card variant="outline" borderColor="orange.300" bg="orange.50">
        <CardBody>
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="700" color="brand.ink">Render is taking longer than expected</Text>
              <Badge colorScheme="orange">Timed out</Badge>
            </HStack>
            <Text fontSize="sm" color="brand.muted">
              {finished} of {run.total} creatives completed. The renderer may still be working —
              refresh in a moment to see the rest, or check the server logs.
            </Text>
            {generateMoreBtn && <HStack justify="flex-end">{generateMoreBtn}</HStack>}
          </VStack>
        </CardBody>
      </Card>
    );
  }

  if (run.status === 'done') {
    if (run.failed === 0) {
      // Full success — quiet card with only the "Generate more"
      // affordance when there's queued inventory remaining.
      if (!generateMoreBtn) return null;
      return (
        <Card variant="outline" borderColor="green.300" bg="green.50">
          <CardBody>
            <HStack justify="space-between" align="center">
              <Text fontSize="sm" fontWeight="700" color="green.700">
                Run complete — {run.succeeded} rendered.
              </Text>
              {generateMoreBtn}
            </HStack>
          </CardBody>
        </Card>
      );
    }
    return (
      <Card variant="outline" borderColor="red.300" bg="red.50">
        <CardBody>
          <VStack align="stretch" spacing={2}>
            <HStack justify="space-between">
              <Text fontWeight="700" color="brand.ink">
                {run.succeeded} succeeded · {run.skipped} skipped · {run.failed} failed
              </Text>
              <Badge colorScheme="red">{run.failed} error{run.failed === 1 ? '' : 's'}</Badge>
            </HStack>
            {run.errors.slice(0, 5).map((e, i) => (
              <Text key={i} fontSize="11px" color="brand.muted" fontFamily="mono" noOfLines={1}>
                #{e.index} {e.template}/{e.aspectRatio} ({e.stage}): {e.message}
              </Text>
            ))}
            {run.errors.length > 5 && (
              <Text fontSize="11px" color="brand.muted">
                + {run.errors.length - 5} more — check server logs for the full list.
              </Text>
            )}
            {generateMoreBtn && <HStack justify="flex-end" pt={1}>{generateMoreBtn}</HStack>}
          </VStack>
        </CardBody>
      </Card>
    );
  }

  if (run.status === 'failed') {
    return (
      <Card variant="outline" borderColor="red.400" bg="red.50">
        <CardBody>
          <Text fontWeight="700" color="red.700">Run crashed before completing</Text>
          <Text fontSize="sm" color="brand.muted">Check the server logs for the underlying error.</Text>
        </CardBody>
      </Card>
    );
  }

  // Running — show live progress.
  return (
    <Card variant="outline" borderColor="purple.300" bg="purple.50">
      <CardBody>
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Spinner size="sm" color="purple.500" />
              <Text fontWeight="700" color="brand.ink">
                Rendering — {finished} of {run.total} complete
              </Text>
            </HStack>
            <Badge colorScheme="purple">{pct}%</Badge>
          </HStack>
          <Progress value={pct} size="sm" colorScheme="purple" borderRadius="md" />
          {(run.skipped > 0 || run.failed > 0) && (
            <Text fontSize="11px" color="brand.muted">
              {run.succeeded} succeeded · {run.skipped} skipped · {run.failed} failed
            </Text>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}
