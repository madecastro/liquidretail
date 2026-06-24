// Product Ads — product-centric pivot of the Ads page.
//
// Each row is a product; clicking expands inline to show the campaign
// list + ads grid generated for that product. KPI tiles up top
// summarize the brand-wide picture. Bulk selection + "Generate Ads"
// deep-links to the wizard with productIds pre-populated.
//
// Phase 1 scope:
//   - Backend aggregation via GET /api/catalog/ads-summary
//   - Inline expansion via GET /api/catalog/:id/ads-detail
//   - Per-row Generate Ads → /generate-ads?productIds=X
//   - Bulk select → /generate-ads?productIds=A,B,C
//
// Deferred to Phase 2:
//   - Opportunity score column + sort
//   - "Generate for new opportunities" / "low coverage" buckets
//   - Automation rules

import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardBody, VStack, HStack, Text, Spinner, Button,
  Image, Badge, Progress, Checkbox, SimpleGrid, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton
} from '@chakra-ui/react';

import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type ProductRow = {
  productId:        string;
  title:            string;
  price:            number | null;
  currency:         string | null;
  imageUrl:         string | null;
  category:         string | null;
  brand:            string | null;
  size:             string | null;
  adCount:          number;
  campaignCount:    number;
  readyToExport:    number;
  draftCount:       number;
  liveCount:        number;
  coveragePct:      number;
  opportunityScore: number | null;
  lastActivityAt:   string | null;
};

type Summary = {
  totalProducts:    number;
  productsWithAds:  number;
  adCoveragePct:    number;
  adsCreated:       number;
  adsReadyToExport: number;
  goodOpportunities: number | null;
};

type SummaryResponse = {
  summary:  Summary;
  products: ProductRow[];
};

type ExpansionCampaign = {
  campaignId: string;
  name:       string;
  status:     string | null;
  kind:       string | null;
  adCount:    number;
};

export type RegenerationHistoryEntry = {
  prompt:      string;
  mode:        'light' | 'full';
  requestedBy: string | null;
  at:          string | null;
  status:      'pending' | 'done' | 'failed';
  error:       string | null;
  durationMs:  number | null;
};

export type ExpansionAd = {
  adId:           string;
  productId?:     string | null;
  campaignId:     string | null;
  template:       string;
  aspectRatio:    string;
  platformFormat: string | null;
  kind:           'image' | 'video';
  sourceFileType: 'image' | 'video' | null;
  status:         string;
  approved:       boolean;
  approvedAt:     string | null;
  renderUrl:      string | null;
  photorealUrl:   string | null;
  useImageRefAsProduction: boolean;
  posterUrl:      string | null;
  headline:       string | null;
  ctaText:        string | null;
  generatedAt:    string | null;
  metaSyncStatus: string | null;
  metaAdId:       string | null;
  metaAdsetId:    string | null;
  regenerating:        boolean;
  regenerationStage:   string | null;
  regenerationHistory: RegenerationHistoryEntry[];
};

export function stageLabel(stage: string | null): string {
  switch (stage) {
    case 'pending':   return 'Queued…';
    case 'veo':       return 'Re-rolling video (~3 min)…';
    case 'chrome':    return 'Generating chrome…';
    case 'composite': return 'Compositing video…';
    case 'image-gen': return 'Regenerating layout…';
    case 'image-ref': return 'Polishing image…';
    case 'done':      return 'Done';
    case 'failed':    return 'Failed';
    default:          return 'Regenerating…';
  }
}

// Three-section grouping rule for the inline expansion. Mirrors the
// backend state model:
//   Draft    = not approved yet
//   Approved = operator-approved, not pushed to Meta yet
//   Exported = synced to Meta (metaSyncStatus='synced')
type AdSection = 'draft' | 'approved' | 'exported';
export function sectionFor(ad: ExpansionAd): AdSection {
  if (ad.metaSyncStatus === 'synced') return 'exported';
  if (ad.approved) return 'approved';
  return 'draft';
}

// Same URL-priority rule as the legacy /ads page: video ads always use
// renderUrl (the ffmpeg composite); image ads ALWAYS prefer photorealUrl
// (the gpt-image-1 polished version) over renderUrl (the raw Puppeteer
// screenshot) whenever it's populated — regardless of the per-campaign
// useImageRefAsProduction flag, which is reserved for production-Meta
// pushes and is not the gate for the gallery thumbnail.
export function displayUrlFor(ad: ExpansionAd): string | null {
  if (ad.kind === 'video') return ad.renderUrl;
  return ad.photorealUrl || ad.renderUrl;
}

type ExpansionResponse = {
  campaigns: ExpansionCampaign[];
  ads:       ExpansionAd[];
};

