// Phase 4a — Audience Personas (display only).
// Phase 4b — adds inline edit: each persona row becomes editable
// (name + description + interests + painPoints + toneHint), with
// add/remove buttons.
// Phase 4 follow-up #6 — avatar generation. Each persona row in edit
// mode gets a "Generate avatar" button that calls the backend
// /api/brand/:id/personas/:index/avatar endpoint to produce a portrait
// illustration via gpt-image-1; the URL is persisted on
// demographics[i].avatarUrl and rendered in place of the generic icon.

import {
  Card, CardBody, VStack, HStack, Box, Text, Heading, Button, Icon, Image,
  Input, Textarea, IconButton, Wrap, WrapItem, Badge, Spinner, useToast
} from '@chakra-ui/react';
import { useState } from 'react';
import type { Brand, BrandDemographic } from './types';
import type { BrandEdit } from './useBrandEdit';
import { apiJson } from '../../auth/apiFetch';

const PERSONA_TONES = [
  { bg: 'rgba(122,53,232,0.10)',  fg: '#6B21A8' },
  { bg: 'rgba(245,124,0,0.10)',   fg: '#B45309' },
  { bg: 'rgba(16,184,216,0.10)',  fg: '#0E7490' },
  { bg: 'rgba(16,185,129,0.10)',  fg: '#047857' },
  { bg: 'rgba(217,0,141,0.10)',   fg: '#9D174D' },
  { bg: 'rgba(255,212,0,0.14)',   fg: '#92400E' }
];

