// Derived Voice Profile card — surfaces the voice profile that
// brandVoiceDerivationService inferred from the brand's existing Meta/
// Google ad creatives. This is DISTINCT from BrandVoiceCard (which
// edits the operator-curated tone/hashtags/tags/summary).
//
// Operator can:
//   - View tone words, value props, hooks, CTA patterns, common phrases,
//     audience pitches, and the 2-3 sentence voice summary
//   - Refresh (POST /api/brand/:id/derive-voice?force=true) to re-run
//     the derivation against the latest campaigns
//   - Clear (PATCH /api/brand/:id/voice { voice: null }) to discard
//     the AI-inferred profile

import { useState } from 'react';
import {
  Card, CardBody, HStack, VStack, Text, Heading, Badge, Wrap, WrapItem,
  Box, Icon, Button, Spinner, useToast, Divider
} from '@chakra-ui/react';
import type { Brand } from './types';
import { apiJson, apiFetch } from '../../auth/apiFetch';

type Props = { brand: Brand; onChanged?: () => void };

export function DerivedVoiceCard({ brand, onChanged }: Props) {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const voice = brand.derivedVoice;
  const derivedAt = brand.derivedVoiceAt ? new Date(brand.derivedVoiceAt) : null;
  const hasVoice = !!voice && Object.keys(voice).length > 0;

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await apiJson<{ ok?: boolean; skipped?: boolean; reason?: string; voice?: unknown }>(
        `/api/brand/${encodeURIComponent(brand._id)}/derive-voice?force=true`,
        { method: 'POST' }
      );
      if (r.skipped) {
        toast({ title: 'Skipped', description: r.reason || 'no change', status: 'info', duration: 4000 });
      } else {
        toast({ title: 'Voice profile refreshed', status: 'success', duration: 3000 });
        onChanged?.();
      }
    } catch (e) {
      toast({ title: 'Refresh failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setRefreshing(false);
    }
  }

  async function clear() {
    setClearing(true);
    try {
      const res = await apiFetch(`/api/brand/${encodeURIComponent(brand._id)}/voice`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ voice: null })
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Voice profile cleared', status: 'success', duration: 3000 });
      onChanged?.();
    } catch (e) {
      toast({ title: 'Clear failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setClearing(false);
    }
  }

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={4} wrap="wrap" gap={2}>
          <HStack spacing={2}>
            <DerivedIcon />
            <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
              Derived Voice
            </Heading>
            <Badge variant="subtle" colorScheme="purple" fontSize="9px" px={1.5} py={0.5}>From live campaigns</Badge>
            {voice?.weighted && (
              <Badge variant="subtle" colorScheme="green" fontSize="9px" px={1.5} py={0.5}>Performance-weighted</Badge>
            )}
            {voice?.evidence_count != null && (
              <Text fontSize="xs" color="brand.muted">· {voice.evidence_count} ads analyzed</Text>
            )}
          </HStack>
          <HStack spacing={2}>
            {derivedAt && (
              <Text fontSize="xs" color="brand.muted">Last derived {derivedAt.toLocaleDateString()}</Text>
            )}
            <Button size="xs" variant="outline" onClick={refresh} isLoading={refreshing} leftIcon={refreshing ? <Spinner size="xs" /> : <DerivedIcon />}>
              {hasVoice ? 'Refresh' : 'Derive now'}
            </Button>
            {hasVoice && (
              <Button size="xs" variant="ghost" onClick={clear} isLoading={clearing}>
                Clear
              </Button>
            )}
          </HStack>
        </HStack>

        {!hasVoice && (
          <Text fontSize="sm" color="brand.muted">
            No voice profile derived yet. Click "Derive now" to extract one from this brand's existing ad creatives, or it will run automatically the next time campaigns sync (requires at least 3 ad creatives).
          </Text>
        )}

        {hasVoice && voice && (
          <VStack align="stretch" spacing={5}>
            {voice.voice_summary && (
              <Box>
                <Text fontSize="xs" color="brand.muted" mb={1.5}>Summary</Text>
                <Text fontSize="sm" color="brand.ink" lineHeight="1.55" fontStyle="italic">
                  {voice.voice_summary}
                </Text>
              </Box>
            )}

            <HStack align="flex-start" spacing={8} wrap="wrap">
              <VStack align="stretch" flex={1} spacing={4} minW="240px">
                <ChipField label="Tone"            items={voice.tone}            color="orange" />
                <ChipField label="Hook patterns"   items={voice.hooks}           color="purple" />
                <ChipField label="Common phrases"  items={voice.common_phrases}  color="teal" />
              </VStack>
              <VStack align="stretch" flex={1} spacing={4} minW="240px">
                <ChipField label="Value props"     items={voice.value_props}     color="blue" />
                {Array.isArray(voice.cta_patterns) && voice.cta_patterns.length > 0 && (
                  <Box>
                    <Text fontSize="xs" color="brand.muted" mb={1.5}>Dominant CTAs</Text>
                    <Wrap spacing={2}>
                      {voice.cta_patterns.map((c, i) => (
                        <WrapItem key={i}>
                          <Badge variant="subtle" colorScheme="green" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
                            {c.text}
                            {c.frequency != null && (
                              <Text as="span" ml={1} color="brand.muted" fontWeight="500">
                                · {Math.round(c.frequency * 100)}%
                              </Text>
                            )}
                          </Badge>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </Box>
                )}
              </VStack>
            </HStack>

            {Array.isArray(voice.audience_pitch) && voice.audience_pitch.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Text fontSize="xs" color="brand.muted" mb={2}>Audience-aware pitch</Text>
                  <VStack align="stretch" spacing={1.5}>
                    {voice.audience_pitch.map((a, i) => (
                      <HStack key={i} spacing={3} align="flex-start">
                        <Badge variant="subtle" colorScheme="purple" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
                          {a.segment}
                        </Badge>
                        <Text fontSize="sm" color="brand.ink">{a.pitch_style}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

function ChipField({ label, items, color }: { label: string; items?: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <Box>
      <Text fontSize="xs" color="brand.muted" mb={1.5}>{label}</Text>
      <Wrap spacing={2}>
        {items.map((item, i) => (
          <WrapItem key={i}>
            <Badge variant="subtle" colorScheme={color} fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
              {item}
            </Badge>
          </WrapItem>
        ))}
      </Wrap>
    </Box>
  );
}

function DerivedIcon() {
  return (
    <Icon viewBox="0 0 24 24" w="14px" h="14px" color="rsViolet.500">
      <path fill="currentColor" d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    </Icon>
  );
}