// Meta AdSet shape returned by /api/ads/meta-adsets — same projection
// the legacy /ads page uses; only the fields we display here are typed.
type MetaAdset = {
  id:           string;
  name:         string;
  status:       string | null;
  campaignId:   string | null;
  campaignName: string | null;
};

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const t   = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60)        return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60)        return `${min}m ago`;
  const hr  = Math.round(min / 60);
  if (hr  < 24)        return `${hr}h ago`;
  const d   = Math.round(hr  / 24);
  return `${d}d ago`;
}

function coverageLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'Excellent', color: 'green' };
  if (pct >= 50) return { label: 'Good',      color: 'green' };
  if (pct >  0)  return { label: 'Low',       color: 'orange' };
  return         { label: 'No ads',           color: 'gray' };
}

function priceLabel(price: number | null, currency: string | null): string {
  if (price == null) return '';
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  return `${sym}${price.toFixed(2)}`;
}

export function ProductAdsPage() {
  const { activeBrand } = useBrand();
  const activeBrandId = activeBrand?.id ?? null;
  const navigate = useNavigate();
  const toast = useToast();

  const [summary, setSummary]   = useState<Summary | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState<string | null>(null);

  // Inline expansion state — keyed by productId. Lazy load on first
  // expand; cached after that for the session.
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [expansions, setExpansions]       = useState<Record<string, ExpansionResponse>>({});
  const [expansionLoading, setExpansionLoading] = useState<Record<string, boolean>>({});

  // Bulk selection — Set<productId>. Header checkbox flips all.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Ad detail modal — single state across the whole page so any
  // expansion's thumbnail can open the same modal. Null = closed.
  const [openAd, setOpenAd] = useState<ExpansionAd | null>(null);

  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    apiJson<SummaryResponse>(`/api/catalog/ads-summary?brandId=${encodeURIComponent(activeBrandId)}`)
      .then(res => {
        if (cancelled) return;
        setSummary(res.summary);
        setProducts(res.products || []);
      })
      .catch(e => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeBrandId]);

  const allSelected = products.length > 0 && selected.size === products.length;
  const someSelected = selected.size > 0 && selected.size < products.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.productId)));
  }
  function toggleOne(productId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function expandRow(productId: string) {
    const newId = expandedId === productId ? null : productId;
    setExpandedId(newId);
    if (newId && !expansions[productId] && activeBrandId) {
      setExpansionLoading(prev => ({ ...prev, [productId]: true }));
      try {
        const res = await apiJson<ExpansionResponse>(
          `/api/catalog/${encodeURIComponent(productId)}/ads-detail?brandId=${encodeURIComponent(activeBrandId)}`
        );
        setExpansions(prev => ({ ...prev, [productId]: res }));
      } catch (e) {
        toast({
          title:       'Could not load product ads',
          description: e instanceof Error ? e.message : String(e),
          status:      'error',
          duration:    5000
        });
      } finally {
        setExpansionLoading(prev => ({ ...prev, [productId]: false }));
      }
    }
  }

  function generateForSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(',');
    navigate(`/generate-ads?productIds=${encodeURIComponent(ids)}`);
  }
  function generateForOne(productId: string) {
    navigate(`/generate-ads?productIds=${encodeURIComponent(productId)}`);
  }

  if (!activeBrandId) {
    return (
      <VStack align="stretch" spacing={4}>
        <PageHeader title="Product Ads" description="Generate and manage ads for your products at scale." />
        <Card variant="outline"><CardBody><Text fontSize="sm" color="brand.muted">Select a brand to continue.</Text></CardBody></Card>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader title="Product Ads" description="Generate and manage ads for your products at scale." />

      {/* ── KPI tiles ─────────────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <KpiTile
          label="Ad Coverage"
          value={summary ? `${summary.adCoveragePct}%` : '—'}
          sub={summary ? `${summary.productsWithAds} of ${summary.totalProducts} products` : ''}
          progressPct={summary?.adCoveragePct ?? null}
        />
        <KpiTile
          label="Good Opportunities"
          value={summary?.goodOpportunities ?? '—'}
          sub="Products with high opportunity scores"
          tooltip="Phase 2 — opportunity scoring engine"
        />
        <KpiTile
          label="Ads Created"
          value={summary?.adsCreated ?? '—'}
          sub="Total ads generated"
        />
        <KpiTile
          label="Ready to Export"
          value={summary?.adsReadyToExport ?? '—'}
          sub="Ads ready to push"
        />
      </SimpleGrid>

      {/* ── Bulk selection bar ─────────────────────────────────────── */}
      {selected.size > 0 && (
        <Card variant="outline" borderColor="rsViolet.400" bg="rsViolet.50">
          <CardBody py={2} px={4}>
            <HStack spacing={4} align="center">
              <Text fontSize="sm" fontWeight="700" color="brand.ink">
                {selected.size} product{selected.size === 1 ? '' : 's'} selected
              </Text>
              <Button size="sm" variant="brand" onClick={generateForSelected}>
                Generate Ads
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </HStack>
          </CardBody>
        </Card>
      )}

      {/* ── Product table ─────────────────────────────────────────── */}
      {loading && (
        <Card variant="outline"><CardBody><HStack py={6} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading products…</Text></HStack></CardBody></Card>
      )}
      {err && !loading && (
        <Card variant="outline"><CardBody><Text fontSize="sm" color="red.600">{err}</Text></CardBody></Card>
      )}
      {!loading && !err && products.length === 0 && (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={6} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No products yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="md">
                Sync a catalog source or upload products to start generating ads.
              </Text>
              <HStack justify="center" spacing={2} pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="sm">Connect catalog</Button>
                <Button as={RouterLink} to="/catalog" variant="brand" size="sm">Browse catalog</Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      {!loading && !err && products.length > 0 && (
        <Card variant="outline">
          <CardBody p={0}>
            {/* Header row */}
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
              align="center"
            >
              <Checkbox isChecked={allSelected} isIndeterminate={someSelected} onChange={toggleAll} />
              <Box flex="2 1 0">Product</Box>
              <Box flex="1 1 0">Ad Coverage</Box>
              <Box flex="1 1 0" textAlign="center">Campaigns</Box>
              <Box flex="1 1 0" textAlign="center">Ads</Box>
              <Box flex="1 1 0">Last Activity</Box>
              <Box flex="1.4 1 0" textAlign="right">Actions</Box>
            </HStack>

            {/* Body rows */}
            <VStack align="stretch" spacing={0} divider={<Box borderTopWidth="1px" borderColor="brand.border" />}>
              {products.map(p => (
                <ProductRowView
                  key={p.productId}
                  row={p}
                  expanded={expandedId === p.productId}
                  expansion={expansions[p.productId] || null}
                  expansionLoading={!!expansionLoading[p.productId]}
                  selected={selected.has(p.productId)}
                  onToggleSelect={() => toggleOne(p.productId)}
                  onExpand={() => expandRow(p.productId)}
                  onGenerate={() => generateForOne(p.productId)}
                  onOpenAd={setOpenAd}
                />
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Ad detail modal — opens on thumbnail click. Hosts the larger
          preview + Approve + Push-to-Meta (Export) actions. On a
          state change (approve toggled, export pushed) the open
          product's expansion is refetched so counts + sections stay
          in sync. */}
      {openAd && activeBrandId && (
        <AdDetailModal
          ad={openAd}
          brandId={activeBrandId}
          onClose={() => setOpenAd(null)}
          onMutated={async (updated) => {
            // Patch the open ad inline + refresh expansion for the
            // product so section grouping rebalances.
            setOpenAd(updated);
            // Find which product's expansion contains this ad and
            // invalidate its cache so the next open re-fetches.
            for (const [productId, exp] of Object.entries(expansions)) {
              if (exp.ads.some(a => a.adId === updated.adId)) {
                const res = await apiJson<ExpansionResponse>(
                  `/api/catalog/${encodeURIComponent(productId)}/ads-detail?brandId=${encodeURIComponent(activeBrandId)}`
                ).catch(() => null);
                if (res) setExpansions(prev => ({ ...prev, [productId]: res }));
                break;
              }
            }
          }}
        />
      )}
    </VStack>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

// Ad detail modal — full-size preview + Approve + Push-to-Meta. Push
// uses the same /api/ads/push-to-meta endpoint the legacy /ads page
// drives; adset list is fetched lazily on first export click so the
// modal stays responsive when just viewing.
export function AdDetailModal({
  ad, brandId, onClose, onMutated
}: {
  ad:        ExpansionAd;
  brandId:   string;
  onClose:   () => void;
  onMutated: (updated: ExpansionAd) => void;
}) {
  const toast = useToast();
  const [approving, setApproving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [adsets, setAdsets] = useState<MetaAdset[] | null>(null);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [chosenAdsetId, setChosenAdsetId] = useState<string>('');

  // Regenerate UI state
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [regenMode, setRegenMode] = useState<'light' | 'full'>('light');
  const [regenSubmitting, setRegenSubmitting] = useState(false);

  const url = displayUrlFor(ad);
  const isExported = ad.metaSyncStatus === 'synced';
  const isApproved = ad.approved;
  const isRegenerating = !!ad.regenerating;
  const lastHistory = (ad.regenerationHistory && ad.regenerationHistory.length)
    ? ad.regenerationHistory[ad.regenerationHistory.length - 1]
    : null;
  const lastError = lastHistory?.status === 'failed' ? (lastHistory.error || null) : null;

  // Poll the ad's detail row every 5s while regenerating. Stops when
  // regenerating flips false. Uses the parent product's ads-detail
  // endpoint (one query for the whole product, then we pick out our
  // ad) — saves adding a per-ad endpoint just for polling.
  useEffect(() => {
    if (!isRegenerating || !ad.campaignId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Shape returned by GET /api/ads/:id is projectAd's full shape —
    // overlaps with ExpansionAd on the fields the modal cares about
    // but uses different names (id vs adId, copy.headline vs headline,
    // etc.). Map the subset we need.
    type AdRow = {
      id:                  string;
      renderUrl:           string | null;
      photorealUrl:        string | null;
      posterUrl:           string | null;
      approved:            boolean;
      approvedAt:          string | null;
      metaSyncStatus:      string | null;
      metaAdId:            string | null;
      metaAdsetId:         string | null;
      regenerating:        boolean;
      regenerationStage:   string | null;
      regenerationHistory: RegenerationHistoryEntry[];
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await apiJson<{ ad: AdRow }>(
          `/api/ads/${encodeURIComponent(ad.adId)}?brandId=${encodeURIComponent(brandId)}`
        );
        if (cancelled) return;
        const r = res.ad;
        const merged: ExpansionAd = {
          ...ad,
          renderUrl:           r.renderUrl,
          photorealUrl:        r.photorealUrl,
          posterUrl:           r.posterUrl,
          approved:            r.approved,
          approvedAt:          r.approvedAt,
          metaSyncStatus:      r.metaSyncStatus,
          metaAdId:            r.metaAdId,
          metaAdsetId:         r.metaAdsetId,
          regenerating:        r.regenerating,
          regenerationStage:   r.regenerationStage,
          regenerationHistory: r.regenerationHistory || []
        };
        onMutated(merged);
        if (r.regenerating) {
          timer = setTimeout(tick, 5000);
        }
      } catch {
        // Network error — back off and try again. Stops only on cancel.
        timer = setTimeout(tick, 10000);
      }
    };
    timer = setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  // Only re-arm when regenerating flips true. ad reference changes on
  // every mutation but we don't want to restart the poll on every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegenerating, ad.adId, brandId]);

  const submitRegen = async () => {
    const text = regenPrompt.trim();
    if (!text) {
      toast({ title: 'Add a prompt first', status: 'warning', duration: 2500 });
      return;
    }
    setRegenSubmitting(true);
    try {
      await apiJson<{ regenerating: boolean; regenerationStage: string; mode: string }>(
        `/api/ads/${encodeURIComponent(ad.adId)}/regenerate?brandId=${encodeURIComponent(brandId)}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ prompt: text, mode: ad.kind === 'video' ? regenMode : undefined })
        }
      );
      onMutated({
        ...ad,
        regenerating:      true,
        regenerationStage: 'pending'
      });
      setRegenOpen(false);
      setRegenPrompt('');
      toast({ title: 'Regenerating', description: 'You can keep this open to watch progress.', status: 'info', duration: 3000 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Regenerate failed to start', description: msg, status: 'error', duration: 6000 });
    } finally {
      setRegenSubmitting(false);
    }
  };

  const toggleApprove = async () => {
    setApproving(true);
    try {
      const res = await apiJson<{ ad: { id: string; approved: boolean; approvedAt: string | null } }>(
        `/api/ads/${encodeURIComponent(ad.adId)}/approve?brandId=${encodeURIComponent(brandId)}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ approved: !isApproved })
        }
      );
      onMutated({
        ...ad,
        approved:   res.ad.approved,
        approvedAt: res.ad.approvedAt
      });
      toast({
        title:    res.ad.approved ? 'Ad approved' : 'Ad unapproved',
        status:   res.ad.approved ? 'success' : 'info',
        duration: 2500
      });
    } catch (e) {
      toast({
        title:       'Approval failed',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    5000
      });
    } finally {
      setApproving(false);
    }
  };

  const loadAdsets = async () => {
    if (adsets) return;
    setAdsetsLoading(true);
    try {
      const res = await apiJson<{ adsets: MetaAdset[] }>(
        `/api/ads/meta-adsets?brandId=${encodeURIComponent(brandId)}`
      );
      setAdsets(res.adsets || []);
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

  const doExport = async () => {
    if (!chosenAdsetId) {
      toast({ title: 'Pick an AdSet first', status: 'warning', duration: 2500 });
      return;
    }
    setPushing(true);
    try {
      type PushResult = {
        pushed:  number;
        failed:  number;
        results: Array<{ adId: string; ok: boolean; metaSyncStatus?: string; metaAdId?: string; error?: string }>;
      };
      const result = await apiJson<PushResult>('/api/ads/push-to-meta', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brandId, adsetId: chosenAdsetId, adIds: [ad.adId] })
      });
      const row = result.results?.[0];
      if (row?.ok) {
        onMutated({
          ...ad,
          metaSyncStatus: row.metaSyncStatus || 'synced',
          metaAdId:       row.metaAdId || ad.metaAdId,
          metaAdsetId:    chosenAdsetId
        });
        toast({ title: 'Exported to Meta', status: 'success', duration: 3000 });
      } else {
        toast({
          title:       'Export failed',
          description: row?.error || 'Unknown error from Meta',
          status:      'error',
          duration:    6000
        });
      }
    } catch (e) {
      toast({
        title:       'Export failed',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    6000
      });
    } finally {
      setPushing(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="3xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <VStack align="stretch" spacing={1}>
            <HStack spacing={2}>
              <Text fontSize="md" fontWeight="800" color="brand.ink">{ad.headline || ad.template}</Text>
              {isExported && <Badge colorScheme="blue" variant="subtle">Exported</Badge>}
              {!isExported && isApproved && <Badge colorScheme="green" variant="subtle">Approved</Badge>}
              {!isExported && !isApproved && <Badge colorScheme="purple" variant="subtle">Draft</Badge>}
            </HStack>
            <HStack spacing={2} fontSize="11px" color="brand.muted">
              <Text fontFamily="mono">{ad.template}</Text>
              <Text>·</Text>
              <Text>{ad.aspectRatio}</Text>
              {ad.platformFormat && (<><Text>·</Text><Text>{ad.platformFormat.replace(/_/g, ' ')}</Text></>)}
              <Text>·</Text>
              <Text>{ad.kind}</Text>
            </HStack>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {/* Large preview — full ad at native aspect, dark frame. */}
          <Box bg="gray.900" borderRadius="md" overflow="hidden" mb={3} maxH="70vh">
            {url ? (
              ad.kind === 'video' ? (
                <video
                  src={url}
                  poster={ad.posterUrl || undefined}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', background: '#000' }}
                />
              ) : (
                <Image src={url} alt={ad.headline || ad.template} w="100%" maxH="70vh" objectFit="contain" />
              )
            ) : (
              <Box w="100%" h="320px" display="flex" alignItems="center" justifyContent="center" color="gray.400" fontSize="sm">
                No render available
              </Box>
            )}
          </Box>

          {/* Copy snapshot — what's actually printed on the ad. */}
          {(ad.headline || ad.ctaText) && (
            <VStack align="stretch" spacing={1} mb={3}>
              {ad.headline && (
                <HStack spacing={2}>
                  <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted" w="80px">Headline</Text>
                  <Text fontSize="sm" color="brand.ink">{ad.headline}</Text>
                </HStack>
              )}
              {ad.ctaText && (
                <HStack spacing={2}>
                  <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted" w="80px">CTA</Text>
                  <Text fontSize="sm" color="brand.ink">{ad.ctaText}</Text>
                </HStack>
              )}
            </VStack>
          )}

          {/* Regenerate status banner — fires while a regen worker is
              running. Shows the stage label so the operator knows
              what's happening during long video regens (~5 min). */}
          {isRegenerating && (
            <Box mt={2} mb={3} p={3} borderWidth="1px" borderColor="rsViolet.300" bg="rsViolet.50" borderRadius="md">
              <HStack spacing={2}>
                <Spinner size="sm" color="rsViolet.500" />
                <Text fontSize="sm" fontWeight="700" color="brand.ink">{stageLabel(ad.regenerationStage)}</Text>
              </HStack>
              <Text fontSize="11px" color="brand.muted" mt={1}>
                Keep this open to watch progress, or close — we'll keep regenerating in the background.
              </Text>
            </Box>
          )}
          {lastError && !isRegenerating && (
            <Box mt={2} mb={3} p={3} borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="md">
              <Text fontSize="sm" fontWeight="700" color="red.700">Last regenerate failed</Text>
              <Text fontSize="11px" color="brand.muted" mt={1}>{lastError}</Text>
            </Box>
          )}

          {/* Regenerate input panel — expands when operator clicks
              Regenerate in the footer. Inline so the preview stays
              visible alongside the refinement they're writing. */}
          {regenOpen && (
            <Box mt={2} mb={3} p={3} borderWidth="1px" borderColor="brand.border" borderRadius="md" bg="brand.surface">
              <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted" mb={2}>
                Regenerate with a refinement prompt
              </Text>
              <Box
                as="textarea"
                value={regenPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRegenPrompt(e.target.value)}
                placeholder={ad.kind === 'video'
                  ? 'e.g. "Make the quote text larger and move it to the bottom-left."'
                  : 'e.g. "Swap the headline color to brand purple and tighten the bottom padding."'}
                maxLength={1000}
                rows={3}
                w="100%"
                borderWidth="1px"
                borderColor="brand.border"
                borderRadius="md"
                p={2}
                fontSize="sm"
                fontFamily="body"
                resize="vertical"
                bg="white"
              />
              <HStack mt={2} justify="space-between" align="center">
                {ad.kind === 'video' ? (
                  <Checkbox
                    size="sm"
                    isChecked={regenMode === 'full'}
                    onChange={(e) => setRegenMode(e.target.checked ? 'full' : 'light')}
                  >
                    <Text fontSize="11px" color="brand.muted">
                      Also re-roll the video (~$1.85, ~5 min) — otherwise only the chrome regenerates
                    </Text>
                  </Checkbox>
                ) : <Box />}
                <HStack spacing={2}>
                  <Button size="sm" variant="ghost" onClick={() => { setRegenOpen(false); setRegenPrompt(''); }}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="brand" onClick={submitRegen} isLoading={regenSubmitting} isDisabled={!regenPrompt.trim()}>
                    Regenerate
                  </Button>
                </HStack>
              </HStack>
            </Box>
          )}

          {/* AdSet picker — only renders once the operator clicks Export
              for the first time. Avoids the legacy /ads-page pattern of
              eager-fetching even when they were just browsing. */}
          {adsets !== null && !isExported && (
            <Box pt={2} borderTopWidth="1px" borderColor="brand.border">
              <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted" mb={1}>
                Push to AdSet
              </Text>
              {adsets.length === 0 ? (
                <Text fontSize="sm" color="brand.muted">No Meta AdSets found for this brand. Connect Meta or create an AdSet first.</Text>
              ) : (
                <Box as="select"
                     value={chosenAdsetId}
                     onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setChosenAdsetId(e.target.value)}
                     borderWidth="1px" borderColor="brand.border" borderRadius="md" p={2}
                     fontSize="sm" w="100%" bg="white">
                  <option value="">— pick an AdSet —</option>
                  {adsets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.campaignName ? ` (${a.campaignName})` : ''}{a.status ? ` — ${a.status}` : ''}
                    </option>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack spacing={2}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button
              variant="outline"
              onClick={() => setRegenOpen(v => !v)}
              isDisabled={isExported || isRegenerating}
              title={
                isExported     ? 'Exported ads are read-only'
              : isRegenerating ? 'Already regenerating'
              : undefined
              }
            >
              Regenerate
            </Button>
            <Button
              variant={isApproved ? 'outline' : 'brand'}
              onClick={toggleApprove}
              isLoading={approving}
              isDisabled={isExported || isRegenerating}
            >
              {isApproved ? 'Unapprove' : 'Approve'}
            </Button>
            {isExported ? (
              <Badge colorScheme="blue" variant="subtle" px={3} py={1} fontSize="11px">
                Synced to Meta
              </Badge>
            ) : adsets === null ? (
              <Button
                variant="brand"
                onClick={loadAdsets}
                isLoading={adsetsLoading}
                isDisabled={!isApproved}
                title={!isApproved ? 'Approve before exporting' : undefined}
              >
                Export
              </Button>
            ) : (
              <Button
                variant="brand"
                onClick={doExport}
                isLoading={pushing}
                isDisabled={!chosenAdsetId || !isApproved}
              >
                Push to Meta
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function KpiTile({
  label, value, sub, progressPct, tooltip
}: {
  label:       string;
  value:       number | string;
  sub?:        string;
  progressPct?: number | null;
  tooltip?:    string;
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

function ProductRowView({
  row, expanded, expansion, expansionLoading, selected,
  onToggleSelect, onExpand, onGenerate, onOpenAd
}: {
  row:             ProductRow;
  expanded:        boolean;
  expansion:       ExpansionResponse | null;
  expansionLoading: boolean;
  selected:        boolean;
  onToggleSelect:  () => void;
  onExpand:        () => void;
  onGenerate:      () => void;
  onOpenAd:        (ad: ExpansionAd) => void;
}) {
  const cov = coverageLabel(row.coveragePct);
  return (
    <Box bg={expanded ? 'rsViolet.50' : undefined}>
      <HStack
        px={4}
        py={3}
        spacing={4}
        align="center"
        cursor="pointer"
        _hover={{ bg: expanded ? undefined : 'gray.50' }}
        onClick={onExpand}
      >
        <Checkbox isChecked={selected} onChange={(e) => { e.stopPropagation(); onToggleSelect(); }} onClick={(e) => e.stopPropagation()} />
        <HStack flex="2 1 0" spacing={3} align="center" minW={0}>
          {row.imageUrl ? (
            <Image
              src={row.imageUrl}
              alt={row.title}
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
            <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{row.title}</Text>
            <HStack spacing={2} fontSize="11px" color="brand.muted">
              {row.price != null && <Text>{priceLabel(row.price, row.currency)}</Text>}
              {row.size && <><Text>·</Text><Text>{row.size}</Text></>}
              {row.category && <><Text>·</Text><Text noOfLines={1}>{row.category}</Text></>}
            </HStack>
          </VStack>
        </HStack>
        <Box flex="1 1 0">
          <Text fontSize="sm" fontWeight="700" color={cov.color === 'gray' ? 'brand.muted' : 'brand.ink'}>
            {row.coveragePct}%
          </Text>
          <Progress value={row.coveragePct} size="xs" colorScheme={cov.color === 'gray' ? 'gray' : cov.color === 'orange' ? 'orange' : 'green'} mt={1} borderRadius="md" />
          <Text fontSize="10px" color="brand.muted" mt={0.5}>{cov.label}</Text>
        </Box>
        <Box flex="1 1 0" textAlign="center">
          <Text fontSize="sm" fontWeight="700" color="brand.ink">{row.campaignCount}</Text>
          {row.campaignCount > 0 && <Text fontSize="10px" color="brand.muted">Active</Text>}
        </Box>
        <Box flex="1 1 0" textAlign="center">
          <Text fontSize="sm" fontWeight="700" color="brand.ink">{row.adCount}</Text>
          {row.readyToExport > 0 && <Text fontSize="10px" color="brand.muted">{row.readyToExport} ready</Text>}
        </Box>
        <Box flex="1 1 0">
          <Text fontSize="11px" color="brand.muted">{relativeTime(row.lastActivityAt)}</Text>
        </Box>
        <HStack flex="1.4 1 0" justify="flex-end" onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant="outline" onClick={onGenerate}>
            Generate Ads
          </Button>
        </HStack>
      </HStack>

      {/* Inline expansion */}
      {expanded && (
        <Box px={4} pb={4} borderTopWidth="1px" borderColor="brand.border" bg="white">
          {expansionLoading && (
            <HStack py={6} justify="center">
              <Spinner size="sm" />
              <Text fontSize="sm" color="brand.muted">Loading campaigns + ads…</Text>
            </HStack>
          )}
          {!expansionLoading && expansion && (
            <ExpansionPanel expansion={expansion} onOpenAd={onOpenAd} />
          )}
        </Box>
      )}
    </Box>
  );
}

function ExpansionPanel({ expansion, onOpenAd }: { expansion: ExpansionResponse; onOpenAd: (ad: ExpansionAd) => void }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    expansion.campaigns[0]?.campaignId ?? null
  );
  const filteredAds = useMemo(() => {
    if (!selectedCampaignId) return expansion.ads;
    return expansion.ads.filter(a => a.campaignId === selectedCampaignId);
  }, [expansion.ads, selectedCampaignId]);

  // Group filtered ads by section. Order matters in the UI:
  // Draft first (operator's work queue), then Approved (export-ready),
  // then Exported (audit/reference).
  const grouped = useMemo(() => {
    const draft:    ExpansionAd[] = [];
    const approved: ExpansionAd[] = [];
    const exported: ExpansionAd[] = [];
    for (const ad of filteredAds) {
      const s = sectionFor(ad);
      if (s === 'draft') draft.push(ad);
      else if (s === 'approved') approved.push(ad);
      else exported.push(ad);
    }
    return { draft, approved, exported };
  }, [filteredAds]);

  if (expansion.campaigns.length === 0 && expansion.ads.length === 0) {
    return (
      <Box py={4}>
        <Text fontSize="sm" color="brand.muted">No ads generated for this product yet.</Text>
      </Box>
    );
  }

  return (
    <HStack align="flex-start" spacing={4} pt={4}>
      {/* Campaign sidebar */}
      <VStack align="stretch" spacing={1} flex="0 0 220px">
        <Text fontSize="10px" fontWeight="800" textTransform="uppercase" letterSpacing="0.08em" color="brand.muted" mb={1}>
          Campaigns
        </Text>
        <CampaignRow
          label="All Campaigns"
          adCount={expansion.ads.length}
          selected={selectedCampaignId === null}
          onClick={() => setSelectedCampaignId(null)}
        />
        {expansion.campaigns.map(c => (
          <CampaignRow
            key={c.campaignId}
            label={c.name}
            adCount={c.adCount}
            status={c.status}
            selected={c.campaignId === selectedCampaignId}
            onClick={() => setSelectedCampaignId(c.campaignId)}
          />
        ))}
      </VStack>

      {/* Ads — grouped Draft / Approved / Exported. Empty sections
          hide entirely so the panel stays compact when only one
          category exists. */}
      <VStack align="stretch" flex="1 1 0" spacing={4}>
        {filteredAds.length === 0 && (
          <Text fontSize="sm" color="brand.muted">No ads in this campaign yet.</Text>
        )}
        <AdSectionGrid
          label="Draft"
          tint="purple"
          ads={grouped.draft}
          onOpenAd={onOpenAd}
        />
        <AdSectionGrid
          label="Approved"
          tint="green"
          ads={grouped.approved}
          onOpenAd={onOpenAd}
        />
        <AdSectionGrid
          label="Exported"
          tint="blue"
          ads={grouped.exported}
          onOpenAd={onOpenAd}
        />
      </VStack>
    </HStack>
  );
}

// One status section of the expansion. Hides when empty so a product
// with only drafts doesn't render two empty stubs.
export function AdSectionGrid({
  label, tint, ads, onOpenAd
}: {
  label:    string;
  tint:     'purple' | 'green' | 'blue';
  ads:      ExpansionAd[];
  onOpenAd: (ad: ExpansionAd) => void;
}) {
  if (!ads.length) return null;
  const labelColor = tint === 'purple' ? 'rsViolet.600'
                   : tint === 'green'  ? 'green.700'
                   :                     'blue.700';
  return (
    <Box>
      <HStack spacing={2} mb={2} align="center">
        <Text fontSize="10px" fontWeight="800" textTransform="uppercase" letterSpacing="0.08em" color={labelColor}>
          {label}
        </Text>
        <Badge fontSize="9px" colorScheme={tint} variant="subtle">{ads.length}</Badge>
      </HStack>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
        {ads.slice(0, 12).map(ad => (
          <Box key={ad.adId} onClick={() => onOpenAd(ad)} cursor="pointer">
            <AdThumbnail ad={ad} />
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function CampaignRow({
  label, adCount, status, selected, onClick
}: {
  label:    string;
  adCount:  number;
  status?:  string | null;
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <HStack
      px={2}
      py={2}
      spacing={2}
      borderRadius="md"
      cursor="pointer"
      bg={selected ? 'rsViolet.100' : 'transparent'}
      _hover={{ bg: selected ? 'rsViolet.100' : 'gray.50' }}
      onClick={onClick}
      justify="space-between"
    >
      <HStack spacing={2} minW={0}>
        <Box w="6px" h="6px" borderRadius="full" bg={selected ? 'rsViolet.500' : 'brand.border'} flexShrink={0} />
        <Text fontSize="13px" fontWeight={selected ? '700' : '500'} color="brand.ink" noOfLines={1}>{label}</Text>
        {status && (
          <Badge fontSize="9px" colorScheme={/active|enabled|running/i.test(status) ? 'green' : 'gray'} variant="subtle">
            {status}
          </Badge>
        )}
      </HStack>
      <Text fontSize="11px" color="brand.muted" flexShrink={0}>{adCount} ad{adCount === 1 ? '' : 's'}</Text>
    </HStack>
  );
}

export function AdThumbnail({ ad }: { ad: ExpansionAd }) {
  const url = displayUrlFor(ad);
  return (
    <Box
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="md"
      overflow="hidden"
      position="relative"
      bg="gray.50"
    >
      {/* Uniform 1:1 tile — non-square ads letterbox inside the shared
          frame so every card matches height. objectFit:contain (not
          cover) so we don't crop faces / products mid-frame. Mirrors
          the legacy /ads page card layout. */}
      <Box
        position="relative"
        bg="gray.900"
        style={{ aspectRatio: '1 / 1' }}
        overflow="hidden"
      >
        {url ? (
          ad.kind === 'video' ? (
            <video
              src={url}
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
              src={url}
              alt={ad.headline || ad.template}
              w="100%"
              h="100%"
              objectFit="contain"
              loading="lazy"
            />
          )
        ) : (
          <Box
            w="100%" h="100%"
            display="flex" alignItems="center" justifyContent="center"
            color="gray.400"
            fontSize="10px"
            textTransform="uppercase"
            letterSpacing="0.06em"
          >
            {ad.status === 'queued'    ? 'Queued'
            : ad.status === 'rendering' ? 'Rendering…'
            : ad.status === 'failed'    ? 'Render failed'
            : 'No render'}
          </Box>
        )}
      </Box>
      <Box px={2} py={1.5} borderTopWidth="1px" borderColor="brand.border">
        <HStack justify="space-between" spacing={1}>
          <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="0.04em" color="brand.muted" noOfLines={1}>
            {ad.platformFormat ? ad.platformFormat.replace(/_/g, ' ') : ad.aspectRatio}
          </Text>
          {ad.status === 'draft' && <Badge fontSize="8px" colorScheme="purple" variant="subtle">Draft</Badge>}
          {ad.status === 'live' && <Badge fontSize="8px" colorScheme="green" variant="subtle">Live</Badge>}
        </HStack>
      </Box>
    </Box>
  );
}
