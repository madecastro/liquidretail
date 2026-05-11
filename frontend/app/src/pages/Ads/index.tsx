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
  ModalHeader, ModalBody, ModalCloseButton, Select, Progress, useToast
} from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type AdRow = {
  id:           string;
  brandId:      string;
  campaignId:   string;
  campaignRunId: string;
  mediaId:      string | null;
  productId:    string | null;
  template:     string;
  aspectRatio:  string;
  matchTier:    'product_match' | 'product_category' | 'brand_match' | 'brand_only';
  variantKind:  'product_image' | 'ugc';
  readinessScore: number | null;
  campaignKind: string | null;
  kind:         'image' | 'video';
  // Render-output fields null until status transitions to 'draft' or beyond.
  renderUrl:    string | null;
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
  useEffect(() => {
    fetchRef.current = async () => {
      if (!activeBrandId) return;
      const qp = new URLSearchParams({ brandId: activeBrandId, limit: '120' });
      if (status)          qp.set('status', status);
      if (campaignId)      qp.set('campaignId', campaignId);
      try {
        const res = await apiJson<AdsResponse>(`/api/ads?${qp.toString()}`);
        const filtered = campaignRunId
          ? res.ads.filter(a => a.campaignRunId === campaignRunId)
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
        if (next.status === 'running') {
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
                {ad.renderUrl ? (
                  ad.kind === 'video' ? (
                    <video
                      src={ad.renderUrl}
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
                      src={ad.renderUrl}
                      alt={ad.copy.headline || ad.template}
                      width="100%"
                      height="100%"
                      objectFit="contain"
                      loading="lazy"
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
                  {selected.renderUrl ? (
                    selected.kind === 'video' ? (
                      <video
                        src={selected.renderUrl}
                        poster={selected.posterUrl || undefined}
                        controls
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
                      />
                    ) : (
                      <Image src={selected.renderUrl} alt={selected.copy.headline || selected.template} width="100%" height="100%" objectFit="contain" />
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
