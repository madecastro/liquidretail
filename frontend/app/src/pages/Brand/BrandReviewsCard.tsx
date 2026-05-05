// Phase 4 follow-up — Brand Reviews card.
//
// Displays the brandReviews snapshot populated by the brand-reviews
// enrichment tier (Gemini grounded search). Shows the one-sentence
// summary, rating + review count when present, and the verbatim
// customer quotes with author + source.
//
// Refresh button re-runs the full enrichment chain (same endpoint as
// the header's Refresh AI). A tier-scoped refresh ('refresh just the
// brand-reviews tier') is a separate small backlog item.

import { useState } from 'react';
import {
  Card, CardBody, HStack, VStack, Box, Text, Heading, Badge, Button, Icon, Link,
  Divider, Wrap, WrapItem, useToast
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import type { Brand, BrandReviewQuote } from './types';

type Props = { brand: Brand; onChanged: () => void };

export function BrandReviewsCard({ brand, onChanged }: Props) {
  const reviews = brand.brandReviews || null;
  const toast   = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiJson(`/api/brand/${brand._id}/refresh-enrichment`, { method: 'POST' });
      toast({
        title: 'Refresh queued',
        description: 'Brand reviews will repopulate from Gemini grounded search in ~60s.',
        status: 'info',
        duration: 4000
      });
      onChanged();
    } catch (err: unknown) {
      toast({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setRefreshing(false);
    }
  };

  const quotes  = (reviews?.quotes  || []).filter(q => q?.text);
  const sources = ((reviews as Record<string, unknown> | null)?.['sources'] as string[] | undefined) || [];
  const hasContent = !!(reviews?.summary || quotes.length || reviews?.rating);

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={3} align="flex-start">
          <HStack spacing={2}>
            <QuoteIcon />
            <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">Brand Reviews</Heading>
            {reviews?.source && (
              <Badge variant="subtle" colorScheme="purple" fontSize="9px" px={1.5}>{reviews.source}</Badge>
            )}
          </HStack>
          <HStack spacing={2}>
            {reviews?.fetchedAt && (
              <Text fontSize="10px" color="brand.muted">Updated {timeAgo(reviews.fetchedAt)}</Text>
            )}
            <Button size="xs" variant="outline" onClick={handleRefresh} isLoading={refreshing} leftIcon={<RefreshIcon />}>
              Refresh
            </Button>
          </HStack>
        </HStack>

        {!hasContent ? (
          <EmptyState />
        ) : (
          <VStack align="stretch" spacing={4}>
            {/* Summary + rating header */}
            <HStack align="flex-start" justify="space-between" spacing={4}>
              {reviews?.summary && (
                <Text fontSize="sm" color="brand.ink" lineHeight="1.55" flex={1} fontStyle="italic">
                  "{reviews.summary}"
                </Text>
              )}
              {(typeof reviews?.rating === 'number' || typeof reviews?.reviewCount === 'number') && (
                <RatingBlock rating={reviews?.rating ?? null} reviewCount={reviews?.reviewCount ?? null} />
              )}
            </HStack>

            {/* Quote list */}
            {quotes.length > 0 && (
              <>
                <Divider />
                <VStack align="stretch" spacing={2.5}>
                  {quotes.map((q, i) => <QuoteRow key={i} quote={q} />)}
                </VStack>
              </>
            )}

            {/* Source footer */}
            {sources.length > 0 && (
              <HStack pt={2} borderTopWidth="1px" borderTopColor="brand.border" spacing={2} wrap="wrap">
                <Text fontSize="9px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">Sources:</Text>
                <Wrap spacing={1.5}>
                  {sources.map((s, i) => (
                    <WrapItem key={i}>
                      <Badge variant="outline" fontSize="9px" px={1.5} textTransform="none" fontWeight="500">
                        {s}
                      </Badge>
                    </WrapItem>
                  ))}
                </Wrap>
              </HStack>
            )}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

function RatingBlock({ rating, reviewCount }: { rating: number | null; reviewCount: number | null }) {
  return (
    <Box flexShrink={0} textAlign="right">
      {typeof rating === 'number' && (
        <HStack spacing={1} justify="flex-end">
          <StarIcon />
          <Text fontSize="lg" fontWeight="800" color="brand.ink" lineHeight="1">{rating.toFixed(1)}</Text>
          <Text fontSize="xs" color="brand.muted">/ 5</Text>
        </HStack>
      )}
      {typeof reviewCount === 'number' && reviewCount > 0 && (
        <Text fontSize="10px" color="brand.muted" mt={0.5}>
          {reviewCount.toLocaleString()} review{reviewCount === 1 ? '' : 's'}
        </Text>
      )}
    </Box>
  );
}

function QuoteRow({ quote }: { quote: BrandReviewQuote }) {
  const sourceUrl = quote.source && /^https?:\/\//.test(quote.source) ? quote.source : null;
  return (
    <Box bg="gray.50" borderRadius="md" p={3} borderLeftWidth="3px" borderLeftColor="rsViolet.400">
      <Text fontSize="sm" color="brand.ink" lineHeight="1.55">"{quote.text}"</Text>
      {(quote.author || quote.source) && (
        <HStack mt={1.5} spacing={2}>
          {quote.author && <Text fontSize="11px" color="brand.muted">— {quote.author}</Text>}
          {sourceUrl
            ? <Link href={sourceUrl} isExternal fontSize="11px" color="brand.muted">{hostname(sourceUrl)}</Link>
            : quote.source && <Text fontSize="11px" color="brand.muted">· {quote.source}</Text>}
        </HStack>
      )}
    </Box>
  );
}

function EmptyState() {
  return (
    <Box py={6} textAlign="center">
      <Text fontSize="sm" color="brand.muted" fontStyle="italic" mb={1}>
        No reviews yet for this brand.
      </Text>
      <Text fontSize="xs" color="brand.muted">
        Brand reviews populate during enrichment via Gemini grounded search.
        Click <strong>Refresh</strong> above (or <strong>Refresh AI</strong> in the header) to fetch.
      </Text>
    </Box>
  );
}

function timeAgo(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60)  return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)  return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return iso; }
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function QuoteIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px" color="rsViolet.500"><path fill="currentColor" d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" /></Icon>;
}
function RefreshIcon() {
  return <Icon viewBox="0 0 24 24" w="12px" h="12px"><path fill="currentColor" d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.7 10h-2.06A6 6 0 1 1 12 6a5.95 5.95 0 0 1 4.22 1.78L13 11h7V4l-2.35 2.35z" /></Icon>;
}
function StarIcon() {
  return <Icon viewBox="0 0 24 24" w="16px" h="16px" color="#F59E0B"><path fill="currentColor" d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5l-6.3 4.5L8 13.9 2 9.4h7.6z" /></Icon>;
}
