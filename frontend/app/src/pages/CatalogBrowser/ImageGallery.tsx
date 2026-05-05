// Phase 4 follow-up #3 — image gallery for the selected product.
//
// Stacks: primary product image (large) + a horizontal strip of
// thumbnails for additionalImages + per-match cropped images (so
// operators can see how the product showed up in actual UGC). Click
// a thumb to swap the main image. Empty state when no images at all.

import { useEffect, useState, useMemo } from 'react';
import { Box, HStack, VStack, Image, Text, Badge, Flex } from '@chakra-ui/react';
import type { CatalogDetail, CatalogMatchRow } from './types';

type Props = {
  product:  CatalogDetail;
  matches:  CatalogMatchRow[];
};

type GalleryEntry = {
  url:      string;
  kind:     'primary' | 'additional' | 'crop';
  label?:   string;
  source?:  string;        // creator handle / external id when crop
};

export function ImageGallery({ product, matches }: Props) {
  const entries = useMemo<GalleryEntry[]>(() => {
    const out: GalleryEntry[] = [];
    if (product.imageUrl) out.push({ url: product.imageUrl, kind: 'primary', label: 'Catalog' });
    for (const u of product.additionalImages || []) {
      if (u && u !== product.imageUrl) out.push({ url: u, kind: 'additional', label: 'Alt view' });
    }
    for (const m of matches) {
      if (m.croppedImageUrl) {
        out.push({
          url:    m.croppedImageUrl,
          kind:   'crop',
          label:  m.cropLabel || 'Match crop',
          source: m.media.creatorHandle || m.media.externalId
        });
      }
    }
    return out;
  }, [product, matches]);

  const [activeIdx, setActiveIdx] = useState(0);
  // Reset to first when product changes
  useEffect(() => { setActiveIdx(0); }, [product.id]);

  const active = entries[activeIdx] || null;

  return (
    <Box
      flex={1}
      minH={0}
      bg="gray.50"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Flex flex={1} align="center" justify="center" minH={0} p={5}>
        {active ? (
          <Box
            position="relative"
            bg="gray.100"
            borderRadius="md"
            overflow="hidden"
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              height: 'auto',
              width: 'auto'
            }}
          >
            <Image
              src={active.url}
              alt={active.label || 'product'}
              maxW="100%"
              maxH="62vh"
              objectFit="contain"
              display="block"
            />
            <Badge
              position="absolute"
              top={2}
              left={2}
              fontSize="9px"
              variant="subtle"
              colorScheme={active.kind === 'crop' ? 'purple' : active.kind === 'additional' ? 'gray' : 'blue'}
              px={2}
              py={0.5}
            >
              {active.label}{active.source ? ` · ${active.source}` : ''}
            </Badge>
          </Box>
        ) : (
          <VStack spacing={2}>
            <Text fontSize="md" fontWeight="700" color="brand.muted">No images</Text>
            <Text fontSize="xs" color="brand.muted" maxW="320px" textAlign="center">
              This product has no primary image, no additional images, and no per-match crops yet.
            </Text>
          </VStack>
        )}
      </Flex>

      {entries.length > 1 && (
        <HStack
          spacing={2}
          px={5}
          py={3}
          bg="brand.surface"
          borderTopWidth="1px"
          borderTopColor="brand.border"
          overflowX="auto"
        >
          {entries.map((e, i) => (
            <Thumb
              key={`${e.kind}-${i}`}
              entry={e}
              isActive={i === activeIdx}
              onClick={() => setActiveIdx(i)}
            />
          ))}
        </HStack>
      )}
    </Box>
  );
}

function Thumb({ entry, isActive, onClick }: { entry: GalleryEntry; isActive: boolean; onClick: () => void }) {
  const tone = entry.kind === 'crop' ? 'purple' : entry.kind === 'additional' ? 'gray' : 'blue';
  return (
    <Box flexShrink={0} cursor="pointer" onClick={onClick}>
      <Box
        w="80px" h="80px"
        borderRadius="md"
        overflow="hidden"
        borderWidth={isActive ? '2px' : '1px'}
        borderColor={isActive ? 'rsViolet.400' : 'brand.border'}
        bg="gray.100"
      >
        <Image src={entry.url} alt={entry.label || ''} w="100%" h="100%" objectFit="cover" />
      </Box>
      <Badge
        mt={1}
        fontSize="8px"
        variant="subtle"
        colorScheme={tone}
        textTransform="none"
        display="block"
        textAlign="center"
        px={1}
      >
        {entry.kind === 'crop' ? 'crop' : entry.kind === 'additional' ? 'alt' : 'main'}
      </Badge>
    </Box>
  );
}
