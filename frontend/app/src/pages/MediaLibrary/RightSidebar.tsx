// Phase A-1 — right rail. Six tabs scaffolded; Summary tab minimally
// populated with refinedProducts list + scene description. Full Summary
// (Ad Readiness score + bullets + scene & subjects + technical insights)
// + the other tabs are A-2 scope.

import { Box, Tabs, TabList, Tab, TabPanels, TabPanel, Text, VStack, HStack, Badge, Card, CardBody, Heading, Image, Divider, Code } from '@chakra-ui/react';
import type { DetectResult, MediaListRow } from './types';
import { matchLevelTone } from './format';

type Props = {
  row:    MediaListRow | null;
  detect: DetectResult | null;
};

export function RightSidebar({ row, detect }: Props) {
  return (
    <Box
      w="380px"
      flexShrink={0}
      h="100%"
      minH={0}
      bg="brand.surface"
      borderLeftWidth="1px"
      borderLeftColor="brand.border"
      overflowY="auto"
    >
      <Tabs variant="line" size="sm" colorScheme="purple">
        <TabList px={3} pt={2}>
          <Tab fontSize="xs">Summary</Tab>
          <Tab fontSize="xs">Objects</Tab>
          <Tab fontSize="xs">Crops</Tab>
          <Tab fontSize="xs">Text</Tab>
          <Tab fontSize="xs">Layout</Tab>
          <Tab fontSize="xs">Palette</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={4} py={4}><SummaryTab row={row} detect={detect} /></TabPanel>
          <TabPanel px={4} py={4}><PlaceholderTab phase="A-2" name="Objects" /></TabPanel>
          <TabPanel px={4} py={4}><PlaceholderTab phase="A-2" name="Crops" /></TabPanel>
          <TabPanel px={4} py={4}><PlaceholderTab phase="A-2" name="Text" /></TabPanel>
          <TabPanel px={4} py={4}><PlaceholderTab phase="A-2" name="Layout" /></TabPanel>
          <TabPanel px={4} py={4}><PlaceholderTab phase="A-2" name="Palette" /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

function SummaryTab({ row, detect }: Props) {
  if (!row) return <Text fontSize="sm" color="brand.muted">Select a media item to see its summary.</Text>;

  const matched = (detect?.productMatchesAll || []).filter(m => m.outcome === 'product_match' || m.outcome === 'product_category');
  const sceneDesc = (detect?.background as Record<string, unknown> | null)?.['description'] as string | undefined;
  const primaryDesc = detect?.primarySubjectDesc;

  return (
    <VStack align="stretch" spacing={4}>
      <Card variant="outline">
        <CardBody>
          <HStack justify="space-between" mb={2}>
            <Heading size="xs">AI Summary</Heading>
            <Badge fontSize="9px" variant="subtle" colorScheme="gray">A-2 expands this</Badge>
          </HStack>
          <Text fontSize="xs" color="brand.muted" mb={2}>
            Phase A-2 surfaces Ad Readiness score + bullets here. For A-1 we show the
            primary subject description as a scene-summary placeholder.
          </Text>
          {primaryDesc ? (
            <Text fontSize="xs" color="brand.ink">{primaryDesc}</Text>
          ) : sceneDesc ? (
            <Text fontSize="xs" color="brand.ink">{sceneDesc}</Text>
          ) : (
            <Text fontSize="xs" color="brand.muted">No scene description yet.</Text>
          )}
        </CardBody>
      </Card>

      <Card variant="outline">
        <CardBody>
          <HStack justify="space-between" mb={3}>
            <Heading size="xs">Detected Products</Heading>
            <Badge fontSize="9px" variant="subtle" colorScheme="gray">{matched.length}</Badge>
          </HStack>
          {matched.length === 0 ? (
            <Text fontSize="xs" color="brand.muted">No matches yet.</Text>
          ) : (
            <VStack align="stretch" spacing={3} divider={<Divider />}>
              {matched.map((m, i) => {
                const certainty = m.identification?.certainty ?? 0;
                const matchTone = matchLevelTone(
                  m.outcome === 'product_match' ? 'high' :
                  m.outcome === 'product_category' ? 'medium' : 'none'
                );
                const title = m.catalog?.title || m.identification?.productName || '(unknown)';
                const breadcrumb = m.categoryDoc?.breadcrumb || m.brandCategory?.breadcrumb || null;
                const productImg = m.catalog?.imageUrl || null;
                return (
                  <HStack key={i} align="flex-start" spacing={3}>
                    <Box w="48px" h="48px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                      {productImg && <Image src={productImg} alt={title} w="100%" h="100%" objectFit="cover" />}
                    </Box>
                    <Box flex={1} minW={0}>
                      <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={1}>{title}</Text>
                      {breadcrumb && (
                        <Text fontSize="10px" color="brand.muted" noOfLines={1}>{breadcrumb}</Text>
                      )}
                      <HStack mt={1} spacing={2}>
                        <Text fontSize="10px" color="brand.muted">{Math.round(certainty * 100)}% match</Text>
                        <Badge
                          variant="subtle"
                          fontSize="9px"
                          px={1.5}
                          borderRadius="md"
                          style={{ background: matchTone.bg, color: matchTone.fg }}
                        >
                          {matchTone.label}
                        </Badge>
                      </HStack>
                    </Box>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </CardBody>
      </Card>

      <Card variant="outline">
        <CardBody>
          <HStack justify="space-between" mb={2}>
            <Heading size="xs">Raw Detect Output</Heading>
            <Badge fontSize="9px" variant="subtle" colorScheme="gray">debug</Badge>
          </HStack>
          <Text fontSize="10px" color="brand.muted" mb={2}>Full assembled artifact JSON. Useful while A-2 lands.</Text>
          <Box maxH="360px" overflowY="auto" bg="gray.50" p={2} borderRadius="md">
            <Code fontSize="9px" whiteSpace="pre" display="block">
              {detect ? JSON.stringify(stripHeavy(detect), null, 2) : '(no detect data)'}
            </Code>
          </Box>
        </CardBody>
      </Card>
    </VStack>
  );
}

function PlaceholderTab({ name, phase }: { name: string; phase: string }) {
  return (
    <VStack align="stretch" spacing={3} py={6}>
      <Heading size="xs">{name}</Heading>
      <Text fontSize="xs" color="brand.muted">
        This tab ships in Phase {phase}. A-1 scaffolds the tab layout so navigation works.
      </Text>
    </VStack>
  );
}

// Strip the heavy/noisy fields from the debug JSON dump so the Raw card
// stays scannable. assembleResult includes provider grounding URLs and
// crop transform URLs that bloat the rendered preview.
function stripHeavy(detect: DetectResult): Partial<DetectResult> {
  const { crops, extendedCrops, ...rest } = detect;
  void crops; void extendedCrops;
  return rest;
}
