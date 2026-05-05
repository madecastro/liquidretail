// Phase A-2 — Crops tab.
//
// Smart crops (per base ratio) above, extended crops (Gemini extension
// + generation) below. Each crop card shows its provider/variant +
// judge score when available.

import { Box, Card, CardBody, Heading, HStack, VStack, Text, Image, Badge, SimpleGrid } from '@chakra-ui/react';
import type { DetectResult } from '../types';
import { qualityBucket, buildCloudinaryCropUrl } from '../format';

export function CropsTab({ detect }: { detect: DetectResult | null }) {
  if (!detect) return <Text fontSize="sm" color="brand.muted">No detect data yet.</Text>;
  const sourceUrl = detect.imageUrl || null;

  const smartCrops = (detect.crops as Record<string, Array<Record<string, unknown>>> | undefined) || {};
  const extended   = (detect.extendedCrops as Record<string, Array<Record<string, unknown>>> | undefined) || {};
  const judge      = (detect.judge as Record<string, { winnerId?: string; winnerScore?: number }> | undefined) || {};

  return (
    <VStack align="stretch" spacing={4}>
      <Card variant="outline">
        <CardBody>
          <Heading size="xs" mb={3}>Smart Crops</Heading>
          {Object.keys(smartCrops).length === 0 ? (
            <Text fontSize="xs" color="brand.muted">No smart crops.</Text>
          ) : (
            <VStack align="stretch" spacing={4}>
              {Object.entries(smartCrops).map(([ratio, crops]) => {
                const judgeKey = `crop_${ratio.replace(':', '_')}`;
                const j = judge[judgeKey];
                return (
                  <Box key={ratio}>
                    <HStack mb={2}>
                      <Text fontSize="xs" fontWeight="700" color="brand.ink">{ratio}</Text>
                      {j?.winnerScore != null && (
                        <Badge fontSize="9px" variant="subtle" style={{ color: qualityBucket(j.winnerScore).tone }}>
                          {qualityBucket(j.winnerScore).label} · {j.winnerScore.toFixed(2)}
                        </Badge>
                      )}
                    </HStack>
                    <SimpleGrid columns={3} spacing={2}>
                      {crops.map((c, i) => {
                        const isWinner = c['id'] === j?.winnerId;
                        // Smart crops are coordinate-only — derive the
                        // preview URL from the source image's Cloudinary
                        // upload URL (no re-upload, just a transform).
                        const inlineUrl = c['imageUrl'] as string | undefined;
                        const url = inlineUrl || buildCloudinaryCropUrl(sourceUrl, {
                          x1: Number(c['x1']),
                          y1: Number(c['y1']),
                          x2: Number(c['x2']),
                          y2: Number(c['y2'])
                        });
                        return (
                          <Box
                            key={i}
                            borderRadius="md"
                            overflow="hidden"
                            borderWidth={isWinner ? '2px' : '1px'}
                            borderColor={isWinner ? 'rsViolet.400' : 'brand.border'}
                            bg="gray.100"
                            position="relative"
                          >
                            {url ? <Image src={url} alt="" w="100%" h="80px" objectFit="cover" /> : <Box h="80px" />}
                            {isWinner && (
                              <Badge position="absolute" top={1} left={1} fontSize="9px" variant="subtle" colorScheme="purple">
                                winner
                              </Badge>
                            )}
                          </Box>
                        );
                      })}
                    </SimpleGrid>
                  </Box>
                );
              })}
            </VStack>
          )}
        </CardBody>
      </Card>

      <Card variant="outline">
        <CardBody>
          <Heading size="xs" mb={3}>Extended Crops</Heading>
          {Object.keys(extended).length === 0 ? (
            <Text fontSize="xs" color="brand.muted">No extended crops.</Text>
          ) : (
            <VStack align="stretch" spacing={4}>
              {Object.entries(extended).map(([ratio, candidates]) => (
                <Box key={ratio}>
                  <Text fontSize="xs" fontWeight="700" color="brand.ink" mb={2}>{ratio}</Text>
                  <SimpleGrid columns={2} spacing={2}>
                    {candidates.map((c, i) => {
                      const url = c['imageUrl'] as string | undefined;
                      return (
                        <Box key={i} borderRadius="md" overflow="hidden" borderWidth="1px" borderColor="brand.border" bg="gray.100">
                          {url && <Image src={url} alt="" w="100%" h="100px" objectFit="cover" />}
                          <Box px={2} py={1}>
                            <HStack spacing={1} wrap="wrap">
                              {c['provider'] != null && (
                                <Badge fontSize="9px" variant="subtle" colorScheme="blue">{String(c['provider'])}</Badge>
                              )}
                              {c['variant'] != null && (
                                <Badge fontSize="9px" variant="outline">{String(c['variant'])}</Badge>
                              )}
                            </HStack>
                          </Box>
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                </Box>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
}
