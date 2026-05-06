// Step 2 — Products select.
//
// Header summarizes the chosen campaign — objective, kind, target
// audience, budget, schedule, sample creatives — so the operator can
// sanity-check before picking products.
//
// Body behavior depends on campaign.kind:
//   'product' / 'collection' → matched products auto-checked (they
//      come from URL match, product-set expansion, collection URL,
//      or text similarity). Operator can deselect any.
//   'brand' (or no matches) → brand-awareness fallback. Step 2 surfaces
//      the full catalog with nothing pre-checked, so the operator picks
//      manually. Top-N defaults could be added later.
//
// Backend: GET /api/campaigns/:id/products returns the matched-products
// list AND the campaign metadata in a single round-trip.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Card, CardBody, Checkbox, Image, Badge, Spinner, Wrap, WrapItem, Divider, Tooltip, SimpleGrid
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { WizardSelections } from './index';
import { StepShell } from './index';
import { apiJson } from '../../auth/apiFetch';

type CampaignMeta = {
  id:            string;
  platform:      string;
  externalId:    string;
  name:          string;
  status:        string | null;
  objective:     string | null;
  kind:          'product' | 'collection' | 'brand' | null;
  budget: {
    dailyMicros:    number | null;
    lifetimeMicros: number | null;
    currency:       string | null;
  } | null;
  schedule: {
    start: string | null;
    end:   string | null;
  } | null;
  targeting: {
    geo:        string[];
    ageMin:     number | null;
    ageMax:     number | null;
    interests:  string[];
    audiences:  string[];
    devices:    string[];
  } | null;
  productSetIds:   string[];
  adSetCount:      number;
  adCount:         number;
  insights:        CampaignInsights | null;
  lastSyncedAt:    string | null;
  sampleCreatives: Creative[];
};

