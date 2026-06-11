// Horizontal-scrolling picker used by Step 2 for products and media
// (and the cross-direction "related" sub-ribbons surfaced when an
// item is selected). Generic on the row shape — caller provides:
//
//   items:      array of rows
//   getId:      (row) => unique key
//   render:     (row, selected, onClick) => ReactNode for one tile
//   loading:    optional spinner state
//   emptyHint:  optional empty-state text
//
// Selection lives in the parent — RibbonPicker is presentational.

import { Box, HStack, Text, Spinner, Flex, Tooltip } from '@chakra-ui/react';
import type { ReactNode } from 'react';

// Per-seed concept-usage state, fetched from /api/seeds/usage and
// surfaced as a dot row + ad-count badge on each tile so the operator
// can decide whether this seed has fresh angles left to render against.
export type SeedUsage = {
  adCount:           number;
  conceptsTotal:     number;
  conceptsUsed:      number;
  conceptsRemaining: { id: string; name: string }[];
};

// Compact tile overlay — top-left ad-count badge + bottom-left dot row.
// Top-right is reserved for the selection checkmark; bottom-left dots
// stay clear of the bottom-right where MediaTile shows the VIDEO badge.
// Hover surfaces the full breakdown via a Chakra Tooltip.
function SeedUsageOverlay({ usage }: { usage: SeedUsage }) {
  const { adCount, conceptsTotal, conceptsUsed, conceptsRemaining } = usage;
  const isFresh     = adCount === 0;
  const isExhausted = conceptsTotal > 0 && conceptsUsed >= conceptsTotal;

  const tooltipLabel = isFresh
    ? 'Brand-new seed — Director will emit fresh concepts on first run'
    : `${adCount} ad${adCount === 1 ? '' : 's'} rendered · ${conceptsUsed} of ${conceptsTotal} directions used`
      + (conceptsRemaining.length
          ? `\nFresh angles: ${conceptsRemaining.slice(0, 4).map(c => c.name).join(', ')}`
          : conceptsTotal > 0 ? '\nAll directions explored — re-runs rotate via runId' : '');

  return (
    <Tooltip label={tooltipLabel} placement="top" hasArrow whiteSpace="pre-line" fontSize="11px">
      <Box position="absolute" inset={0} pointerEvents="none">
        {/* Ad-count badge — top-left, hidden on fresh seeds */}
        {!isFresh && (
          <Box
            position="absolute" top={1.5} left={1.5}
            bg={isExhausted ? 'green.600' : 'blackAlpha.700'}
            color="white"
            px={1.5} py={0.5}
            borderRadius="md"
            fontSize="9px" fontWeight="800"
            letterSpacing="0.04em"
            pointerEvents="auto"
          >
            {isExhausted ? `ALL ${adCount}` : `${adCount} AD${adCount === 1 ? '' : 'S'}`}
          </Box>
        )}
        {/* Dot row — bottom-left, only when Director has concepts */}
        {conceptsTotal > 0 && (
          <HStack
            position="absolute" bottom={1.5} left={1.5}
            spacing={0.5}
            bg="blackAlpha.700"
            px={1.5} py={1}
            borderRadius="md"
            pointerEvents="auto"
          >
            {/* Up to 6 dots — past that, switch to fraction text */}
            {conceptsTotal <= 6 ? (
              Array.from({ length: conceptsTotal }).map((_, i) => (
                <Box
                  key={i}
                  w="6px" h="6px"
                  borderRadius="full"
                  bg={i < conceptsUsed ? (isExhausted ? 'green.300' : 'rsViolet.300') : 'whiteAlpha.500'}
                  borderWidth={i < conceptsUsed ? 0 : '1px'}
                  borderColor="whiteAlpha.700"
                />
              ))
            ) : (
              <Text fontSize="9px" color="white" fontWeight="800" letterSpacing="0.04em">
                {conceptsUsed}/{conceptsTotal}
              </Text>
            )}
          </HStack>
        )}
      </Box>
    </Tooltip>
  );
}

type Props<T> = {
  items:        T[];
  getId:        (row: T) => string;
  render:       (row: T, selected: boolean, onClick: () => void) => ReactNode;
  selectedIds:  Set<string>;
  onToggle:     (id: string) => void;
  loading?:     boolean;
  emptyHint?:   string;
};

