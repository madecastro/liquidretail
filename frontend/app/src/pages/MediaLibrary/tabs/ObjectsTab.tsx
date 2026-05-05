// Phase A-2 — Objects tab.
//
// Full per-detection list. Two sections:
//   1. Refined products (crop-refined, post-reconciliation — what
//      productMatch consumes)
//   2. YOLO raw detections + dual-engine identification + agreement
//      type (the deeper view for understanding why a refined product
//      came out the way it did)

import { Box, Card, CardBody, HStack, VStack, Heading, Text, Badge, Image, Divider } from '@chakra-ui/react';
import type { DetectResult } from '../types';

export function ObjectsTab({ detect }: { detect: DetectResult | null }) {
  if (!detect) return <Text fontSize="sm" color="brand.muted">No detect data yet.</Text>;

  const refined = detect.refinedProducts || [];
  const yolo    = detect.products || [];

  return (
    <VStack align="stretch" spacing={4}>
      <Card variant="outline">
        <CardBody>
          <HStack justify="space-between" mb={3}>
            <Heading size="xs">Refined Products</Heading>
            <Badge fontSize="9px" variant="subtle" colorScheme="gray">{refined.length}</Badge>
          </HStack>
          {refined.length === 0 ? (
            <Text fontSize="xs" color="brand.muted">No refined products.</Text>
          ) : (
            <VStack align="stretch" spacing={3} divider={<Divider />}>
              {refined.map(rp => (
                <HStack key={rp.id} align="flex-start" spacing={3}>
                  <Box w="56px" h="56px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                    {rp.croppedImageUrl && <Image src={rp.croppedImageUrl} alt={rp.label} w="100%" h="100%" objectFit="cover" />}
                  </Box>
                  <Box flex={1} minW={0}>
                    <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={1}>{rp.label || '(unlabeled)'}</Text>
                    {rp.categoryLabel && rp.categoryLabel !== rp.label && (
                      <Text fontSize="10px" color="brand.muted" noOfLines={1}>also: {rp.categoryLabel}</Text>
                    )}
                    <HStack mt={1} spacing={2} wrap="wrap">
                      {rp.brand && <Badge fontSize="9px" variant="subtle" colorScheme="purple">{rp.brand}</Badge>}
                      {rp.category && <Badge fontSize="9px" variant="subtle" colorScheme="blue">{rp.category}</Badge>}
                      {rp.agreement && <Badge fontSize="9px" variant="outline">{rp.agreement}</Badge>}
                      <Text fontSize="9px" color="brand.muted">{Math.round(rp.confidence * 100)}%</Text>
                    </HStack>
                    <Text fontSize="9px" color="brand.muted" mt={1}>
                      bbox: ({Math.round(rp.x1)}, {Math.round(rp.y1)}) → ({Math.round(rp.x2)}, {Math.round(rp.y2)})
                    </Text>
                  </Box>
                </HStack>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>

      <Card variant="outline">
        <CardBody>
          <HStack justify="space-between" mb={3}>
            <Heading size="xs">YOLO Detections</Heading>
            <Badge fontSize="9px" variant="subtle" colorScheme="gray">{yolo.length}</Badge>
          </HStack>
          {yolo.length === 0 ? (
            <Text fontSize="xs" color="brand.muted">No raw detections.</Text>
          ) : (
            <VStack align="stretch" spacing={2} divider={<Divider />}>
              {yolo.map(p => (
                <Box key={p.id}>
                  <HStack justify="space-between" mb={1}>
                    <HStack spacing={2}>
                      <Text fontSize="xs" fontWeight="700" color="brand.ink">{p.id}</Text>
                      <Badge fontSize="9px" variant="subtle" colorScheme="orange">{p.className}</Badge>
                    </HStack>
                    <Text fontSize="10px" color="brand.muted">{Math.round(p.confidence * 100)}%</Text>
                  </HStack>
                  {p.identification && (
                    <Box pl={4} borderLeft="2px solid" borderColor="gray.200">
                      <Text fontSize="11px" color="brand.ink">
                        {p.identification.label}
                      </Text>
                      <HStack mt={0.5} spacing={2} wrap="wrap">
                        {p.identification.brand && <Text fontSize="9px" color="brand.muted">{p.identification.brand}</Text>}
                        {p.identification.category && <Text fontSize="9px" color="brand.muted">· {p.identification.category}</Text>}
                        <Text fontSize="9px" color="brand.muted">· {Math.round(p.identification.confidence * 100)}%</Text>
                      </HStack>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
}
