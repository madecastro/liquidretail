// Phase A-3 — three-tier reviews drill-in.
//
// Clicking a Detected Product opens a side panel showing what real
// customers said at three levels:
//   1. PRODUCT — CatalogProduct.productReviews (when known SKU)
//   2. CATEGORY — Category.categoryReviews (e.g. "Mens > Hoodies" sentiment)
//   3. BRAND — Brand.brandReviews (overall brand sentiment)
//
// Tiers are stacked top-down with a header per tier showing rating +
// review count when available. Empty tiers render a compact "no
// quotes yet" line so the surface is honest about coverage.

import {
  Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerHeader, DrawerBody,
  Box, Text, VStack, HStack, Heading, Badge, Divider, Image, Link
} from '@chakra-ui/react';
import type { DetectMatch, ReviewBlock, ReviewQuote } from './types';

type Props = {
  isOpen:  boolean;
  onClose: () => void;
  match:   DetectMatch | null;
};

export function ReviewsSlideOver({ isOpen, onClose, match }: Props) {
  if (!match) return null;
  const productReviews  = match.catalog?.productReviews  || match.productReviews  || null;
  const categoryReviews = match.categoryDoc?.categoryReviews || match.categoryReviews || null;
  const brandReviews    = match.brandReviews    || null;

  const productName = match.catalog?.title || match.identification?.productName || 'this product';
  const breadcrumb  = match.categoryDoc?.breadcrumb || match.brandCategory?.breadcrumb || null;
  const brandName   = match.identification?.brand || null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <HStack spacing={3} align="flex-start">
            {match.catalog?.imageUrl && (
              <Box w="40px" h="40px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                <Image src={match.catalog.imageUrl} alt={productName} w="100%" h="100%" objectFit="cover" />
              </Box>
            )}
            <Box>
              <Heading size="sm">{productName}</Heading>
              {breadcrumb && <Text fontSize="xs" color="brand.muted">{breadcrumb}</Text>}
            </Box>
          </HStack>
        </DrawerHeader>
        <DrawerBody>
          <VStack align="stretch" spacing={6} divider={<Divider />}>
            <ReviewTier
              tier="Product"
              subtitle={productName}
              reviews={productReviews}
              emptyHint="Product reviews populate after the first match against a known SKU."
            />
            <ReviewTier
              tier="Category"
              subtitle={breadcrumb || '—'}
              reviews={categoryReviews}
              emptyHint="Category reviews are fetched on-demand when a product_category outcome lands."
            />
            <ReviewTier
              tier="Brand"
              subtitle={brandName || '—'}
              reviews={brandReviews}
              emptyHint="Brand reviews populate during brand enrichment."
            />
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function ReviewTier({
  tier, subtitle, reviews, emptyHint
}: {
  tier: string;
  subtitle: string;
  reviews: ReviewBlock;
  emptyHint: string;
}) {
  const quotes = reviews?.quotes || [];
  const rating = reviews?.rating;
  const count  = reviews?.reviewCount;
  const summary = reviews?.summary;
  const sources = reviews?.sources || [];

  return (
    <Box>
      <HStack justify="space-between" align="baseline" mb={2}>
        <Box>
          <Heading size="xs">{tier} Reviews</Heading>
          <Text fontSize="10px" color="brand.muted">{subtitle}</Text>
        </Box>
        <HStack spacing={2}>
          {typeof rating === 'number' && (
            <Badge variant="subtle" fontSize="10px" colorScheme="green">{rating.toFixed(1)} ★</Badge>
          )}
          {typeof count === 'number' && (
            <Text fontSize="10px" color="brand.muted">{count.toLocaleString()} reviews</Text>
          )}
        </HStack>
      </HStack>

      {summary && (
        <Text fontSize="xs" color="brand.ink" lineHeight="1.5" mb={3} fontStyle="italic">
          {summary}
        </Text>
      )}

      {quotes.length === 0 ? (
        <Text fontSize="xs" color="brand.muted">{emptyHint}</Text>
      ) : (
        <VStack align="stretch" spacing={2}>
          {quotes.map((q, i) => <Quote key={i} q={q} />)}
        </VStack>
      )}

      {sources.length > 0 && (
        <HStack mt={3} spacing={2} wrap="wrap">
          <Text fontSize="9px" color="brand.muted">sources:</Text>
          {sources.map((s, i) => (
            <Text key={i} fontSize="9px" color="brand.muted">{s}</Text>
          ))}
        </HStack>
      )}
    </Box>
  );
}

function Quote({ q }: { q: ReviewQuote }) {
  return (
    <Box bg="gray.50" borderRadius="md" p={2}>
      <Text fontSize="xs" color="brand.ink" lineHeight="1.5">"{q.text}"</Text>
      {(q.author || q.source) && (
        <HStack mt={1} spacing={1}>
          {q.author && <Text fontSize="9px" color="brand.muted">— {q.author}</Text>}
          {q.source && (
            /^https?:\/\//.test(q.source)
              ? <Link href={q.source} isExternal fontSize="9px" color="brand.muted">{new URL(q.source).hostname}</Link>
              : <Text fontSize="9px" color="brand.muted">· {q.source}</Text>
          )}
        </HStack>
      )}
    </Box>
  );
}