export function RibbonPicker<T>({
  items, getId, render, selectedIds, onToggle, loading, emptyHint
}: Props<T>) {
  if (loading && items.length === 0) {
    return (
      <Flex h="120px" align="center" justify="center" bg="gray.50" borderRadius="md">
        <Spinner size="sm" />
      </Flex>
    );
  }
  if (items.length === 0) {
    return (
      <Flex h="120px" align="center" justify="center" bg="gray.50" borderRadius="md">
        <Text fontSize="xs" color="brand.muted">{emptyHint || 'Nothing here yet.'}</Text>
      </Flex>
    );
  }
  return (
    <Box
      overflowX="auto"
      overflowY="hidden"
      pb={2}
      sx={{
        // Tighten the scrollbar so it doesn't dominate the strip
        '&::-webkit-scrollbar':       { height: '8px' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.18)', borderRadius: '4px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' }
      }}
    >
      <HStack spacing={3} align="stretch" minW="min-content">
        {items.map(row => {
          const id = getId(row);
          const selected = selectedIds.has(id);
          return (
            <Box key={id} flexShrink={0}>
              {render(row, selected, () => onToggle(id))}
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}

// Standard tile shapes — caller can opt out and roll their own render
// fn, but these match the visual language used across the wizard.

export function ProductTile({
  product, selected, onClick, usage
}: {
  product: { id: string; title: string; imageUrl: string | null; price?: number | null; currency?: string | null; brand?: string | null };
  selected: boolean;
  onClick: () => void;
  usage?: SeedUsage;
}) {
  return (
    <Box
      as="button"
      onClick={onClick}
      w="160px"
      bg="brand.surface"
      borderWidth="2px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      borderRadius="md"
      overflow="hidden"
      textAlign="left"
      transition="all 120ms"
      _hover={{ borderColor: selected ? 'rsViolet.400' : 'gray.300' }}
      boxShadow={selected ? '0 0 0 3px rgba(122,53,232,0.18)' : undefined}
    >
      <Box w="100%" h="120px" bg="gray.100" position="relative">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        )}
        {selected && (
          <Box
            position="absolute" top={1.5} right={1.5}
            bg="rsViolet.500" color="white"
            w="20px" h="20px" borderRadius="full"
            display="flex" alignItems="center" justifyContent="center"
            fontSize="11px" fontWeight="800"
          >
            ✓
          </Box>
        )}
        {usage && <SeedUsageOverlay usage={usage} />}
      </Box>
      <Box p={2}>
        <Text fontSize="11px" fontWeight="700" color="brand.ink" noOfLines={2}>{product.title}</Text>
        {product.price != null && (
          <Text fontSize="10px" color="brand.muted" mt={0.5}>
            {product.currency || ''} {Number(product.price).toFixed(2)}
          </Text>
        )}
      </Box>
    </Box>
  );
}

export function MediaTile({
  media, selected, onClick, usage
}: {
  media: { id: string; fileType: 'image' | 'video'; fileUrl: string; creatorHandle?: string | null; primarySubjectLabel?: string | null };
  selected: boolean;
  onClick: () => void;
  usage?: SeedUsage;
}) {
  // Video sources need a Cloudinary first-frame transform — same trick
  // the media-library Sidebar uses. Falls through to the raw fileUrl
  // for non-Cloudinary or image media.
  const isVideo = media.fileType === 'video';
  const thumbSrc = isVideo
    ? (media.fileUrl.includes('/video/upload/')
        ? media.fileUrl.replace('/video/upload/', '/video/upload/so_0/').replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, '.jpg$2')
        : media.fileUrl)
    : media.fileUrl;
  const label = media.primarySubjectLabel || media.creatorHandle || (isVideo ? 'Video' : 'Image');
  return (
    <Box
      as="button"
      onClick={onClick}
      w="120px"
      bg="brand.surface"
      borderWidth="2px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      borderRadius="md"
      overflow="hidden"
      textAlign="left"
      transition="all 120ms"
      _hover={{ borderColor: selected ? 'rsViolet.400' : 'gray.300' }}
      boxShadow={selected ? '0 0 0 3px rgba(122,53,232,0.18)' : undefined}
    >
      <Box w="100%" h="150px" bg="gray.100" position="relative">
        {thumbSrc && (
          <img
            src={thumbSrc}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        )}
        {isVideo && (
          <Box
            position="absolute" bottom={1} left={1}
            bg="blackAlpha.700" color="white"
            px={1.5} py={0.5} borderRadius="md"
            fontSize="9px" fontWeight="800"
          >
            VIDEO
          </Box>
        )}
        {selected && (
          <Box
            position="absolute" top={1.5} right={1.5}
            bg="rsViolet.500" color="white"
            w="20px" h="20px" borderRadius="full"
            display="flex" alignItems="center" justifyContent="center"
            fontSize="11px" fontWeight="800"
          >
            ✓
          </Box>
        )}
        {usage && <SeedUsageOverlay usage={usage} />}
      </Box>
      <Box p={1.5}>
        <Text fontSize="10px" fontWeight="700" color="brand.ink" noOfLines={1}>{label}</Text>
      </Box>
    </Box>
  );
}
