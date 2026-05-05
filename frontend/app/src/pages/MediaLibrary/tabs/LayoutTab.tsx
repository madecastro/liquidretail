// Phase A-2 — Layout tab.
//
// Per-aspect-ratio overlay-zone analysis — primary subject rect,
// restrictions list with strictness, density + brightness mini grids.

import { Box, Card, CardBody, Heading, HStack, VStack, Text, Badge, SimpleGrid } from '@chakra-ui/react';
import type { DetectResult, OverlayZoneAnalysis, OverlayZoneVariant, DensityGrid } from '../types';
import { densityCellColor } from '../format';

export function LayoutTab({ detect }: { detect: DetectResult | null }) {
  if (!detect) return <Text fontSize="sm" color="brand.muted">No detect data yet.</Text>;
  const zones = detect.overlayZones || {};
  const ratios = Object.keys(zones);

  if (!ratios.length) {
    return (
      <Card variant="outline">
        <CardBody>
          <Heading size="xs">Layout</Heading>
          <Text fontSize="xs" color="brand.muted" mt={2}>No overlay-zone analyses yet.</Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
      {ratios.map(ratio => {
        const variants = zones[ratio];
        const primary = (variants || []).find((v: OverlayZoneVariant) => v.variant === 'base' && v.analysis)
                     || (variants || []).find((v: OverlayZoneVariant) => v.analysis);
        const a = primary?.analysis;
        if (!a) return null;
        return (
          <Card key={ratio} variant="outline">
            <CardBody>
              <HStack justify="space-between" mb={3}>
                <Heading size="xs">{ratio}</Heading>
                {primary?.variant && <Badge fontSize="9px" variant="outline">{primary.variant}</Badge>}
              </HStack>
              <RatioPanel analysis={a} />
            </CardBody>
          </Card>
        );
      })}
    </VStack>
  );
}

function RatioPanel({ analysis }: { analysis: OverlayZoneAnalysis }) {
  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={3} align="stretch">
        <GridMini label="Density"    grid={analysis.densityGrid}    densityColor />
        <GridMini label="Brightness" grid={analysis.brightnessGrid} densityColor={false} />
      </HStack>
      <Box>
        <Text fontSize="10px" color="brand.muted" mb={1} textTransform="uppercase" letterSpacing="0.04em">
          Restrictions ({analysis.restrictions?.length || 0})
        </Text>
        <VStack align="stretch" spacing={1}>
          {(analysis.restrictions || []).map(r => (
            <HStack key={r.id} spacing={2} fontSize="10px">
              <Badge fontSize="8px" variant="subtle" colorScheme={classColorScheme(r.classification)} flexShrink={0}>
                {r.classification}
              </Badge>
              <Text color="brand.muted" flexShrink={0}>{r.strictness.toFixed(2)}</Text>
              <Text color="brand.ink" noOfLines={1} flex={1}>{r.reason}</Text>
            </HStack>
          ))}
        </VStack>
      </Box>
      {analysis.primarySubjectRectPct && (
        <Text fontSize="10px" color="brand.muted">
          Primary subject rect: ({analysis.primarySubjectRectPct.x1.toFixed(2)}, {analysis.primarySubjectRectPct.y1.toFixed(2)}) → ({analysis.primarySubjectRectPct.x2.toFixed(2)}, {analysis.primarySubjectRectPct.y2.toFixed(2)})
        </Text>
      )}
    </VStack>
  );
}

function GridMini({ label, grid, densityColor }: { label: string; grid?: DensityGrid; densityColor: boolean }) {
  if (!grid?.cells?.length) return <Box flex={1} />;
  return (
    <Box flex={1}>
      <Text fontSize="10px" color="brand.muted" mb={1} textTransform="uppercase" letterSpacing="0.04em">{label}</Text>
      <SimpleGrid
        columns={grid.cols}
        spacing="1px"
        bg="gray.200"
        p="1px"
        borderRadius="sm"
      >
        {grid.cells.flatMap((row, r) => row.map((v, c) => (
          <Box
            key={`${label}-${r}-${c}`}
            h="14px"
            bg={densityColor ? densityCellColor(v) : `rgba(11,16,32,${0.05 + 0.85 * v})`}
            sx={!densityColor ? { color: 'white' } : {}}
          />
        )))}
      </SimpleGrid>
    </Box>
  );
}

function classColorScheme(cls: string): string {
  switch (cls) {
    case 'product':           return 'red';
    case 'face':              return 'purple';
    case 'secondary_subject': return 'orange';
    case 'text':              return 'blue';
    case 'object':            return 'gray';
    default:                  return 'gray';
  }
}
