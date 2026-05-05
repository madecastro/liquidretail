// Phase A-2 — Text tab.
//
// OCR detections list — content, type pill, confidence, normalized
// bbox displayed as a tiny visualization for quick spatial sense.

import { Box, Card, CardBody, Heading, HStack, VStack, Text, Badge, Divider } from '@chakra-ui/react';
import type { DetectResult } from '../types';

export function TextTab({ detect }: { detect: DetectResult | null }) {
  if (!detect) return <Text fontSize="sm" color="brand.muted">No detect data yet.</Text>;
  const items = detect.text || [];

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={3}>
          <Heading size="xs">Detected Text</Heading>
          <Badge fontSize="9px" variant="subtle" colorScheme="gray">{items.length}</Badge>
        </HStack>
        {items.length === 0 ? (
          <Text fontSize="xs" color="brand.muted">No text detected.</Text>
        ) : (
          <VStack align="stretch" spacing={3} divider={<Divider />}>
            {items.map(t => (
              <HStack key={t.id} align="flex-start" spacing={3}>
                <BboxThumb bbox={t} />
                <Box flex={1} minW={0}>
                  <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={2}>{t.content || '(empty)'}</Text>
                  <HStack mt={1} spacing={2}>
                    <Badge fontSize="9px" variant="subtle" colorScheme={typeColor(t.type)}>{t.type}</Badge>
                    <Text fontSize="10px" color="brand.muted">{Math.round(t.confidence * 100)}%</Text>
                  </HStack>
                  <Text fontSize="9px" color="brand.muted" mt={0.5}>
                    bbox: ({t.x1.toFixed(2)}, {t.y1.toFixed(2)}) → ({t.x2.toFixed(2)}, {t.y2.toFixed(2)})
                  </Text>
                </Box>
              </HStack>
            ))}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

// Tiny rectangular sketch of where the text sits in the frame.
function BboxThumb({ bbox }: { bbox: { x1: number; y1: number; x2: number; y2: number } }) {
  const w = Math.max(0, bbox.x2 - bbox.x1) * 100;
  const h = Math.max(0, bbox.y2 - bbox.y1) * 100;
  const x = bbox.x1 * 100;
  const y = bbox.y1 * 100;
  return (
    <Box w="48px" h="48px" bg="gray.100" borderRadius="md" position="relative" flexShrink={0} borderWidth="1px" borderColor="brand.border">
      <Box position="absolute" left={`${x}%`} top={`${y}%`} width={`${w}%`} height={`${h}%`} bg="orange.400" opacity={0.8} borderRadius="1px" />
    </Box>
  );
}

function typeColor(t: string): string {
  switch (t) {
    case 'brand':         return 'purple';
    case 'product_label': return 'blue';
    case 'serial':        return 'gray';
    case 'warning':       return 'red';
    default:              return 'orange';
  }
}
