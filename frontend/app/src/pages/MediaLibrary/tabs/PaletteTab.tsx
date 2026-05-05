// Phase A-2 — Palette tab.
//
// Shows the background.palette[] hex colors as swatches with their
// hex values. Future iterations could surface dominant-color cluster
// bars, complementary suggestions, or contrast-ratio hints; this is
// the simplest useful surface for A-2.

import { Box, Card, CardBody, Heading, HStack, VStack, Text, SimpleGrid } from '@chakra-ui/react';
import type { DetectResult } from '../types';

export function PaletteTab({ detect }: { detect: DetectResult | null }) {
  if (!detect) return <Text fontSize="sm" color="brand.muted">No detect data yet.</Text>;
  const palette = (detect.background?.palette || []).filter(c => /^#[0-9a-fA-F]{6}$/.test(c));

  return (
    <Card variant="outline">
      <CardBody>
        <Heading size="xs" mb={3}>Background Palette</Heading>
        {palette.length === 0 ? (
          <Text fontSize="xs" color="brand.muted">No palette extracted.</Text>
        ) : (
          <SimpleGrid columns={2} spacing={2}>
            {palette.map((hex, i) => (
              <Swatch key={i} hex={hex} />
            ))}
          </SimpleGrid>
        )}

        {detect.background?.style && (
          <VStack align="stretch" spacing={1} mt={4}>
            <Text fontSize="10px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">Style</Text>
            <Text fontSize="xs" color="brand.ink">{detect.background.style}</Text>
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

function Swatch({ hex }: { hex: string }) {
  const lum = relativeLuminance(hex);
  const fg = lum > 0.55 ? '#0B1020' : '#FFFFFF';
  return (
    <HStack
      bg={hex}
      p={3}
      borderRadius="md"
      h="64px"
      borderWidth="1px"
      borderColor="brand.border"
      align="center"
    >
      <Box flex={1}>
        <Text fontSize="xs" fontWeight="700" color={fg} fontFamily="mono">{hex.toUpperCase()}</Text>
        <Text fontSize="9px" color={fg} opacity={0.7}>{describeColor(hex)}</Text>
      </Box>
    </HStack>
  );
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // simple sRGB → luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function describeColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (r + g + b) / (3 * 255);
  if (sat < 0.10) {
    if (lum > 0.85) return 'near-white';
    if (lum < 0.15) return 'near-black';
    return 'neutral';
  }
  if (r >= g && r >= b) return g >= b ? 'warm' : 'red-violet';
  if (g >= r && g >= b) return r >= b ? 'lime / yellow' : 'green';
  return r >= g ? 'blue / violet' : 'cyan';
}
