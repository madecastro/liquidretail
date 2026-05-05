// Phase A-2 — Summary tab.
//
// Top-down sections:
//   1. AI Summary card — readiness score + bullets + suggestions slide-over
//   2. Detected Products — match list with agreement chip + breadcrumb
//   3. Scene & Subjects — primary / secondary / scene type / mood / time of day
//   4. Technical Insights — brightness / clutter / focus
//   5. Raw AI Data (collapsible) — full assembled JSON for debugging

import {
  Box, VStack, HStack, Heading, Text, Card, CardBody, Badge, Image, Divider,
  Progress, Button, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton,
  DrawerBody, DrawerHeader, useDisclosure, Code, Collapse, Icon
} from '@chakra-ui/react';
import { useState } from 'react';
import type { DetectResult, MediaListRow, ReadinessReason } from '../types';
import { matchLevelTone } from '../format';

type Props = {
  row:    MediaListRow | null;
  detect: DetectResult | null;
};

export function SummaryTab({ row, detect }: Props) {
  if (!row) return <Text fontSize="sm" color="brand.muted">Select a media item to see its summary.</Text>;

  return (
    <VStack align="stretch" spacing={4}>
      <AISummaryCard detect={detect} />
      <DetectedProductsCard detect={detect} />
      <SceneAndSubjectsCard detect={detect} />
      <TechnicalInsightsCard detect={detect} />
      <RawDataCard detect={detect} />
    </VStack>
  );
}

// ── AI Readiness Summary ──────────────────────────────────────────

function AISummaryCard({ detect }: { detect: DetectResult | null }) {
  const drawer = useDisclosure();
  const score   = detect?.adSuitability?.score;
  const reasons = detect?.adSuitability?.reasons || [];

  if (typeof score !== 'number') {
    return (
      <Card variant="outline">
        <CardBody>
          <Heading size="xs" mb={2}>AI Summary</Heading>
          <Text fontSize="xs" color="brand.muted">
            Ad readiness score not yet computed for this media. Re-run detect to populate.
          </Text>
        </CardBody>
      </Card>
    );
  }

  const tone = scoreTone(score);
  const positives = reasons.filter(r => r.severity === 'positive');
  const cautions  = reasons.filter(r => r.severity === 'caution');
  const negatives = reasons.filter(r => r.severity === 'negative');

  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" align="flex-start" mb={3}>
          <Heading size="xs">AI Summary</Heading>
          <Badge fontSize="9px" variant="subtle" px={2} py={0.5} borderRadius="md" style={{ background: tone.bg, color: tone.fg }}>
            Ad Readiness: {score.toFixed(1)} / 10
          </Badge>
        </HStack>

        <Progress
          value={score * 10}
          size="xs"
          borderRadius="full"
          bg="gray.100"
          sx={{ '& > div': { background: tone.bar } }}
          mb={3}
        />

        <VStack align="stretch" spacing={1.5}>
          {[...positives, ...cautions, ...negatives].map((r, i) => (
            <ReasonRow key={`${r.kind}-${i}`} reason={r} />
          ))}
        </VStack>

        {(cautions.length + negatives.length > 0) && (
          <Button onClick={drawer.onOpen} size="xs" variant="outline" mt={3} w="full">
            View Suggestions
          </Button>
        )}

        <SuggestionsDrawer isOpen={drawer.isOpen} onClose={drawer.onClose} reasons={reasons} score={score} />
      </CardBody>
    </Card>
  );
}

function ReasonRow({ reason }: { reason: ReadinessReason }) {
  const sym = reason.severity === 'positive' ? '✓' : reason.severity === 'caution' ? '⚠' : '✗';
  const color = reason.severity === 'positive' ? '#059669'
              : reason.severity === 'caution'  ? '#D97706'
              :                                  '#DC2626';
  return (
    <HStack spacing={2} align="flex-start">
      <Box
        w="14px" h="14px"
        flexShrink={0} mt="2px"
        borderRadius="full"
        display="flex" alignItems="center" justifyContent="center"
        fontSize="9px" fontWeight="800"
        color="white"
        bg={color}
      >
        {sym}
      </Box>
      <Text fontSize="xs" color="brand.ink" lineHeight="1.4">{reason.label}</Text>
    </HStack>
  );
}