export function AudiencePersonasCard({ brand, edit }: { brand: Brand; edit: BrandEdit }) {
  const personas = ((edit.valueOf('demographics') || []) as BrandDemographic[]).slice(0, 6);
  const isEditing = edit.isEditing;
  const brandId = brand._id;

  return (
    <Card variant="outline" h="100%">
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em">Audience Personas</Heading>
          {isEditing && personas.length < 6 && (
            <Button size="xs" variant="outline" onClick={() => edit.addDemographic()}>
              + Add persona
            </Button>
          )}
        </HStack>

        {personas.length === 0 ? (
          <Text fontSize="xs" color="brand.muted" fontStyle="italic">
            {isEditing
              ? 'Click "Add persona" to start. Personas drive Gemini ad-copy variants.'
              : 'Personas populate during enrichment. Refresh AI to retry, or click Edit Brand to add manually.'}
          </Text>
        ) : (
          <VStack align="stretch" spacing={3}>
            {personas.map((p, i) => (
              <PersonaRow
                key={i}
                index={i}
                persona={p}
                tone={PERSONA_TONES[i % PERSONA_TONES.length]}
                isEditing={isEditing}
                brandId={brandId}
                isDirty={edit.dirty}
                onSet={(next) => edit.setDemographic(i, next)}
                onRemove={() => edit.removeDemographic(i)}
                onAvatarGenerated={(url) => edit.setDemographic(i, { ...p, avatarUrl: url })}
              />
            ))}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

function PersonaRow({
  index, persona, tone, isEditing, brandId, isDirty, onSet, onRemove, onAvatarGenerated
}: {
  index: number;
  persona: BrandDemographic;
  tone: { bg: string; fg: string };
  isEditing: boolean;
  brandId: string;
  isDirty: boolean;
  onSet: (persona: BrandDemographic) => void;
  onRemove: () => void;
  onAvatarGenerated: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  // Generation requires the persona to be persisted server-side at the
  // given index — we PATCH avatarUrl onto demographics[i] in place. If
  // the operator is mid-edit with unsaved changes, the index they see
  // may not match what the server has. Block until they save.
  const canGenerate = !!persona.name?.trim() || !!persona.description?.trim();
  const generateAvatar = async () => {
    if (!canGenerate || generating) return;
    if (isDirty) {
      toast({
        title: 'Save changes first',
        description: 'Avatar generation patches the saved persona at this index. Save the brand, then generate.',
        status: 'info',
        duration: 4000
      });
      return;
    }
    setGenerating(true);
    try {
      const res = await apiJson<{ avatarUrl: string }>(`/api/brand/${brandId}/personas/${index}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      onAvatarGenerated(res.avatarUrl);
      toast({ title: 'Avatar generated', status: 'success', duration: 2500 });
    } catch (err: unknown) {
      toast({
        title: 'Avatar generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 5000
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!isEditing) {
    return (
      <HStack align="flex-start" spacing={3}>
        <PersonaTile tone={tone} avatarUrl={persona.avatarUrl} name={persona.name} />
        <Box flex={1} minW={0}>
          <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>
            {persona.name || '(unnamed persona)'}
          </Text>
          {persona.description && (
            <Text fontSize="xs" color="brand.muted" lineHeight="1.5" noOfLines={2}>
              {persona.description}
            </Text>
          )}
        </Box>
      </HStack>
    );
  }

  return (
    <Box borderWidth="1px" borderColor="brand.border" borderRadius="md" p={3}>
      <HStack align="flex-start" spacing={3}>
        <VStack spacing={1.5} align="center">
          <PersonaTile tone={tone} avatarUrl={persona.avatarUrl} name={persona.name} generating={generating} />
          <Button
            size="xs"
            variant="ghost"
            onClick={generateAvatar}
            isDisabled={!canGenerate || generating}
            isLoading={generating}
            loadingText="…"
            fontSize="10px"
            px={1.5}
            h="22px"
          >
            {persona.avatarUrl ? 'Regenerate' : 'Generate'}
          </Button>
        </VStack>
        <VStack flex={1} align="stretch" spacing={2} minW={0}>
          <HStack>
            <Input
              size="sm"
              value={persona.name || ''}
              onChange={e => onSet({ ...persona, name: e.target.value })}
              placeholder={`Persona ${index + 1} name`}
              fontWeight="700"
            />
            <IconButton
              size="sm"
              aria-label="Remove persona"
              variant="ghost"
              colorScheme="red"
              onClick={onRemove}
              icon={<TrashIcon />}
            />
          </HStack>
          <Textarea
            size="sm"
            rows={2}
            value={persona.description || ''}
            onChange={e => onSet({ ...persona, description: e.target.value })}
            placeholder="One-sentence description (≤ 20 words)"
          />
          <Button size="xs" variant="ghost" onClick={() => setExpanded(x => !x)} alignSelf="flex-start">
            {expanded ? '− Hide details' : '+ Edit details (interests, pain points, tone)'}
          </Button>
          {expanded && (
            <VStack align="stretch" spacing={2}>
              <ListEditor
                label="Interests"
                items={persona.interests || []}
                onChange={(next) => onSet({ ...persona, interests: next })}
              />
              <ListEditor
                label="Pain Points"
                items={persona.painPoints || []}
                onChange={(next) => onSet({ ...persona, painPoints: next })}
              />
              <Box>
                <Text fontSize="10px" color="brand.muted" mb={1} textTransform="uppercase" letterSpacing="0.04em">Tone Hint</Text>
                <Input
                  size="sm"
                  value={persona.toneHint || ''}
                  onChange={e => onSet({ ...persona, toneHint: e.target.value })}
                  placeholder="How they speak — e.g. 'direct, results-oriented'"
                />
              </Box>
            </VStack>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}

function PersonaTile({
  tone, avatarUrl, name, generating
}: {
  tone: { bg: string; fg: string };
  avatarUrl?: string;
  name?: string;
  generating?: boolean;
}) {
  if (generating) {
    return (
      <Box w="40px" h="40px" flexShrink={0} borderRadius="md" bg={tone.bg} display="flex" alignItems="center" justifyContent="center">
        <Spinner size="sm" color={tone.fg} />
      </Box>
    );
  }
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name ? `${name} avatar` : 'Persona avatar'}
        w="40px" h="40px"
        flexShrink={0}
        borderRadius="md"
        objectFit="cover"
        fallback={
          <Box w="40px" h="40px" flexShrink={0} borderRadius="md" bg={tone.bg} />
        }
      />
    );
  }
  return (
    <Box
      w="40px" h="40px"
      flexShrink={0}
      borderRadius="md"
      bg={tone.bg}
      display="flex"
      alignItems="center"
      justifyContent="center"
      color={tone.fg}
    >
      <Icon viewBox="0 0 24 24" w="20px" h="20px">
        <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </Icon>
    </Box>
  );
}

function ListEditor({
  label, items, onChange
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const commit = () => {
    const v = input.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setInput('');
  };
  return (
    <Box>
      <Text fontSize="10px" color="brand.muted" mb={1} textTransform="uppercase" letterSpacing="0.04em">{label}</Text>
      <Wrap spacing={1.5}>
        {items.map((item, i) => (
          <WrapItem key={i}>
            <Badge variant="subtle" colorScheme="gray" fontSize="10px" px={1.5} py={1} borderRadius="md" textTransform="none" display="inline-flex" alignItems="center" gap={1}>
              {item}
              <IconButton
                size="xs"
                aria-label={`Remove ${item}`}
                variant="ghost"
                minW="14px"
                h="14px"
                onClick={() => onChange(items.filter(x => x !== item))}
                icon={<Box as="span" fontSize="9px" lineHeight={1}>×</Box>}
              />
            </Badge>
          </WrapItem>
        ))}
      </Wrap>
      <HStack spacing={1.5} mt={1.5}>
        <Input
          size="xs"
          fontSize="11px"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
          }}
          placeholder={`Add ${label.toLowerCase()}…`}
        />
        <Button size="xs" variant="ghost" onClick={commit} isDisabled={!input.trim()}>Add</Button>
      </HStack>
    </Box>
  );
}

function TrashIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></Icon>;
}
