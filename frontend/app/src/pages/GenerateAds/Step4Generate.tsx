// Step 4 — Review & Generate.
//
// Summarizes the selections from steps 1–3 so the operator can sanity-
// check before kicking off the render. POST /api/ads/generate is
// async — the server creates a CampaignRun, returns 202 immediately,
// and renders in the background. We route to /ads?campaignRunId=X
// where the page polls /api/ads/runs/:id to show progress as
// creatives stream in.

import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Divider, Badge, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
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
          // Smoke-test default — bypasses the (campaignId, derivationDigest)
          // de-dupe so a re-fire produces fresh renders instead of returning
          // any blank Ads cached during earlier broken deploys. Once the
          // pipeline stabilizes this drops to a wizard checkbox so dedupe
          // is the default again (saves Cloudinary bytes on identical inputs).
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
          <Button
            variant="brand"
            size="md"
            onClick={generate}
            isLoading={busy}
            loadingText="Generating…"
            isDisabled={seedCount === 0 || value.templateIds.length === 0 || !value.ctaText.trim()}
          >
            Generate Ads
          </Button>
        </HStack>

        {seedCount === 0 && (
          <Badge alignSelf="flex-start" colorScheme="orange" variant="subtle" fontSize="10px">
            Pick at least one product or one media to enable Generate.
          </Badge>
        )}
        {seedCount > 0 && value.templateIds.length === 0 && (
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