function SuggestionsDrawer({ isOpen, onClose, reasons, score }: { isOpen: boolean; onClose: () => void; reasons: ReadinessReason[]; score: number }) {
  const issues = reasons.filter(r => r.severity !== 'positive');
  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <HStack justify="space-between" align="baseline">
            <Heading size="sm">Suggestions</Heading>
            <Text fontSize="xs" color="brand.muted">Readiness {score.toFixed(1)}/10</Text>
          </HStack>
        </DrawerHeader>
        <DrawerBody>
          {issues.length === 0 ? (
            <Text fontSize="sm" color="brand.muted">No issues flagged. This media is ready to use.</Text>
          ) : (
            <VStack align="stretch" spacing={4}>
              {issues.map((r, i) => (
                <Card key={i} variant="outline">
                  <CardBody>
                    <HStack mb={2}>
                      <ReasonRow reason={r} />
                    </HStack>
                    <Text fontSize="xs" color="brand.muted">{remediationFor(r)}</Text>
                  </CardBody>
                </Card>
              ))}
            </VStack>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

// First-cut remediation copy keyed by reason.kind. Could move to a
// dictionary file once the set stabilizes.
function remediationFor(reason: ReadinessReason): string {
  const map: Record<string, string> = {
    product_visibility: 'Try a tighter crop or better-lit framing of the product. The match service confidence climbs sharply once the product fills 25%+ of the frame.',
    safe_zones:         'There is limited room for overlays without obscuring the product or primary subject. Consider an aspect-ratio variant with more open background.',
    lighting:           'Brightness is outside the recommended range. Auto-fix in the renderer adjusts levels but a re-shot or re-pick of source media is more reliable.',
    focus:              'Image looks soft. Use a higher-resolution source if available, or consider this media for a still-frame placement only (motion blur masks softness).',
    subject_prominence: 'The primary subject is either too small or too crowded for the frame. The renderer can re-frame via smart crops; check the Crops tab for alternatives.',
    text_on_subject:    'Detected text overlaps the primary subject. The renderer overlay placement should avoid these regions, but consider whether the text is brand-relevant or distracting.',
    competitor:         'A competitor brand was detected in the frame. This media is unsuitable for own-brand ads without masking or cropping the competitor product.',
    low_match_quality:  'Product match certainty is below the comfortable threshold. The match may be wrong or the product may not be in your catalog yet.'
  };
  return map[reason.kind] || 'Review this signal — its impact on ad performance varies by placement.';
}

// ── Detected Products ─────────────────────────────────────────────

function DetectedProductsCard({ detect }: { detect: DetectResult | null }) {
  const matched = (detect?.productMatchesAll || []).filter(m =>
    m.outcome === 'product_match' || m.outcome === 'product_category'
  );
  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={3}>
          <Heading size="xs">Detected Products</Heading>
          <Badge fontSize="9px" variant="subtle" colorScheme="gray">{matched.length}</Badge>
        </HStack>
        {matched.length === 0 ? (
          <Text fontSize="xs" color="brand.muted">No product matches yet.</Text>
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
              const agreement  = (m.identification as Record<string, unknown> | null)?.['agreement'] as string | undefined;

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
                    <HStack mt={1} spacing={2} wrap="wrap">
                      <Text fontSize="10px" color="brand.muted">{Math.round(certainty * 100)}% match</Text>
                      <Badge variant="subtle" fontSize="9px" px={1.5} borderRadius="md" style={{ background: matchTone.bg, color: matchTone.fg }}>
                        {matchTone.label}
                      </Badge>
                      {m.matchSource && (
                        <Badge variant="subtle" fontSize="9px" px={1.5} borderRadius="md" colorScheme="purple">
                          {m.matchSource}
                        </Badge>
                      )}
                      {agreement && (
                        <Badge variant="outline" fontSize="9px" px={1.5} borderRadius="md">
                          {agreement}
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                </HStack>
              );
            })}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

// ── Scene & Subjects ──────────────────────────────────────────────

function SceneAndSubjectsCard({ detect }: { detect: DetectResult | null }) {
  const primary = detect?.primarySubjectLabel || detect?.primarySubjectDesc || null;
  const secondary = (detect?.secondaryElementsTags || []).filter(Boolean);
  const sceneType = detect?.background?.sceneType || detect?.background?.setting || null;
  const mood      = detect?.background?.mood || [];
  const timeOfDay = mapTimeOfDay(detect?.background?.lighting);

  return (
    <Card variant="outline">
      <CardBody>
        <Heading size="xs" mb={3}>Scene & Subjects</Heading>
        <VStack align="stretch" spacing={2.5}>
          <KVRow label="Primary Subject" value={primary} valueColor="rsViolet.700" />
          <KVRow label="Secondary Elements" value={secondary.length ? secondary.join(', ') : '—'} />
          <KVRow label="Scene Type" value={sceneType || '—'} />
          <KVRow label="Mood" value={mood.length ? mood.join(', ') : '—'} />
          <KVRow label="Time of Day" value={timeOfDay} />
        </VStack>
      </CardBody>
    </Card>
  );
}

function KVRow({ label, value, valueColor }: { label: string; value: string | null; valueColor?: string }) {
  return (
    <HStack justify="space-between" align="flex-start">
      <Text fontSize="xs" color="brand.muted" flexShrink={0}>{label}</Text>
      <Text fontSize="xs" color={valueColor || 'brand.ink'} fontWeight="600" textAlign="right" maxW="65%" noOfLines={2}>
        {value ?? '—'}
      </Text>
    </HStack>
  );
}

function mapTimeOfDay(lighting: string | undefined | null): string {
  if (!lighting) return '—';
  const l = lighting.toLowerCase();
  if (/golden hour/.test(l))   return 'Golden hour';
  if (/overcast/.test(l))      return 'Overcast';
  if (/dim indoor|night/.test(l)) return 'Night';
  if (/backlit/.test(l))       return 'Backlit';
  if (/hard studio|flash|harsh/.test(l)) return 'Studio';
  if (/soft|natural|daylight/.test(l))   return 'Daylight';
  return capitalize(lighting);
}

function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ── Technical Insights ────────────────────────────────────────────

function TechnicalInsightsCard({ detect }: { detect: DetectResult | null }) {
  const t = detect?.technicalInsights;
  return (
    <Card variant="outline">
      <CardBody>
        <Heading size="xs" mb={3}>Technical Insights</Heading>
        <HStack spacing={4} align="stretch">
          <MetricBox
            label="Brightness"
            value={t?.brightnessAvg != null ? `${Math.round(t.brightnessAvg * 100)}%` : '—'}
            quality={brightnessQuality(t?.brightnessAvg ?? null)}
          />
          <MetricBox
            label="Clutter"
            value={densityLabel(t?.densityAvg ?? null)}
            quality={densityQuality(t?.densityAvg ?? null)}
          />
          <MetricBox
            label="Focus"
            value={t?.focusBucket || '—'}
            quality={focusQuality(t?.focusBucket || null)}
          />
        </HStack>
      </CardBody>
    </Card>
  );
}

function MetricBox({ label, value, quality }: { label: string; value: string; quality: 'good' | 'ok' | 'poor' | 'unknown' }) {
  const qColor = quality === 'good' ? '#059669' : quality === 'ok' ? '#D97706' : quality === 'poor' ? '#DC2626' : '#94A3B8';
  const qLabel = quality === 'good' ? 'Good' : quality === 'ok' ? 'OK' : quality === 'poor' ? 'Poor' : '—';
  return (
    <Box flex={1} bg="gray.50" borderRadius="md" p={3} textAlign="center">
      <Text fontSize="10px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">{label}</Text>
      <Text fontSize="lg" fontWeight="800" color="brand.ink" mt={1}>{value}</Text>
      <HStack spacing={1} justify="center" mt={1}>
        <Box w="6px" h="6px" borderRadius="full" bg={qColor} />
        <Text fontSize="9px" color="brand.muted">{qLabel}</Text>
      </HStack>
    </Box>
  );
}

function brightnessQuality(v: number | null): 'good' | 'ok' | 'poor' | 'unknown' {
  if (v == null) return 'unknown';
  if (v >= 0.30 && v <= 0.75) return 'good';
  if (v >= 0.20 && v <= 0.85) return 'ok';
  return 'poor';
}
function densityLabel(v: number | null): string {
  if (v == null) return '—';
  if (v < 0.40)  return 'Low';
  if (v < 0.70)  return 'Medium';
  return 'High';
}
function densityQuality(v: number | null): 'good' | 'ok' | 'poor' | 'unknown' {
  if (v == null) return 'unknown';
  if (v < 0.40)  return 'good';
  if (v < 0.70)  return 'ok';
  return 'poor';
}
function focusQuality(b: string | null): 'good' | 'ok' | 'poor' | 'unknown' {
  if (!b) return 'unknown';
  if (b === 'Sharp')      return 'good';
  if (b === 'Acceptable') return 'ok';
  return 'poor';
}

// ── Raw data ──────────────────────────────────────────────────────

function RawDataCard({ detect }: { detect: DetectResult | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Card variant="outline">
      <CardBody>
        <HStack justify="space-between" mb={1}>
          <Heading size="xs">Raw AI Data</Heading>
          <Button size="xs" variant="ghost" onClick={() => setOpen(o => !o)}>
            <Icon viewBox="0 0 24 24" w={3} h={3} mr={1}>
              <path fill="currentColor" d={open ? 'M19 13H5v-2h14v2z' : 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'} />
            </Icon>
            {open ? 'Hide' : 'Show'}
          </Button>
        </HStack>
        <Collapse in={open}>
          <Box maxH="360px" overflowY="auto" bg="gray.50" p={2} borderRadius="md" mt={2}>
            <Code fontSize="9px" whiteSpace="pre" display="block">
              {detect ? JSON.stringify(stripHeavy(detect), null, 2) : '(no detect data)'}
            </Code>
          </Box>
        </Collapse>
      </CardBody>
    </Card>
  );
}

function stripHeavy(detect: DetectResult): Partial<DetectResult> {
  const { crops, extendedCrops, ...rest } = detect;
  void crops; void extendedCrops;
  return rest;
}

function scoreTone(score: number): { bg: string; fg: string; bar: string } {
  if (score >= 7.5) return { bg: 'rgba(16,185,129,0.10)',  fg: '#047857', bar: '#10B981' };
  if (score >= 5.0) return { bg: 'rgba(217,119,6,0.10)',   fg: '#B45309', bar: '#D97706' };
  return              { bg: 'rgba(220,38,38,0.10)',   fg: '#B91C1C', bar: '#DC2626' };
}
