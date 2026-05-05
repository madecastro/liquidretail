// Phase 4d — Brand Safety card.
//
// Risk Score gauge + Category + Blocked Topics chips. "Adjust Settings"
// opens a modal where the operator can override the risk score, set
// the category (drives default blocked-topic suggestions), and curate
// the blocked-topics chip list.
//
// Persists via PATCH /api/brand/:id with { brandSafety: {...} } —
// field added to the editable list in commit a4132f5.

import { useState } from 'react';
import {
  Card, CardBody, HStack, VStack, Box, Text, Heading, Button, Badge,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  FormControl, FormLabel, Select, Input, NumberInput, NumberInputField,
  Wrap, WrapItem, IconButton, useDisclosure, useToast, Icon, Tooltip
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import type { Brand } from './types';

const CATEGORY_OPTIONS = [
  'Food & CPG',
  'Apparel',
  'Beauty & Personal Care',
  'Home Goods',
  'Outdoor / Sporting Goods',
  'Electronics',
  'Health & Wellness',
  'Pet',
  'Other'
];

// First-cut suggested topics per category. The Adjust Settings modal
// pre-fills these when the user picks a category for the first time;
// they can always add or remove.
const SUGGESTED_BLOCKED_BY_CATEGORY: Record<string, string[]> = {
  'Food & CPG':                ['Alcohol', 'Gambling', 'Guns', 'Hate Speech'],
  'Apparel':                   ['Hate Speech', 'Adult', 'Tobacco'],
  'Beauty & Personal Care':    ['Adult', 'Hate Speech', 'Counterfeits'],
  'Home Goods':                ['Hate Speech', 'Adult'],
  'Outdoor / Sporting Goods':  ['Hate Speech', 'Adult'],
  'Electronics':               ['Hate Speech', 'Counterfeits'],
  'Health & Wellness':         ['Tobacco', 'Alcohol', 'Adult', 'Misinformation'],
  'Pet':                       ['Hate Speech', 'Animal Abuse'],
  'Other':                     ['Hate Speech', 'Adult']
};

type Props = { brand: Brand; onChanged: () => void };

export function BrandSafetyCard({ brand, onChanged }: Props) {
  const dialog = useDisclosure();
  const safety = brand.brandSafety || {};
  const score = typeof safety.riskScore === 'number' ? safety.riskScore : null;
  const band  = scoreBand(score);

  return (
    <>
      <Card variant="outline" h="100%">
        <CardBody>
          <HStack mb={3} spacing={2}>
            <ShieldIcon />
            <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em">Brand Safety</Heading>
          </HStack>

          <HStack align="center" spacing={4} mb={4}>
            <VStack align="flex-start" spacing={1} flex={1}>
              <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">Risk Score</Text>
              <Text fontSize="3xl" fontWeight="800" color={band.fg} lineHeight="1">{score == null ? '—' : score}</Text>
              <Badge variant="subtle" fontSize="10px" px={2} py={0.5} borderRadius="md" style={{ background: band.bg, color: band.fg }}>
                {band.label}
              </Badge>
            </VStack>
            <Box flex={1}>
              <Gauge value={score} />
            </Box>
          </HStack>

          <VStack align="stretch" spacing={2.5} mb={4}>
            <KVRow label="Category" value={safety.category || null} />
            <KVRow label="Blocked Topics" value={null}>
              {(safety.blockedTopics?.length ?? 0) > 0 ? (
                <Wrap spacing={1.5}>
                  {(safety.blockedTopics || []).map((t, i) => (
                    <WrapItem key={i}>
                      <Badge variant="subtle" colorScheme="red" fontSize="10px" px={1.5} py={0.5} borderRadius="md" textTransform="none">
                        {t}
                      </Badge>
                    </WrapItem>
                  ))}
                </Wrap>
              ) : (
                <Text fontSize="xs" color="brand.muted" fontStyle="italic">None set</Text>
              )}
            </KVRow>
          </VStack>

          <Button size="sm" variant="outline" w="100%" onClick={dialog.onOpen}>
            Adjust Settings
          </Button>
        </CardBody>
      </Card>

      <AdjustSafetyModal
        isOpen={dialog.isOpen}
        onClose={dialog.onClose}
        brand={brand}
        onChanged={onChanged}
      />
    </>
  );
}

function KVRow({ label, value, children }: { label: string; value: string | null; children?: React.ReactNode }) {
  return (
    <HStack justify="space-between" align="flex-start" spacing={3}>
      <Text fontSize="xs" color="brand.muted" flexShrink={0} pt={0.5}>{label}</Text>
      <Box maxW="65%" textAlign="right">
        {children
          ? children
          : <Text fontSize="sm" color="brand.ink" fontWeight="600">{value || '—'}</Text>}
      </Box>
    </HStack>
  );
}

function Gauge({ value }: { value: number | null }) {
  // SVG arc gauge from -120° to +120°. value 0..100 maps to a needle
  // angle; arc is filled with a green→red gradient. Very lightweight
  // — no external dep.
  const start = -120;
  const end   = 120;
  const v     = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0;
  const angle = start + ((end - start) * v) / 100;

  return (
    <Box position="relative" w="100%" h="80px">
      <svg viewBox="0 0 200 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="risk-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#10B981" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
        {/* base arc — full track */}
        <path
          d={arcPath(100, 95, 80, start, end)}
          stroke="#E5E7EB"
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
        />
        {/* gradient overlay arc */}
        <path
          d={arcPath(100, 95, 80, start, end)}
          stroke="url(#risk-gradient)"
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />
        {/* needle */}
        {value != null && (
          <g transform={`rotate(${angle} 100 95)`}>
            <line x1={100} y1={95} x2={100} y2={25} stroke="#0B1020" strokeWidth={3} strokeLinecap="round" />
            <circle cx={100} cy={95} r={6} fill="#0B1020" />
          </g>
        )}
        {/* axis labels */}
        <text x={20}  y={108} fontSize="9" fill="#94A3B8">0</text>
        <text x={177} y={108} fontSize="9" fill="#94A3B8">100</text>
      </svg>
    </Box>
  );
}

// Polar-to-cartesian arc-path helper. Generates a single SVG arc
// from (cx,cy) with radius r between startAngle..endAngle (degrees,
// 0° = up).
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const a1 = ((startAngle - 90) * Math.PI) / 180;
  const a2 = ((endAngle   - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function scoreBand(score: number | null): { label: string; bg: string; fg: string } {
  if (score == null)  return { label: 'Not assessed', bg: 'rgba(100,116,139,0.10)', fg: '#475569' };
  if (score < 40)     return { label: 'Low Risk',     bg: 'rgba(16,185,129,0.10)',  fg: '#047857' };
  if (score < 70)     return { label: 'Medium Risk',  bg: 'rgba(217,119,6,0.10)',   fg: '#B45309' };
  return                  { label: 'High Risk',     bg: 'rgba(220,38,38,0.10)',   fg: '#B91C1C' };
}

// ── Adjust Settings modal ─────────────────────────────────────────

function AdjustSafetyModal({
  isOpen, onClose, brand, onChanged
}: {
  isOpen: boolean;
  onClose: () => void;
  brand: Brand;
  onChanged: () => void;
}) {
  const safety = brand.brandSafety || {};
  const [category,    setCategory]    = useState<string>(safety.category || '');
  const [riskScore,   setRiskScore]   = useState<string>(typeof safety.riskScore === 'number' ? String(safety.riskScore) : '');
  const [blocked,     setBlocked]     = useState<string[]>(safety.blockedTopics || []);
  const [topicInput,  setTopicInput]  = useState('');
  const [busy,        setBusy]        = useState(false);
  const toast = useToast();

  const applySuggested = () => {
    if (!category) return;
    const suggested = SUGGESTED_BLOCKED_BY_CATEGORY[category] || [];
    const merged = Array.from(new Set([...blocked, ...suggested]));
    setBlocked(merged);
  };

  const addTopic = () => {
    const v = topicInput.trim();
    if (!v) return;
    if (blocked.includes(v)) return;
    setBlocked([...blocked, v]);
    setTopicInput('');
  };

  const removeTopic = (t: string) => setBlocked(blocked.filter(x => x !== t));

  const save = async () => {
    setBusy(true);
    try {
      const score = riskScore.trim() === '' ? null : Math.max(0, Math.min(100, Number(riskScore)));
      await apiJson(`/api/brand/${brand._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandSafety: {
            category:      category || null,
            riskScore:     Number.isFinite(score as number) ? score : null,
            blockedTopics: blocked,
            adjustedAt:    new Date()
          }
        })
      });
      toast({ title: 'Brand safety updated', status: 'success', duration: 2500 });
      onChanged();
      onClose();
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Adjust Brand Safety</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel fontSize="sm">Category</FormLabel>
              <HStack>
                <Select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Select category…"
                  size="sm"
                >
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Tooltip label="Merge category-suggested blocked topics into the list" hasArrow>
                  <Button size="sm" variant="outline" onClick={applySuggested} isDisabled={!category}>
                    Apply suggested
                  </Button>
                </Tooltip>
              </HStack>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Risk Score (0–100)</FormLabel>
              <HStack>
                <NumberInput
                  value={riskScore}
                  onChange={(_, n) => setRiskScore(Number.isFinite(n) ? String(n) : '')}
                  min={0}
                  max={100}
                  size="sm"
                  flex={1}
                >
                  <NumberInputField placeholder="leave blank to clear" />
                </NumberInput>
                <Text fontSize="xs" color="brand.muted">
                  Override the auto-computed score. Cleared = "not assessed".
                </Text>
              </HStack>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Blocked Topics</FormLabel>
              <Wrap spacing={1.5} mb={2}>
                {blocked.length === 0 && <Text fontSize="xs" color="brand.muted" fontStyle="italic">No blocked topics yet</Text>}
                {blocked.map((t, i) => (
                  <WrapItem key={i}>
                    <Badge variant="subtle" colorScheme="red" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" display="inline-flex" alignItems="center" gap={1}>
                      {t}
                      <IconButton
                        aria-label={`Remove ${t}`}
                        size="xs"
                        variant="ghost"
                        minW="14px"
                        h="14px"
                        onClick={() => removeTopic(t)}
                        icon={<Box as="span" fontSize="10px" lineHeight={1}>×</Box>}
                      />
                    </Badge>
                  </WrapItem>
                ))}
              </Wrap>
              <HStack>
                <Input
                  size="sm"
                  value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTopic(); }
                  }}
                  placeholder="Add a blocked topic — e.g. Adult, Tobacco, Misinformation"
                />
                <Button size="sm" variant="outline" onClick={addTopic} isDisabled={!topicInput.trim()}>Add</Button>
              </HStack>
            </FormControl>

            <Text fontSize="10px" color="brand.muted">
              The matcher checks each post's caption, OCR text, and comments against the blocked-topic list. Hits are flagged
              do_not_use and excluded from creative generation. Risk score and category are advisory for now.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={busy}>Cancel</Button>
          <Button variant="brand" onClick={save} isLoading={busy}>Save</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ShieldIcon() {
  return <Icon viewBox="0 0 24 24" w="16px" h="16px" color="rsViolet.500"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" /></Icon>;
}
