// Phase 4a — Brand Voice Profile (read-only display).
// Phase 4b — adds inline edit mode: tone/hashtags/tags become chip
// add/remove with an inline input; brand summary becomes a textarea.
//
// Read mode + edit mode share the same card; we toggle the inner
// renderers based on edit.isEditing. Pill-overflow ("+N") is only
// shown in read mode — edit mode lists every chip so the user can
// remove any of them.

import { useState } from 'react';
import {
  Card, CardBody, HStack, VStack, Text, Heading, Badge, Wrap, WrapItem,
  Box, Icon, Button, Input, Textarea, IconButton
} from '@chakra-ui/react';
import type { Brand } from './types';
import type { BrandEdit } from './useBrandEdit';

const PILL_PREVIEW_COUNT = 5;

export function BrandVoiceCard({ brand, edit }: { brand: Brand; edit: BrandEdit }) {
  void brand;        // brand is read via edit.valueOf so the editor sees the draft
  const tone     = (edit.valueOf('tone')     || []) as string[];
  const hashtags = (edit.valueOf('hashtags') || []) as string[];
  const tags     = (edit.valueOf('tags')     || []) as string[];
  const summary  = (edit.valueOf('summary')  || '') as string;
  const isEditing = edit.isEditing;

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
          <Button
            size="xs"
            variant="outline"
            leftIcon={<SparkleIcon />}
            isDisabled
            title="Regenerate-with-AI ships in a follow-up — wire to /api/brand/:id/refresh-enrichment with field-scoped reset"
          >
            Regenerate with AI
          </Button>
        </HStack>

        <HStack align="flex-start" spacing={8}>
          <VStack align="stretch" flex={1} spacing={5} minW={0}>
            <FieldBlock label="Tone of Voice">
              {isEditing
                ? <ChipEditor items={tone} colorScheme="orange" placeholder="add a tone descriptor" onAdd={v => edit.addToArrayField('tone', v)} onRemove={v => edit.removeFromArrayField('tone', v)} />
                : tone.length === 0
                  ? <EmptyHint text="Tone descriptors will appear once the brand is enriched." />
                  : <ChipRow items={tone} colorScheme="orange" />}
            </FieldBlock>

            <FieldBlock label="Brand Summary">
              {isEditing ? (
                <Textarea
                  value={summary}
                  onChange={e => edit.setField('summary', e.target.value)}
                  placeholder="2–4 sentences describing who the brand is, what they make, and what makes them distinct."
                  size="sm"
                  rows={5}
                />
              ) : (
                summary
                  ? <Text fontSize="sm" color="brand.ink" lineHeight="1.55">{summary}</Text>
                  : <EmptyHint text="Brand summary populates after enrichment." />
              )}
            </FieldBlock>
          </VStack>

          <VStack align="stretch" flex={1} spacing={5} minW={0}>
            <FieldBlock label="Hashtags">
              {isEditing
                ? <ChipEditor items={hashtags} colorScheme="purple" placeholder="add a hashtag (with or without #)" onAdd={v => edit.addToArrayField('hashtags', normalizeHashtag(v))} onRemove={v => edit.removeFromArrayField('hashtags', v)} />
                : hashtags.length === 0
                  ? <EmptyHint text="Hashtags populate during enrichment." />
                  : <ChipRow items={hashtags} colorScheme="purple" preview={PILL_PREVIEW_COUNT} />}
            </FieldBlock>

            <FieldBlock label="Tags">
              {isEditing
                ? <ChipEditor items={tags} colorScheme="blue" placeholder="add a tag" onAdd={v => edit.addToArrayField('tags', v.toLowerCase())} onRemove={v => edit.removeFromArrayField('tags', v)} />
                : tags.length === 0
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

function ChipEditor({
  items, colorScheme, placeholder, onAdd, onRemove
}: {
  items: string[];
  colorScheme: string;
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState('');
  const commit = () => {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };
  return (
    <VStack align="stretch" spacing={2}>
      <Wrap spacing={2}>
        {items.map((item, i) => (
          <WrapItem key={i}>
            <Badge
              variant="subtle"
              colorScheme={colorScheme}
              fontSize="11px"
              px={2}
              py={1}
              borderRadius="md"
              textTransform="none"
              fontWeight="600"
              display="inline-flex"
              alignItems="center"
              gap={1}
            >
              {item}
              <IconButton
                aria-label={`Remove ${item}`}
                size="xs"
                variant="ghost"
                minW="14px"
                h="14px"
                onClick={() => onRemove(item)}
                icon={<Box as="span" fontSize="10px" lineHeight={1}>×</Box>}
              />
            </Badge>
          </WrapItem>
        ))}
      </Wrap>
      <HStack spacing={2}>
        <Input
          size="sm"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === ',')     { e.preventDefault(); commit(); }
          }}
          placeholder={placeholder}
        />
        <Button size="sm" variant="outline" onClick={commit} isDisabled={!input.trim()}>Add</Button>
      </HStack>
    </VStack>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <Text fontSize="xs" color="brand.muted" fontStyle="italic">{text}</Text>;
}

function normalizeHashtag(s: string): string {
  const trimmed = s.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed.replace(/^#+/, '')}`;
}

function SparkleIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px" color="rsViolet.500"><path fill="currentColor" d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" /></Icon>;
}
