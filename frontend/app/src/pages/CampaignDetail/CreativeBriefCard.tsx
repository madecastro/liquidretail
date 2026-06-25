// Creative Brief card — surfaces the per-campaign brief that
// campaignBriefDerivationService inferred from this campaign's
// targeting, objective, matched products, and ad creatives. Threaded
// into the Director when ads are generated under this campaign.
//
// Operator can:
//   - View goal, pitch, focus, audience, tone, CTA emphasis, evidence
//   - Refresh (POST /api/campaigns/:id/derive-brief?force=true)
//   - Clear (PATCH /api/campaigns/:id/brief { brief: null })

import { useState } from 'react';
import {
  Card, CardBody, HStack, VStack, Text, Heading, Badge, Wrap, WrapItem,
  Box, Icon, Button, Spinner, useToast
} from '@chakra-ui/react';
import { apiJson, apiFetch } from '../../auth/apiFetch';
import type { CreativeBrief } from './index';

type Props = {
  campaignId:      string;
  brief:           CreativeBrief | null | undefined;
  briefDerivedAt:  string | null | undefined;
  onChanged?:      () => void;
};

export function CreativeBriefCard({ campaignId, brief, briefDerivedAt, onChanged }: Props) {
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const derivedAt = briefDerivedAt ? new Date(briefDerivedAt) : null;
  const hasBrief = !!brief && Object.keys(brief).length > 0;

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await apiJson<{ ok?: boolean; skipped?: boolean; reason?: string }>(
        `/api/campaigns/${encodeURIComponent(campaignId)}/derive-brief?force=true`,
        { method: 'POST' }
      );
      if (r.skipped) {
        toast({ title: 'Skipped', description: r.reason || 'no change', status: 'info', duration: 4000 });
      } else {
        toast({ title: 'Brief refreshed', status: 'success', duration: 3000 });
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
      const res = await apiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/brief`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brief: null })
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Brief cleared', status: 'success', duration: 3000 });
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
            <BriefIcon />
            <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
              Creative Brief
            </Heading>
            <Badge variant="subtle" colorScheme="purple" fontSize="9px" px={1.5} py={0.5}>AI inferred</Badge>
            {brief?.evidence?.adCount != null && (
              <Text fontSize="xs" color="brand.muted">· {brief.evidence.adCount} creatives analyzed</Text>
            )}
            {brief?.evidence?.hasInsights && (
              <Badge variant="subtle" colorScheme="green" fontSize="9px" px={1.5} py={0.5}>Has performance data</Badge>
            )}
          </HStack>
          <HStack spacing={2}>
            {derivedAt && (
              <Text fontSize="xs" color="brand.muted">Last derived {derivedAt.toLocaleDateString()}</Text>
            )}
            <Button
              size="xs"
              variant="outline"
              onClick={refresh}
              isLoading={refreshing}
              leftIcon={refreshing ? <Spinner size="xs" /> : <BriefIcon />}
            >
              {hasBrief ? 'Refresh' : 'Derive now'}
            </Button>
            {hasBrief && (
              <Button size="xs" variant="ghost" onClick={clear} isLoading={clearing}>
                Clear
              </Button>
            )}
          </HStack>
        </HStack>

        {!hasBrief && (
          <Text fontSize="sm" color="brand.muted">
            No brief derived yet. Click "Derive now" to extract one from this campaign's targeting + creatives, or it will run automatically the next time campaigns sync.
          </Text>
        )}

        {hasBrief && brief && (
          <VStack align="stretch" spacing={4}>
            {brief.goal && (
              <Field label="Goal" value={brief.goal} />
            )}
            {brief.pitch && (
              <Field label="Pitch" value={brief.pitch} italic />
            )}

            <HStack align="flex-start" spacing={6} wrap="wrap">
              {brief.focus && (
                <Box minW="160px">
                  <Text fontSize="xs" color="brand.muted" mb={1.5}>Dominant lever</Text>
                  <Badge colorScheme="purple" variant="subtle" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="capitalize" fontWeight="600">
                    {brief.focus.replace(/_/g, ' ')}
                  </Badge>
                </Box>
              )}
              {brief.cta_emphasis && (
                <Box minW="160px">
                  <Text fontSize="xs" color="brand.muted" mb={1.5}>CTA emphasis</Text>
                  <Badge colorScheme="green" variant="subtle" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="capitalize" fontWeight="600">
                    {brief.cta_emphasis.replace(/_/g, ' ')}
                  </Badge>
                </Box>
              )}
              {Array.isArray(brief.tone) && brief.tone.length > 0 && (
                <Box flex={1} minW="240px">
                  <Text fontSize="xs" color="brand.muted" mb={1.5}>Tone</Text>
                  <Wrap spacing={2}>
                    {brief.tone.map((t, i) => (
                      <WrapItem key={i}>
                        <Badge variant="subtle" colorScheme="orange" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
                          {t}
                        </Badge>
                      </WrapItem>
                    ))}
                  </Wrap>
                </Box>
              )}
            </HStack>

            {brief.audience && (brief.audience.description || (brief.audience.segments?.length ?? 0) > 0 || (brief.audience.interests?.length ?? 0) > 0) && (
              <Box>
                <Text fontSize="xs" color="brand.muted" mb={1.5}>Audience</Text>
                <VStack align="stretch" spacing={2}>
                  {brief.audience.description && (
                    <Text fontSize="sm" color="brand.ink">{brief.audience.description}</Text>
                  )}
                  <HStack spacing={3} wrap="wrap">
                    {brief.audience.ageRange && (
                      <Badge variant="outline" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="500">
                        Age {brief.audience.ageRange}
                      </Badge>
                    )}
                    {Array.isArray(brief.audience.geo) && brief.audience.geo.slice(0, 4).map((g, i) => (
                      <Badge key={i} variant="outline" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="500">{g}</Badge>
                    ))}
                  </HStack>
                  {Array.isArray(brief.audience.segments) && brief.audience.segments.length > 0 && (
                    <Wrap spacing={2}>
                      {brief.audience.segments.map((s, i) => (
                        <WrapItem key={i}>
                          <Badge variant="subtle" colorScheme="blue" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
                            {s}
                          </Badge>
                        </WrapItem>
                      ))}
                    </Wrap>
                  )}
                  {Array.isArray(brief.audience.interests) && brief.audience.interests.length > 0 && (
                    <Wrap spacing={2}>
                      {brief.audience.interests.slice(0, 8).map((it, i) => (
                        <WrapItem key={i}>
                          <Badge variant="subtle" colorScheme="teal" fontSize="11px" px={2} py={1} borderRadius="md" textTransform="none" fontWeight="600">
                            {it}
                          </Badge>
                        </WrapItem>
                      ))}
                    </Wrap>
                  )}
                </VStack>
              </Box>
            )}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

function Field({ label, value, italic }: { label: string; value: string; italic?: boolean }) {
  return (
    <Box>
      <Text fontSize="xs" color="brand.muted" mb={1.5}>{label}</Text>
      <Text fontSize="sm" color="brand.ink" lineHeight="1.55" fontStyle={italic ? 'italic' : 'normal'}>
        {value}
      </Text>
    </Box>
  );
}

function BriefIcon() {
  return (
    <Icon viewBox="0 0 24 24" w="14px" h="14px" color="rsViolet.500">
      <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 7V3.5L18.5 9H14zM8 13h8v2H8zm0 4h5v2H8z" />
    </Icon>
  );
}
