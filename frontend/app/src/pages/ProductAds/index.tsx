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
  Image, Badge, Progress, Checkbox, SimpleGrid, useToast
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

type ExpansionAd = {
  adId:           string;
  campaignId:     string | null;
  template:       string;
  aspectRatio:    string;
  platformFormat: string | null;
  kind:           'image' | 'video';
  status:         string;
  renderUrl:      string | null;
  photorealUrl:   string | null;
  posterUrl:      string | null;
  headline:       string | null;
  ctaText:        string | null;
  generatedAt:    string | null;
  metaSyncStatus: string | null;
};

type ExpansionResponse = {
  campaigns: ExpansionCampaign[];
  ads:       ExpansionAd[];
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
                />
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

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
  onToggleSelect, onExpand, onGenerate
}: {
  row:             ProductRow;
  expanded:        boolean;
  expansion:       ExpansionResponse | null;
  expansionLoading: boolean;
  selected:        boolean;
  onToggleSelect:  () => void;
  onExpand:        () => void;
  onGenerate:      () => void;
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
            <ExpansionPanel expansion={expansion} />
          )}
        </Box>
      )}
    </Box>
  );
}

function ExpansionPanel({ expansion }: { expansion: ExpansionResponse }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    expansion.campaigns[0]?.campaignId ?? null
  );
  const filteredAds = useMemo(() => {
    if (!selectedCampaignId) return expansion.ads;
    return expansion.ads.filter(a => a.campaignId === selectedCampaignId);
  }, [expansion.ads, selectedCampaignId]);

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

      {/* Ads grid */}
      <Box flex="1 1 0">
        <Text fontSize="10px" fontWeight="800" textTransform="uppercase" letterSpacing="0.08em" color="brand.muted" mb={2}>
          Generated Ads · {filteredAds.length} ad{filteredAds.length === 1 ? '' : 's'}
        </Text>
        {filteredAds.length === 0 ? (
          <Text fontSize="sm" color="brand.muted">No ads in this campaign yet.</Text>
        ) : (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
            {filteredAds.slice(0, 12).map(ad => <AdThumbnail key={ad.adId} ad={ad} />)}
          </SimpleGrid>
        )}
      </Box>
    </HStack>
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

function AdThumbnail({ ad }: { ad: ExpansionAd }) {
  const thumb = ad.photorealUrl || ad.renderUrl || ad.posterUrl;
  return (
    <Box
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="md"
      overflow="hidden"
      position="relative"
      bg="gray.50"
    >
      {thumb ? (
        <Image src={thumb} alt={ad.headline || ad.template} w="100%" h="120px" objectFit="cover" />
      ) : (
        <Box w="100%" h="120px" />
      )}
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
