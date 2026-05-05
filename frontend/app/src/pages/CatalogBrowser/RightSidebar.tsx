// Phase 4 follow-up #3 — right rail with five tabs:
//   Summary       — title, description, brand, category, IDs, source
//                   provenance, refresh-AI links
//   Reviews       — productReviews narrative + Immersive review rows +
//                   rating distribution + sources
//   Specs         — Immersive spec key-value pairs
//   Sellers       — Google Shopping seller list with prices
//   Matched Media — list of media that matched this product (thumb +
//                   crop + outcome + creator handle + permalink)

import {
  Box, Tabs, TabList, Tab, TabPanels, TabPanel, VStack, HStack, Text, Badge,
  Card, CardBody, Heading, Image, Divider, Icon, Link
} from '@chakra-ui/react';
import type { CatalogDetail, CatalogMatchRow, SourceMediaRef, CatalogReviewRow, CatalogSeller, CatalogReviewQuote } from './types';
import { sourceTone, formatPrice, timeAgo, compactNumber } from './format';

type Props = {
  product:     CatalogDetail | null;
  sourceMedia: SourceMediaRef;
  matches:     CatalogMatchRow[];
};

export function RightSidebar({ product, sourceMedia, matches }: Props) {
  return (
    <Box
      w="420px"
      flexShrink={0}
      h="100%"
      minH={0}
      bg="brand.surface"
      borderLeftWidth="1px"
      borderLeftColor="brand.border"
      overflowY="auto"
    >
      <Tabs variant="line" size="sm" colorScheme="purple">
        <TabList px={3} pt={2} position="sticky" top={0} bg="brand.surface" zIndex={1}>
          <Tab fontSize="xs">Summary</Tab>
          <Tab fontSize="xs">Reviews</Tab>
          <Tab fontSize="xs">Specs</Tab>
          <Tab fontSize="xs">Sellers</Tab>
          <Tab fontSize="xs">Matches</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={4} py={4}><SummaryTab product={product} sourceMedia={sourceMedia} /></TabPanel>
          <TabPanel px={4} py={4}><ReviewsTab product={product} /></TabPanel>
          <TabPanel px={4} py={4}><SpecsTab product={product} /></TabPanel>
          <TabPanel px={4} py={4}><SellersTab product={product} /></TabPanel>
          <TabPanel px={4} py={4}><MatchesTab matches={matches} /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

// ── Summary ────────────────────────────────────────────────────────

function SummaryTab({ product, sourceMedia }: { product: CatalogDetail | null; sourceMedia: SourceMediaRef }) {
  if (!product) return <Text fontSize="sm" color="brand.muted">Select a product to see its summary.</Text>;
  const tone = sourceTone(product.source);

  return (
    <VStack align="stretch" spacing={4}>
      <Card variant="outline">
        <CardBody>
          <Heading size="xs" mb={2}>About</Heading>
          {product.description ? (
            <Text fontSize="sm" color="brand.ink" lineHeight="1.55">{product.description}</Text>
          ) : (
            <Text fontSize="xs" color="brand.muted" fontStyle="italic">No description.</Text>
          )}
        </CardBody>
      </Card>

      <Card variant="outline">
        <CardBody>
          <Heading size="xs" mb={3}>Identifiers</Heading>
          <VStack align="stretch" spacing={2}>
            <KV label="Brand"      value={product.brand} />
            <KV label="Category"   value={product.category} />
            {product.categoryBreadcrumb && <KV label="Breadcrumb" value={product.categoryBreadcrumb} />}
            <KV label="Source"     value={null}>
              <Badge fontSize="9px" variant="subtle" px={1.5} borderRadius="md" style={{ background: tone.bg, color: tone.fg }}>
                {tone.label}
              </Badge>
            </KV>
            <KV label="External ID" value={product.externalId} mono />
            {product.retailerId && <KV label="Retailer ID" value={product.retailerId} mono />}
            {product.gtin && <KV label="GTIN" value={product.gtin} mono />}
            {product.mpn  && <KV label="MPN"  value={product.mpn}  mono />}
            <KV label="Price"      value={formatPrice(product.price, product.currency)} />
            {product.availability && <KV label="Availability" value={product.availability} />}
          </VStack>
        </CardBody>
      </Card>

      {sourceMedia && (
        <Card variant="outline">
          <CardBody>
            <Heading size="xs" mb={2}>Detected from</Heading>
            <HStack align="flex-start" spacing={3}>
              <Box w="48px" h="48px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                {sourceMedia.fileUrl && <Image src={sourceMedia.fileUrl} alt="source" w="100%" h="100%" objectFit="cover" />}
              </Box>
              <Box flex={1} minW={0}>
                <Text fontSize="xs" color="brand.ink" noOfLines={1}>{sourceMedia.fileName || sourceMedia.externalId}</Text>
                <Text fontSize="10px" color="brand.muted">{sourceMedia.source}</Text>
                {sourceMedia.permalink && (
                  <Link href={sourceMedia.permalink} isExternal fontSize="10px" color="rsViolet.700" noOfLines={1}>
                    View original post
                  </Link>
                )}
                <Link as="a" href={`/media-library?mediaId=${sourceMedia.id}`} fontSize="10px" color="brand.muted" mt={0.5} display="block">
                  Open in Media Library →
                </Link>
              </Box>
            </HStack>
          </CardBody>
        </Card>
      )}

      {product.detailsRefreshedAt && (
        <Text fontSize="9px" color="brand.muted" textAlign="center">
          Immersive details refreshed {timeAgo(product.detailsRefreshedAt)}
        </Text>
      )}
    </VStack>
  );
}

function KV({ label, value, mono, children }: { label: string; value: string | null; mono?: boolean; children?: React.ReactNode }) {
  return (
    <HStack justify="space-between" align="flex-start" spacing={3}>
      <Text fontSize="xs" color="brand.muted" flexShrink={0} pt={0.5}>{label}</Text>
      <Box maxW="65%" textAlign="right">
        {children
          ? children
          : value
            ? <Text fontSize="xs" color="brand.ink" fontWeight="600" fontFamily={mono ? 'mono' : undefined} noOfLines={2}>{value}</Text>
            : <Text fontSize="xs" color="brand.muted">—</Text>}
      </Box>
    </HStack>
  );
}

// ── Reviews ────────────────────────────────────────────────────────

function ReviewsTab({ product }: { product: CatalogDetail | null }) {
  if (!product) return <Text fontSize="sm" color="brand.muted">Select a product to see its reviews.</Text>;

  const productReviews = product.productReviews || null;
  const immersive      = product.reviews || [];
  const distribution   = product.ratingDistribution || [];
  const reviewSummary  = (product.reviewSummary as Record<string, unknown> | null) || null;
  const summaryNarrative = stringField(reviewSummary?.['summary']) || stringField(reviewSummary?.['text']);
  // Sources can come back as bare strings OR objects (Gemini grounded
  // search returns { title, url, snippet }; productDetails normalizes
  // to domains). Coerce to a flat string list before rendering.
  const summarySources   = normalizeSourceList(reviewSummary?.['sources']);
  const productReviewSources = normalizeSourceList((productReviews as Record<string, unknown> | null)?.['sources']);

  const hasContent = (productReviews?.summary && String(productReviews.summary).trim())
                  || (productReviews?.quotes?.length ?? 0) > 0
                  || immersive.length > 0 || summaryNarrative;

  return (
    <VStack align="stretch" spacing={4}>
      <RatingHeader rating={product.rating} reviewCount={immersive.length} />

      {!hasContent ? (
        <Card variant="outline"><CardBody>
          <Text fontSize="xs" color="brand.muted" fontStyle="italic">
            No reviews yet for this product. Reviews populate the first time this row wins a product_match outcome (Gemini grounded search) and on subsequent matches via SerpAPI Immersive.
          </Text>
        </CardBody></Card>
      ) : (
        <>
          {(productReviews?.summary || summaryNarrative) && (
            <Card variant="outline">
              <CardBody>
                <Heading size="xs" mb={2}>Sentiment Summary</Heading>
                {productReviews?.summary && (
                  <Text fontSize="sm" color="brand.ink" lineHeight="1.55" fontStyle="italic">
                    "{stringField(productReviews.summary)}"
                  </Text>
                )}
                {summaryNarrative && summaryNarrative !== stringField(productReviews?.summary) && (
                  <Text fontSize="xs" color="brand.muted" mt={2} lineHeight="1.5">{summaryNarrative}</Text>
                )}
                {(productReviewSources.length || summarySources.length) ? (
                  <HStack mt={2} spacing={1.5} wrap="wrap">
                    <Text fontSize="9px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">Sources:</Text>
                    {(productReviewSources.length ? productReviewSources : summarySources).map((s, i) => (
                      <Badge key={i} variant="outline" fontSize="9px" px={1.5} fontWeight="500" textTransform="none">{s}</Badge>
                    ))}
                  </HStack>
                ) : null}
              </CardBody>
            </Card>
          )}

          {distribution.length > 0 && (
            <Card variant="outline">
              <CardBody>
                <Heading size="xs" mb={3}>Rating Distribution</Heading>
                <RatingDistribution rows={distribution} />
              </CardBody>
            </Card>
          )}

          {(productReviews?.quotes?.length ?? 0) > 0 && (
            <Card variant="outline">
              <CardBody>
                <Heading size="xs" mb={3}>Quotes (curated)</Heading>
                <VStack align="stretch" spacing={2}>
                  {(productReviews?.quotes || []).slice(0, 8).map((q, i) => <CuratedQuote key={i} q={q} />)}
                </VStack>
              </CardBody>
            </Card>
          )}

          {immersive.length > 0 && (
            <Card variant="outline">
              <CardBody>
                <Heading size="xs" mb={3}>Reviews ({immersive.length})</Heading>
                <VStack align="stretch" spacing={3} divider={<Divider />}>
                  {immersive.slice(0, 12).map((r, i) => <ImmersiveRow key={i} review={r} />)}
                </VStack>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </VStack>
  );
}

function RatingHeader({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  if (rating == null && !reviewCount) return null;
  return (
    <HStack spacing={4} align="center">
      {rating != null && (
        <HStack spacing={1}>
          <Icon viewBox="0 0 24 24" w="20px" h="20px" color="#F59E0B"><path fill="currentColor" d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5l-6.3 4.5L8 13.9 2 9.4h7.6z" /></Icon>
          <Text fontSize="2xl" fontWeight="800" color="brand.ink" lineHeight="1">{rating.toFixed(1)}</Text>
          <Text fontSize="xs" color="brand.muted" alignSelf="flex-end" pb={1}>/ 5</Text>
        </HStack>
      )}
      {reviewCount > 0 && (
        <Text fontSize="xs" color="brand.muted">{compactNumber(reviewCount)} reviews</Text>
      )}
    </HStack>
  );
}

function RatingDistribution({ rows }: { rows: Array<Record<string, unknown>> }) {
  // SerpAPI Immersive shape: [{ stars: 5, count: 1234, percentage: '76%' }, ...]
  const sorted = rows.slice().sort((a, b) => Number(b['stars'] || 0) - Number(a['stars'] || 0));
  const max    = Math.max(...sorted.map(r => Number(r['count'] || 0)), 1);
  return (
    <VStack align="stretch" spacing={1.5}>
      {sorted.map((r, i) => {
        const stars = Number(r['stars'] || 0);
        const count = Number(r['count'] || 0);
        const pct   = (count / max) * 100;
        return (
          <HStack key={i} spacing={2}>
            <Text fontSize="10px" color="brand.muted" w="22px" flexShrink={0}>{stars}★</Text>
            <Box flex={1} h="6px" bg="gray.100" borderRadius="full" overflow="hidden">
              <Box h="100%" w={`${pct}%`} bg="#F59E0B" />
            </Box>
            <Text fontSize="10px" color="brand.muted" w="48px" textAlign="right" flexShrink={0}>
              {compactNumber(count)}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}

function CuratedQuote({ q }: { q: CatalogReviewQuote }) {
  const text   = stringField(q.text);
  const author = stringField(q.author);
  const source = stringField(q.source);
  if (!text) return null;
  return (
    <Box bg="gray.50" borderRadius="md" p={2.5} borderLeftWidth="3px" borderLeftColor="rsViolet.400">
      <Text fontSize="sm" color="brand.ink" lineHeight="1.5">"{text}"</Text>
      {(author || source) && (
        <HStack mt={1} spacing={2}>
          {author && <Text fontSize="10px" color="brand.muted">— {author}</Text>}
          {source && <Text fontSize="10px" color="brand.muted">· {source}</Text>}
        </HStack>
      )}
    </Box>
  );
}

// ── safety helpers ─────────────────────────────────────────────────

// Pull a string out of a value that might be a string, an object with
// a string-y key, or null. Anything else returns null so the caller
// can skip rendering instead of crashing on object-as-child.
function stringField(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

// Source lists arrive as either string[] OR Array<{ title?, url?,
// domain?, name?, snippet? }>. Normalize to a flat string list of
// human-readable labels (prefer a domain/host > title > name).
function normalizeSourceList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(s => {
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object') {
      const o = s as Record<string, unknown>;
      const url = stringField(o.url) || stringField(o.link);
      if (url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); } catch { /* fallthrough */ }
      }
      return stringField(o.domain) || stringField(o.title) || stringField(o.name) || '';
    }
    return '';
  }).filter(Boolean);
}

function ImmersiveRow({ review }: { review: CatalogReviewRow }) {
  const stars  = typeof review.rating === 'number' ? review.rating : null;
  const title  = typeof review.title  === 'string' ? review.title  : null;
  const text   = typeof review.text   === 'string' ? review.text   : null;
  const author = typeof review.author === 'string' ? review.author : null;
  const date   = typeof review.date   === 'string' ? review.date   : null;
  const src    = typeof review.source === 'string' ? review.source : null;
  return (
    <Box>
      {(stars != null || title) && (
        <HStack spacing={2} mb={1}>
          {stars != null && (
            <HStack spacing={0.5}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} as="span" color={i < (stars ?? 0) ? '#F59E0B' : 'gray.300'} fontSize="11px">★</Box>
              ))}
            </HStack>
          )}
          {title && <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={1}>{title}</Text>}
        </HStack>
      )}
      {text && <Text fontSize="xs" color="brand.ink" lineHeight="1.5" noOfLines={6}>{text}</Text>}
      {(author || date || src) && (
        <HStack mt={1} spacing={2}>
          {author && <Text fontSize="9px" color="brand.muted">— {author}</Text>}
          {date   && <Text fontSize="9px" color="brand.muted">· {date}</Text>}
          {src    && <Text fontSize="9px" color="brand.muted">· {src}</Text>}
        </HStack>
      )}
    </Box>
  );
}

// ── Specs ──────────────────────────────────────────────────────────

function SpecsTab({ product }: { product: CatalogDetail | null }) {
  if (!product) return <Text fontSize="sm" color="brand.muted">Select a product to see its specs.</Text>;
  const specs = (product.specs as Record<string, unknown> | null) || null;
  // Immersive may store either flat key=>value OR an array of groups:
  // [{title, items:[{name, value}]}]. Render either shape.
  const flatEntries = specs && !Array.isArray(specs) && typeof specs === 'object'
    ? Object.entries(specs as Record<string, unknown>).filter(([, v]) => v != null && typeof v !== 'object')
    : [];
  const groupShape  = specs && Array.isArray((specs as Record<string, unknown>)['groups'])
    ? ((specs as Record<string, unknown>)['groups'] as Array<Record<string, unknown>>)
    : Array.isArray(specs)
      ? (specs as Array<Record<string, unknown>>)
      : [];

  if (flatEntries.length === 0 && groupShape.length === 0) {
    return <Card variant="outline"><CardBody>
      <Text fontSize="xs" color="brand.muted" fontStyle="italic">
        No specs captured. Specs populate from SerpAPI Immersive Product on the first product_match.
      </Text>
    </CardBody></Card>;
  }

  return (
    <VStack align="stretch" spacing={4}>
      {flatEntries.length > 0 && (
        <Card variant="outline"><CardBody>
          <Heading size="xs" mb={3}>Details</Heading>
          <VStack align="stretch" spacing={1.5}>
            {flatEntries.slice(0, 30).map(([k, v]) => (
              <KV key={k} label={String(k)} value={stringField(v) || String(v)} />
            ))}
          </VStack>
        </CardBody></Card>
      )}
      {groupShape.map((g, gi) => (
        <Card key={gi} variant="outline"><CardBody>
          <Heading size="xs" mb={3}>{stringField(g['title']) || stringField(g['name']) || 'Specs'}</Heading>
          <VStack align="stretch" spacing={1.5}>
            {((g['items'] as Array<Record<string, unknown>>) || []).slice(0, 30).map((it, i) => (
              <KV
                key={i}
                label={stringField(it['name']) || stringField(it['key']) || ''}
                value={stringField(it['value']) || stringField(it['text']) || ''}
              />
            ))}
          </VStack>
        </CardBody></Card>
      ))}
    </VStack>
  );
}

// ── Sellers ────────────────────────────────────────────────────────

function SellersTab({ product }: { product: CatalogDetail | null }) {
  if (!product) return <Text fontSize="sm" color="brand.muted">Select a product to see its sellers.</Text>;
  const sellers = product.sellers || [];
  if (sellers.length === 0) {
    return <Card variant="outline"><CardBody>
      <Text fontSize="xs" color="brand.muted" fontStyle="italic">
        No sellers captured. Sellers populate from SerpAPI Google Shopping on the first product_match.
      </Text>
    </CardBody></Card>;
  }
  return (
    <Card variant="outline"><CardBody>
      <Heading size="xs" mb={3}>Sellers ({sellers.length})</Heading>
      <VStack align="stretch" spacing={2.5} divider={<Divider />}>
        {sellers.slice(0, 12).map((s, i) => <SellerRow key={i} seller={s} />)}
      </VStack>
    </CardBody></Card>
  );
}

function SellerRow({ seller }: { seller: CatalogSeller }) {
  const name = String(seller.name || seller['source'] || '(unknown)');
  const link = typeof seller.link === 'string' ? seller.link : null;
  return (
    <HStack align="flex-start" spacing={3}>
      {seller.thumbnail && (
        <Box w="36px" h="36px" borderRadius="sm" overflow="hidden" bg="gray.100" flexShrink={0}>
          <Image src={seller.thumbnail} alt={name} w="100%" h="100%" objectFit="contain" />
        </Box>
      )}
      <Box flex={1} minW={0}>
        {link
          ? <Link href={link} isExternal fontSize="xs" fontWeight="700" color="rsViolet.700" noOfLines={1}>{name}</Link>
          : <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={1}>{name}</Text>}
        <HStack spacing={2} mt={0.5} wrap="wrap">
          {seller.price    && <Text fontSize="11px" color="brand.ink" fontWeight="600">{String(seller.price)}</Text>}
          {seller.shipping && <Text fontSize="10px" color="brand.muted">+ {String(seller.shipping)}</Text>}
          {seller.total    && <Text fontSize="10px" color="brand.muted">total {String(seller.total)}</Text>}
        </HStack>
      </Box>
    </HStack>
  );
}

// ── Matches ────────────────────────────────────────────────────────

function MatchesTab({ matches }: { matches: CatalogMatchRow[] }) {
  if (!matches.length) {
    return <Card variant="outline"><CardBody>
      <Text fontSize="xs" color="brand.muted" fontStyle="italic">
        No media has matched this product yet.
      </Text>
    </CardBody></Card>;
  }
  return (
    <Card variant="outline"><CardBody>
      <Heading size="xs" mb={3}>Matched Media ({matches.length})</Heading>
      <VStack align="stretch" spacing={3} divider={<Divider />}>
        {matches.map(m => <MatchRow key={`${m.mediaId}-${m.runArtifactId}`} m={m} />)}
      </VStack>
    </CardBody></Card>
  );
}

function MatchRow({ m }: { m: CatalogMatchRow }) {
  const outcomeColor = m.outcome === 'product_match'    ? 'green'
                     : m.outcome === 'product_category' ? 'orange'
                     : 'gray';
  return (
    <Box>
      <HStack align="flex-start" spacing={3}>
        <Box w="56px" h="56px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
          {m.croppedImageUrl
            ? <Image src={m.croppedImageUrl} alt="match crop" w="100%" h="100%" objectFit="cover" />
            : <Image src={m.media.fileUrl} alt="media" w="100%" h="100%" objectFit="cover" />}
        </Box>
        <Box flex={1} minW={0}>
          <HStack spacing={2}>
            <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={1}>
              {m.media.creatorHandle || m.media.fileName || m.media.externalId}
            </Text>
            {m.outcome && <Badge fontSize="9px" variant="subtle" colorScheme={outcomeColor}>{m.outcome}</Badge>}
            {m.media.detectOutcome && (
              <Badge fontSize="9px" variant="outline">{m.media.detectOutcome}</Badge>
            )}
          </HStack>
          <HStack mt={0.5} spacing={2} wrap="wrap">
            {m.confidence != null && (
              <Text fontSize="10px" color="brand.muted">{Math.round((m.confidence ?? 0) * 100)}% confidence</Text>
            )}
            {m.cropLabel && <Text fontSize="10px" color="brand.muted">· "{m.cropLabel}"</Text>}
          </HStack>
          <HStack mt={0.5} spacing={2} wrap="wrap">
            {m.media.likes    != null && <Text fontSize="10px" color="brand.muted">♥ {compactNumber(m.media.likes)}</Text>}
            {m.media.comments != null && <Text fontSize="10px" color="brand.muted">💬 {compactNumber(m.media.comments)}</Text>}
            <Text fontSize="10px" color="brand.muted">{timeAgo(m.media.postedAt || m.artifactCreatedAt)}</Text>
          </HStack>
          <HStack mt={1} spacing={2}>
            <Link as="a" href={`/media-library?mediaId=${m.mediaId}`} fontSize="10px" color="rsViolet.700">Open in Media Library →</Link>
            {m.media.permalink && <Link href={m.media.permalink} isExternal fontSize="10px" color="brand.muted">Original post →</Link>}
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}