type CampaignInsights = {
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

type Creative = {
  adId:         string;
  title:        string | null;
  body:         string | null;
  imageUrl:     string | null;
  thumbnailUrl: string | null;
  linkUrl:      string | null;
  callToAction: string | null;
  matchMethod:  string | null;
};

type Product = {
  id:          string;
  title:       string;
  imageUrl:    string | null;
  category:    string | null;
  productUrl:  string | null;
  matchMethod: 'product-set' | 'url' | 'mixed' | 'collection' | 'text' | 'category-sibling' | null;
};

type Catalog = {
  rows: Array<{
    id:        string;
    title:     string;
    imageUrl:  string | null;
    category:  string | null;
    productUrl: string | null;
  }>;
};

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step2Products({ value, onChange }: Props) {
  const campaignId = value.campaignId;
  const [campaign, setCampaign] = useState<CampaignMeta | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categoryPool, setCategoryPool] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) { setCampaign(null); setProducts(null); setCategoryPool([]); return; }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await apiJson<{ campaign: CampaignMeta; products: Product[]; categoryPoolProducts?: Product[] }>(`/api/campaigns/${campaignId}/products`);
        setCampaign(res.campaign);
        setProducts(res.products || []);
        setCategoryPool(res.categoryPoolProducts || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign products');
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  // First-time auto-select — only for product/collection campaigns.
  // Brand-awareness campaigns leave the operator to pick from the
  // full catalog manually.
  useEffect(() => {
    if (!campaign || !products) return;
    if (campaign.kind === 'brand') return;
    if (products.length === 0) return;
    if (value.productIds.length > 0) return;
    onChange({ productIds: products.map(p => p.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.kind, products]);

  if (!campaignId) {
    return (
      <StepShell heading="Pick products" helper="Pick a campaign first — its matched products will populate this step.">
        <Card variant="outline">
          <CardBody>
            <Text fontSize="sm" color="brand.muted">No campaign selected. Go back to Step 1 to choose one.</Text>
          </CardBody>
        </Card>
      </StepShell>
    );
  }

  if (loading) {
    return (
      <StepShell heading="Pick products">
        <HStack py={6} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading campaign data…</Text></HStack>
      </StepShell>
    );
  }

  if (error) {
    return (
      <StepShell heading="Pick products">
        <Card variant="outline"><CardBody><Text color="red.600" fontSize="sm">{error}</Text></CardBody></Card>
      </StepShell>
    );
  }

  return (
    <StepShell
      heading="Pick products"
      helper="Review the campaign's audience and goals, then confirm which products to feature."
    >
      <VStack align="stretch" spacing={5}>
        {campaign && <CampaignSummaryCard campaign={campaign} />}

        {campaign && campaign.kind === 'brand' ? (
          <BrandAwarenessFallback
            value={value}
            onChange={onChange}
          />
        ) : products && products.length > 0 ? (
          <>
            <MatchedProductsList
              products={products}
              value={value}
              onChange={onChange}
            />
            {categoryPool.length > 0 && (
              <CategoryPoolList
                products={categoryPool}
                value={value}
                onChange={onChange}
              />
            )}
          </>
        ) : (
          <NoMatchesFallback />
        )}
      </VStack>
    </StepShell>
  );
}

// ── Category-sibling pool (sister SKUs from matched categories) ────

function CategoryPoolList({
  products, value, onChange
}: {
  products: Product[];
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
}) {
  const toggle = (id: string) => {
    const set = new Set(value.productIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ productIds: Array.from(set) });
  };
  const allSelected = products.every(p => value.productIds.includes(p.id));
  const toggleAll = () => {
    const set = new Set(value.productIds);
    if (allSelected) for (const p of products) set.delete(p.id);
    else             for (const p of products) set.add(p.id);
    onChange({ productIds: Array.from(set) });
  };

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Box>
          <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">
            Also in matched categories
          </Text>
          <Text fontSize="11px" color="brand.muted">
            Sibling products in the same categories the campaign's matched products belong to. None pre-selected; opt them in if you want broader coverage.
          </Text>
        </Box>
        <Button size="xs" variant="outline" onClick={toggleAll}>
          {allSelected ? 'Deselect all' : 'Add all'}
        </Button>
      </HStack>
      <VStack align="stretch" spacing={2}>
        {products.map(p => (
          <ProductRow
            key={p.id}
            product={p}
            selected={value.productIds.includes(p.id)}
            onToggle={() => toggle(p.id)}
          />
        ))}
      </VStack>
    </Box>
  );
}

// ── Campaign summary header ─────────────────────────────────────────

function CampaignSummaryCard({ campaign }: { campaign: CampaignMeta }) {
  const platformLabel = campaign.platform === 'meta-ads' ? 'Meta'
                      : campaign.platform === 'google-ads' ? 'Google'
                      : campaign.platform;
  const statusColor = !campaign.status ? 'gray'
                    : /active|enabled/i.test(campaign.status) ? 'green'
                    : /paused/i.test(campaign.status) ? 'yellow'
                    : 'gray';
  const kindBadge = campaign.kind === 'product' ? { label: 'Product campaign', color: 'green' }
                  : campaign.kind === 'collection' ? { label: 'Collection campaign', color: 'blue' }
                  : campaign.kind === 'brand' ? { label: 'Brand-awareness', color: 'orange' }
                  : null;

  const dailyBudget    = formatBudget(campaign.budget?.dailyMicros, campaign.budget?.currency);
  const lifetimeBudget = formatBudget(campaign.budget?.lifetimeMicros, campaign.budget?.currency);
  const schedule       = formatSchedule(campaign.schedule);

  const t = campaign.targeting;
  const ageRange = t?.ageMin != null || t?.ageMax != null
    ? `${t?.ageMin ?? '?'}–${t?.ageMax ?? '?'}`
    : null;

  return (
    <Card variant="outline" bg="rsViolet.50" borderColor="rsViolet.200">
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <HStack spacing={2} wrap="wrap">
            <Text fontSize="md" fontWeight="800" color="brand.ink" noOfLines={1}>{campaign.name}</Text>
            <Badge fontSize="9px" colorScheme="purple" variant="subtle">{platformLabel}</Badge>
            {campaign.status && (
              <Badge fontSize="9px" colorScheme={statusColor} variant="subtle">{campaign.status}</Badge>
            )}
            {kindBadge && (
              <Badge fontSize="9px" colorScheme={kindBadge.color} variant="solid">{kindBadge.label}</Badge>
            )}
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3}>
            <KV label="Goal"     value={campaign.objective || '—'} />
            <KV
              label="Budget"
              value={dailyBudget ? `${dailyBudget}/day`
                   : lifetimeBudget ? `${lifetimeBudget} lifetime`
                   : '—'}
            />
            <KV label="Schedule" value={schedule || '—'} />
            <KV label="Ads"      value={`${campaign.adCount} (${campaign.adSetCount} ad set${campaign.adSetCount === 1 ? '' : 's'})`} />
          </SimpleGrid>

          {campaign.insights && <CampaignInsightsRow insights={campaign.insights} fallbackCurrency={campaign.budget?.currency || null} />}

          {t && (t.geo.length > 0 || ageRange || t.interests.length > 0 || t.audiences.length > 0 || t.devices.length > 0) && (
            <>
              <Divider />
              <Box>
                <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" mb={1.5}>
                  Target audience
                </Text>
                <Wrap spacing={1.5}>
                  {ageRange && <ChipBadge label={`Ages ${ageRange}`} />}
                  {t.geo.slice(0, 6).map((g, i)       => <ChipBadge key={`g${i}`} label={g} />)}
                  {t.geo.length > 6 && <ChipBadge label={`+${t.geo.length - 6} more`} muted />}
                  {t.interests.slice(0, 6).map((iv, i) => <ChipBadge key={`i${i}`} label={iv} />)}
                  {t.interests.length > 6 && <ChipBadge label={`+${t.interests.length - 6} interests`} muted />}
                  {t.audiences.slice(0, 3).map((a, i) => <ChipBadge key={`a${i}`} label={`Audience: ${a}`} />)}
                  {t.devices.slice(0, 4).map((d, i)   => <ChipBadge key={`d${i}`} label={d} muted />)}
                </Wrap>
              </Box>
            </>
          )}

          {campaign.sampleCreatives.length > 0 && (
            <>
              <Divider />
              <Box>
                <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" mb={1.5}>
                  Sample creatives ({campaign.sampleCreatives.length})
                </Text>
                <HStack spacing={2} overflowX="auto" pb={1}>
                  {campaign.sampleCreatives.map((cre, i) => (
                    <CreativeThumb key={i} creative={cre} />
                  ))}
                </HStack>
              </Box>
            </>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
}

function CampaignInsightsRow({ insights, fallbackCurrency }: { insights: CampaignInsights; fallbackCurrency: string | null }) {
  const cur = insights.currency || fallbackCurrency || 'USD';
  const cells: Array<{ label: string; value: string | null }> = [
    { label: 'Spend',       value: formatMicrosCurrency(insights.spendMicros, cur) },
    { label: 'Impressions', value: formatCompact(insights.impressions) },
    { label: 'Reach',       value: formatCompact(insights.reach) },
    { label: 'Clicks',      value: formatCompact(insights.clicks) },
    { label: 'CTR',         value: formatPercent(insights.ctr) },
    { label: 'CPC',         value: formatMicrosCurrency(insights.cpcMicros, cur) },
    { label: 'CPM',         value: formatMicrosCurrency(insights.cpmMicros, cur) },
    { label: 'Conversions', value: formatCompact(insights.conversions) }
  ];
  const present = cells.filter(c => c.value);
  if (present.length === 0) return null;
  return (
    <Box>
      <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" mb={1.5}>
        Performance {insights.rangeDays ? `(last ${insights.rangeDays}d)` : '(lifetime)'}
      </Text>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        {present.map(c => (
          <Box key={c.label}>
            <Text fontSize="9px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">{c.label}</Text>
            <Text fontSize="md" fontWeight="800" color="brand.ink">{c.value}</Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="10px" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">{label}</Text>
      <Text fontSize="sm" fontWeight="600" color="brand.ink" noOfLines={1}>{value}</Text>
    </Box>
  );
}

function ChipBadge({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <WrapItem>
      <Badge
        fontSize="10px"
        px={2} py={1}
        borderRadius="md"
        textTransform="none"
        colorScheme={muted ? 'gray' : 'purple'}
        variant={muted ? 'outline' : 'subtle'}
      >
        {label}
      </Badge>
    </WrapItem>
  );
}

function CreativeThumb({ creative }: { creative: Creative }) {
  const img = creative.thumbnailUrl || creative.imageUrl;
  return (
    <Tooltip
      hasArrow
      placement="top"
      label={
        <Box maxW="280px">
          {creative.title && <Text fontWeight="700" fontSize="xs">{creative.title}</Text>}
          {creative.body  && <Text fontSize="11px" mt={1} noOfLines={4}>{creative.body}</Text>}
          {creative.linkUrl && <Text fontSize="10px" mt={1} fontFamily="mono" noOfLines={1}>{creative.linkUrl}</Text>}
        </Box>
      }
    >
      <Box
        w="80px" h="80px"
        flexShrink={0}
        borderRadius="md"
        overflow="hidden"
        bg="gray.100"
        borderWidth="1px"
        borderColor="brand.border"
        position="relative"
      >
        {img ? (
          <Image src={img} alt={creative.title || 'creative'} w="100%" h="100%" objectFit="cover" />
        ) : (
          <Box w="100%" h="100%" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="9px" color="brand.muted">No image</Text>
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

// ── Matched products list (product / collection campaigns) ──────────

function MatchedProductsList({
  products, value, onChange
}: {
  products: Product[];
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
}) {
  const allSelected = useMemo(
    () => products.length > 0 && value.productIds.length === products.length,
    [products, value.productIds]
  );

  const toggle = (id: string) => {
    const set = new Set(value.productIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ productIds: Array.from(set) });
  };
  const toggleAll = () => {
    onChange({ productIds: allSelected ? [] : products.map(p => p.id) });
  };

  return (
    <Box>
      <HStack justify="space-between" mb={3}>
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="700" color="brand.ink">
            {value.productIds.length} of {products.length} selected
          </Text>
          <Text fontSize="11px" color="brand.muted">
            · matched via the ad creatives' link URL, product set, and caption text
          </Text>
        </HStack>
        <Button size="xs" variant="outline" onClick={toggleAll}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
      </HStack>
      <VStack align="stretch" spacing={2}>
        {products.map(p => (
          <ProductRow
            key={p.id}
            product={p}
            selected={value.productIds.includes(p.id)}
            onToggle={() => toggle(p.id)}
          />
        ))}
      </VStack>
    </Box>
  );
}

function ProductRow({ product, selected, onToggle }: { product: Product; selected: boolean; onToggle: () => void }) {
  const methodColor = product.matchMethod === 'product-set' ? 'green'
                    : product.matchMethod === 'url' ? 'green'
                    : product.matchMethod === 'mixed' ? 'purple'
                    : product.matchMethod === 'collection' ? 'blue'
                    : product.matchMethod === 'text' ? 'cyan'
                    : product.matchMethod === 'category-sibling' ? 'gray'
                    : 'gray';
  const methodLabel = product.matchMethod === 'product-set' ? 'Product set'
                    : product.matchMethod === 'url' ? 'URL match'
                    : product.matchMethod === 'mixed' ? 'URL + text'
                    : product.matchMethod === 'collection' ? 'Collection'
                    : product.matchMethod === 'text' ? 'Text match'
                    : product.matchMethod === 'category-sibling' ? 'Same category'
                    : null;

  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <HStack spacing={3}>
        <Checkbox isChecked={selected} onChange={onToggle} />
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.title} w="44px" h="44px" borderRadius="md" objectFit="cover" />
        ) : (
          <Box w="44px" h="44px" borderRadius="md" bg="gray.100" />
        )}
        <Box flex={1} minW={0}>
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{product.title}</Text>
            {methodLabel && (
              <Badge fontSize="9px" colorScheme={methodColor} variant="subtle">{methodLabel}</Badge>
            )}
          </HStack>
          <HStack spacing={2}>
            {product.category && <Text fontSize="11px" color="brand.muted" noOfLines={1}>{product.category}</Text>}
            {product.productUrl && <Text fontSize="10px" color="brand.muted" noOfLines={1}>· {shortUrl(product.productUrl)}</Text>}
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}

// ── Brand-awareness fallback (operator-pick from full catalog) ──────

function BrandAwarenessFallback({
  value, onChange
}: {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await apiJson<{ products: Catalog['rows'] }>('/api/catalog?limit=200');
        setCatalog({ rows: res.products || [] });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    const set = new Set(value.productIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ productIds: Array.from(set) });
  };

  return (
    <Box>
      <Box bg="orange.50" borderWidth="1px" borderColor="orange.200" borderRadius="md" p={3} mb={3}>
        <Text fontSize="sm" fontWeight="700" color="orange.700">
          Brand-awareness campaign — no specific products to auto-select.
        </Text>
        <Text fontSize="xs" color="orange.700" mt={1}>
          The objective and ad creatives don't point at any single SKU. Pick products manually
          from your catalog below to feature in the generated ads.
        </Text>
      </Box>

      {loading ? (
        <HStack py={4} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading catalog…</Text></HStack>
      ) : error ? (
        <Card variant="outline"><CardBody><Text color="red.600" fontSize="sm">{error}</Text></CardBody></Card>
      ) : !catalog || catalog.rows.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={2} py={4} textAlign="center">
              <Text fontSize="sm" color="brand.muted">Your catalog is empty.</Text>
              <HStack justify="center">
                <Button as={RouterLink} to="/catalog" variant="outline" size="sm">Open catalog</Button>
                <Button as={RouterLink} to="/upload" variant="brand" size="sm">Upload products</Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <>
          <Text fontSize="11px" color="brand.muted" mb={2}>
            {value.productIds.length} of {catalog.rows.length} selected
            {catalog.rows.length === 200 && ' (showing first 200)'}
          </Text>
          <VStack align="stretch" spacing={2}>
            {catalog.rows.map(p => (
              <Box
                key={p.id}
                borderWidth="1px"
                borderColor={value.productIds.includes(p.id) ? 'rsViolet.400' : 'brand.border'}
                bg={value.productIds.includes(p.id) ? 'rsViolet.50' : 'brand.surface'}
                borderRadius="md"
                p={3}
              >
                <HStack spacing={3}>
                  <Checkbox
                    isChecked={value.productIds.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.title} w="40px" h="40px" borderRadius="md" objectFit="cover" />
                  ) : (
                    <Box w="40px" h="40px" borderRadius="md" bg="gray.100" />
                  )}
                  <Box flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{p.title}</Text>
                    {p.category && <Text fontSize="11px" color="brand.muted" noOfLines={1}>{p.category}</Text>}
                  </Box>
                </HStack>
              </Box>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
}

function NoMatchesFallback() {
  return (
    <Card variant="outline">
      <CardBody>
        <VStack align="stretch" spacing={3} py={6} textAlign="center">
          <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
            No products matched
          </Text>
          <Text color="brand.ink" fontWeight="600" fontSize="md">
            We couldn't match this campaign's creatives to any of your catalog products.
          </Text>
          <Text fontSize="sm" color="brand.muted" maxW="480px" mx="auto">
            Make sure your catalog has product URLs and titles that align with what the
            ads link to and describe — or pick a different campaign in Step 1.
          </Text>
          <HStack justify="center" pt={2}>
            <Button as={RouterLink} to="/catalog" variant="outline" size="sm">
              Browse catalog
            </Button>
            <Button as={RouterLink} to="/upload" variant="brand" size="sm">
              Upload media
            </Button>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

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

function formatSchedule(s: { start: string | null; end: string | null } | null): string | null {
  if (!s || (!s.start && !s.end)) return null;
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return null; }
  };
  const start = fmt(s.start);
  const end   = fmt(s.end);
  if (start && end)  return `${start} – ${end}`;
  if (start)         return `From ${start}`;
  if (end)           return `Until ${end}`;
  return null;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname;
  } catch {
    return url;
  }
}
