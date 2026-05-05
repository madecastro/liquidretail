// Phase 4a — Brand Voice Profile (read-only display).
// Tone, hashtags, brand summary, tags, keywords (we fold "keywords"
// into our tags array since the schema has one tag list, not two).
//
// Phase 4b will add inline edit + Regenerate-with-AI wiring.

import { Card, CardBody, HStack, VStack, Text, Heading, Badge, Wrap, WrapItem, Box, Icon, Button } from '@chakra-ui/react';
import type { Brand } from './types';

const PILL_PREVIEW_COUNT = 5;     // chips before showing "+N more"

export function BrandVoiceCard({ brand }: { brand: Brand }) {
  const tone     = brand.tone     || [];
  const hashtags = brand.hashtags || [];
  const tags     = brand.tags     || [];
  const summary  = brand.summary  || '';

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <HStack spacing={2}>
            <SparkleIcon />
            <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">Brand Voice Profile</Heading>
            <Badge variant="subtle" colorScheme="purple" fontSize="9px" px={1.5} py={0.5}>
              AI Generated
            </Badge>
          </HStack>
          <Button size="xs" variant="outline" leftIcon={<SparkleIcon />} isDisabled title="Inline regenerate lands in Phase 4b">
            Regenerate with AI
          </Button>
        </HStack>

        <HStack align="flex-start" spacing={8}>
          <VStack align="stretch" flex={1} spacing={5} minW={0}>
            <FieldBlock label="Tone of Voice">
              {tone.length === 0
                ? <EmptyHint text="Tone descriptors will appear once the brand is enriched." />
                : <ChipRow items={tone} colorScheme="orange" />}
            </FieldBlock>

            <FieldBlock label="Brand Summary">
              {summary
                ? <Text fontSize="sm" color="brand.ink" lineHeight="1.55">{summary}</Text>
                : <EmptyHint text="Brand summary populates after enrichment." />}
            </FieldBlock>
          </VStack>

          <VStack align="stretch" flex={1} spacing={5} minW={0}>
            <FieldBlock label="Hashtags">
              {hashtags.length === 0
                ? <EmptyHint text="Hashtags populate during enrichment." />
                : <ChipRow items={hashtags} colorScheme="purple" preview={PILL_PREVIEW_COUNT} />}
            </FieldBlock>

            <FieldBlock label="Tags">
              {tags.length === 0
                ? <EmptyHint text="Tags populate during enrichment." />
                : <ChipRow items={tags} colorScheme="blue" preview={PILL_PREVIEW_COUNT} />}
            </FieldBlock>
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color="brand.muted" mb={1.5} textTransform="capitalize">{label}</Text>
      {children}
    </Box>
  );
}

function ChipRow({
  items, colorScheme, preview
}: { items: string[]; colorScheme: string; preview?: number }) {
  const max = preview ?? items.length;
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;
  return (
    <Wrap spacing={2}>
      {visible.map((item, i) => (
        <WrapItem key={i}>
          <Badge variant="subtle" colorScheme={colorScheme} fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
            {item}
          </Badge>
        </WrapItem>
      ))}
      {overflow > 0 && (
        <WrapItem>
          <Badge variant="outline" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
            +{overflow}
          </Badge>
        </WrapItem>
      )}
    </Wrap>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <Text fontSize="xs" color="brand.muted" fontStyle="italic">{text}</Text>;
}

function SparkleIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px" color="rsViolet.500"><path fill="currentColor" d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" /></Icon>;
}
