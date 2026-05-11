// Phase 4 follow-up #3 — top metadata strip above the gallery.

import { HStack, VStack, Text, Badge, Box, Link, IconButton, Icon, Button } from '@chakra-ui/react';
import { sourceTone, formatPrice, timeAgo } from './format';
import type { CatalogDetail } from './types';

export function CatalogHeader({ product, totalMatches }: { product: CatalogDetail; totalMatches: number }) {
  const tone = sourceTone(product.source);
  return (
    <HStack
      px={5}
      py={3}
      spacing={3}
      align="center"
      bg="brand.surface"
      borderBottomWidth="1px"
      borderBottomColor="brand.border"
    >
      <VStack align="flex-start" spacing={0.5} flex={1} minW={0}>
        <HStack spacing={2}>
          <Text fontSize="md" fontWeight="700" color="brand.ink" noOfLines={1}>{product.title}</Text>
          <Badge fontSize="9px" variant="subtle" px={1.5} borderRadius="md" style={{ background: tone.bg, color: tone.fg }}>
            {tone.label}
          </Badge>
          {product.draft && <Badge fontSize="9px" variant="subtle" colorScheme="orange">Draft</Badge>}
        </HStack>
        <Text fontSize="xs" color="brand.muted" noOfLines={1} w="100%">
          {[
            product.brand || '—',
            product.categoryBreadcrumb || null,
            product.lastSyncedAt ? `last sync ${timeAgo(product.lastSyncedAt)}` : null
          ].filter(Boolean).join(' · ')}
        </Text>
      </VStack>

      <VStack align="flex-end" spacing={0.5} flexShrink={0}>
        <Text fontSize="lg" fontWeight="800" color="brand.ink" lineHeight="1">{formatPrice(product.price, product.currency)}</Text>
        <HStack spacing={2}>
          {product.availability && <Text fontSize="10px" color="brand.muted">{product.availability}</Text>}
          {totalMatches > 0 && (
            <Badge fontSize="9px" variant="subtle" colorScheme="purple">{totalMatches} match{totalMatches === 1 ? '' : 'es'}</Badge>
          )}
        </HStack>
      </VStack>

      {product.productUrl && (
        <Button
          as={Link}
          href={product.productUrl}
          isExternal
          size="sm"
          variant="outline"
          rightIcon={<ExternalIcon />}
        >
          View on site
        </Button>
      )}

      <IconButton aria-label="More" variant="ghost" size="sm" icon={<KebabIcon />} />
      {/* `Box` empty to keep gap consistent with MediaLibrary header style */}
      <Box />
    </HStack>
  );
}

function ExternalIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M14 3v2h3.59L8.29 14.29l1.42 1.42L19 6.41V10h2V3h-7zM5 5h6V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6h-2v6H5V5z" /></Icon>;
}
function KebabIcon() {
  return <Icon viewBox="0 0 24 24" w="16px" h="16px"><path fill="currentColor" d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" /></Icon>;
}
