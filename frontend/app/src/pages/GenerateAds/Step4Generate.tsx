// Step 4 — Review & Generate.
//
// Summarizes the selections from steps 1–3 so the operator can sanity-
// check before kicking off the render. POST /api/ads/generate is
// async — the server creates a CampaignRun, returns 202 immediately,
// and renders in the background. We route to /ads?campaignRunId=X
// where the page polls /api/ads/runs/:id to show progress as
// creatives stream in.

import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Divider, Badge, Tooltip, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
import { useAdReadiness } from '../../brand/useAdReadiness';
import type { WizardSelections } from './index';
import { StepShell } from './index';

type Props = {
  value: WizardSelections;
};

type GenerateResponse = {
  campaignRunId: string;
  campaignId:    string;
  brandId:       string;
  campaignKind:  string | null;
  total:         number;
  status:        'running' | 'done' | 'failed';
};

export function Step4Generate({ value }: Props) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const readiness = useAdReadiness();
  const gateDisabled = !readiness.ready;
  const gateTip = gateDisabled
    ? [readiness.reason, ...(readiness.blockers || []).map(b => `• ${b.message}`)].filter(Boolean).join('\n')
    : '';

  // Each seed (a picked product OR a picked media) cartesians against
  // every selected template × shipping ratio. Media-only seeds are
  // valid — seedFromMedia falls back to brand_match when no PMA links
  // them to a product. Backend caps the total at MAX_CREATIVES_PER_RUN
  // (6 today) regardless of this number.
  const seedCount     = value.productIds.length + value.mediaIds.length;
  const totalCreatives = seedCount * value.templateIds.length;
  const composedUrl = composeCtaUrl(value.ctaUrl, value.urlParams);

  const generate = async () => {
    setBusy(true);
    try {
      // Decode the Step 2 picker's pairing-exclusions back into the
      // shape the backend expects: [{productId|null, mediaId}].
      // Encoded as `${productId||'null'}|${mediaId}` strings.
      const excludePairings = (value.excludedPairings || []).map(s => {
        const [pid, mid] = s.split('|');
        return { productId: pid === 'null' ? null : pid, mediaId: mid };
      });
      const res = await apiJson<GenerateResponse>('/api/ads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId:  value.campaignId,
          productIds:  value.productIds,
          mediaIds:    value.mediaIds,
          templateIds: value.templateIds,
          cta:         { text: value.ctaText, url: value.ctaUrl },
          urlParams:   value.urlParams,
          excludePairings,
          // Legacy passthrough — the new queue-time identityDigest dedup
          // makes this a no-op on the server, but the field is still
          // accepted for backwards compat with operator muscle memory.
          refresh:     true
        })
      });
      toast({
        title:       'Generating ads',
        description: `${res.total} creative${res.total === 1 ? '' : 's'} queued — watching progress on the Ads page.`,
        status:      'info',
        duration:    4000
      });
      navigate(`/ads?campaignRunId=${encodeURIComponent(res.campaignRunId)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      toast({ title: 'Generate failed', description: msg, status: 'error', duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell heading="Review & generate" helper="Confirm selections, then kick off the render.">
      <VStack align="stretch" spacing={4}>
        <SummaryRow label="Campaign" value={value.campaignId || '—'} />
        <SummaryRow
          label="Products"
          value={
            value.productIds.length
              ? `${value.productIds.length} product${value.productIds.length === 1 ? '' : 's'} selected`
              : '— none —'
          }
        />
        <SummaryRow
          label="Media"
          value={
            value.mediaIds.length
              ? `${value.mediaIds.length} media selected`
              : '— none —'
          }
        />
        <SummaryRow
          label="Templates"
          value={
            value.templateIds.length
              ? value.templateIds.join(', ')
              : '— none —'
          }
        />
        <SummaryRow label="CTA text" value={value.ctaText || '—'} />
        <SummaryRow
          label="Landing URL"
          value={composedUrl || '—'}
          mono
        />

        <Divider my={2} />

        <HStack justify="space-between" align="center">
          <Box>
            <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">Output</Text>
            <HStack spacing={2} mt={1}>
              <Text fontSize="lg" fontWeight="800" color="brand.ink">{totalCreatives}</Text>
              <Text fontSize="sm" color="brand.muted">
                creative{totalCreatives === 1 ? '' : 's'} ({seedCount} seed{seedCount === 1 ? '' : 's'} × {value.templateIds.length} template{value.templateIds.length === 1 ? '' : 's'}, capped at 6 per run)
              </Text>
            </HStack>
          </Box>
          <Tooltip label={gateTip} isDisabled={!gateDisabled} hasArrow whiteSpace="pre-line">
            <Button
              variant="brand"
              size="md"
              onClick={generate}
              isLoading={busy}
              loadingText="Generating…"
              isDisabled={gateDisabled || seedCount === 0 || value.templateIds.length === 0 || !value.ctaText.trim()}
            >
              Generate Ads
            </Button>
          </Tooltip>
        </HStack>

        {gateDisabled && !readiness.loading && (
          <VStack align="stretch" spacing={1} bg="orange.50" borderWidth="1px" borderColor="orange.300" borderRadius="md" p={3}>
            <Text fontSize="11px" fontWeight="700" color="orange.700" textTransform="uppercase" letterSpacing="0.06em">
              Account setup incomplete
            </Text>
            <Text fontSize="sm" color="brand.ink">{readiness.reason}</Text>
            {readiness.blockers.map(b => (
              <Text key={b.code} fontSize="11px" color="brand.muted">• {b.message}</Text>
            ))}
          </VStack>
        )}
        {!gateDisabled && seedCount === 0 && (
          <Badge alignSelf="flex-start" colorScheme="orange" variant="subtle" fontSize="10px">
            Pick at least one product or one media to enable Generate.
          </Badge>
        )}
        {!gateDisabled && seedCount > 0 && value.templateIds.length === 0 && (
          <Badge alignSelf="flex-start" colorScheme="orange" variant="subtle" fontSize="10px">
            Pick at least one template on Step 3 to enable Generate.
          </Badge>
        )}
      </VStack>
    </StepShell>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <HStack justify="space-between" align="flex-start" spacing={4}>
      <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" flexShrink={0} pt={0.5} minW="100px">
        {label}
      </Text>
      <Text
        fontSize="sm"
        color="brand.ink"
        fontWeight="600"
        textAlign="right"
        fontFamily={mono ? 'mono' : undefined}
        wordBreak="break-all"
      >
        {value}
      </Text>
    </HStack>
  );
}

function composeCtaUrl(url: string, params: string): string {
  const u = (url || '').trim();
  const p = (params || '').trim().replace(/^[?&]/, '');
  if (!u) return '';
  if (!p) return u;
  return u.includes('?') ? `${u}&${p}` : `${u}?${p}`;
}
