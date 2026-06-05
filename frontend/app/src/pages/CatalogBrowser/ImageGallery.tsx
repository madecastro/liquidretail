// Catalog browser — image gallery for the selected product.
//
// Stacks: primary catalog hero (large) + a horizontal strip of
// thumbnails for additionalImages + the LLM-judged ad-crop winners
// (5:4, 1:1, 4:5) of the catalog hero. Click a thumb to swap the
// main image. Empty state when no images at all.
//
// (Per-match YOLO crops moved OUT of the gallery — they belong to the
//  matched UGC posts, not the catalog hero, and were misleading the
//  operator into thinking they were judged crops of this product.)

import { useEffect, useState, useMemo } from 'react';
import { Box, HStack, VStack, Image, Text, Badge, Flex } from '@chakra-ui/react';
import type { CatalogDetail, HeroCrops } from './types';

type Props = {
  product:        CatalogDetail;
  heroCrops:      HeroCrops;
  altCrops:       HeroCrops[];
  activeAltIndex: number | null;     // null = parent hero is the gallery's primary
};

type GalleryEntry = {
  url:      string;
  kind:     'primary' | 'additional' | 'crop';
  label?:   string;
  source?:  string;
};

export function ImageGallery({ product, heroCrops, altCrops, activeAltIndex }: Props) {
  // When an alt is the gallery's active item (clicked from the left
  // rail alt-fanout), the "primary" tile becomes the alt's image and
  // the judged crops come from altCrops[index]. Otherwise we show the
  // parent hero + its own crops.
  const isAltActive = activeAltIndex != null;
  const activeAltUrl = isAltActive
    ? (product.additionalImages?.[activeAltIndex!] || null)
    : null;
  const activeCrops = isAltActive
    ? (altCrops?.[activeAltIndex!] || null)
    : heroCrops;
  const primaryUrl = isAltActive ? activeAltUrl : product.imageUrl;
  const primaryLabel = isAltActive
    ? `Alt ${activeAltIndex! + 1}`
    : 'Catalog hero';

  const entries = useMemo<GalleryEntry[]>(() => {
    const out: GalleryEntry[] = [];
    if (primaryUrl) out.push({ url: primaryUrl, kind: 'primary', label: primaryLabel });
    // LLM-judged ad-crop winners for whichever image is the gallery's
    // primary (parent hero OR the selected alt). These are the framings
    // the renderer will use when this image becomes a hero in an ad.
    if (activeCrops) {
      for (const ratio of ['5:4', '1:1', '4:5'] as const) {
        const url = activeCrops[ratio];
        if (url) out.push({ url, kind: 'crop', label: `Judged ${ratio} crop` });
      }
    }
    return out;
  }, [primaryUrl, primaryLabel, activeCrops]);

  const [activeIdx, setActiveIdx] = useState(0);
  // Reset to first when the gallery's primary changes (product OR alt swap).
  useEffect(() => { setActiveIdx(0); }, [product.id, activeAltIndex]);

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
