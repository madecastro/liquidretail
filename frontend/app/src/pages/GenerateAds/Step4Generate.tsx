// Step 3 — Review & Generate. (Was Step 4 before Settings was dropped.)
//
// Summarizes the selections from steps 1–2 so the operator can sanity-
// check before kicking off the render. POST /api/ads/generate is
// async — the server creates a CampaignRun, returns 202 immediately,
// and renders in the background. We route to /ads?campaignRunId=X
// where the page polls /api/ads/runs/:id to show progress as
// creatives stream in.
//
// Templates / CTA copy / landing URL are no longer authored in the
// wizard. The wizard plugs in defaults (all 5 ai_* templates, empty
// CTA strings, empty UTMs); the backend fills in CTA text from
// copy_candidates at render time and falls back to brand.websiteUrl
// for ctaUrl. The summary below shows only the operator-authored
// picks (campaign + products + media).

import { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Button, Divider, Badge, Tooltip, useToast, Spinner } from '@chakra-ui/react';
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

type PreviewResponse = {
  total:         number;
  byProduct:     Record<string, number>;
  byVariantKind: { ugc: number; product_image: number };
  seedCount:     number;
  productCount:  number;
};

export function Step4Generate({ value }: Props) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const readiness = useAdReadiness();
  const gateDisabled = !readiness.ready;
  const gateTip = gateDisabled
    ? [readiness.reason, ...(readiness.blockers || []).map(b => `• ${b.message}`)].filter(Boolean).join('\n')
    : '';

  // Naive client-side count is kept as the loading placeholder while
  // the backend dry-run resolves. The backend dry-run is authoritative
  // — it accounts for matchedMedia fan-in, alt expansion, per-product
  // cap (3), and the global MAX_ADS cap, none of which the client can
  // see without re-implementing the seed engine.
  const seedCount      = value.productIds.length + value.mediaIds.length;
  const naiveEstimate  = seedCount * value.templateIds.length;
  const totalCreatives = preview?.total ?? naiveEstimate;

  // Fetch the dry-run preview on entry + whenever selections change.
  // Skips when the form isn't valid enough to run expansion (no
  // campaign, no templates, no seeds).
  useEffect(() => {
    if (!value.campaignId || !value.templateIds.length || seedCount === 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const excludePairings = (value.excludedPairings || []).map(s => {
      const [pid, mid] = s.split('|');
      return { productId: pid === 'null' ? null : pid, mediaId: mid };
    });
    apiJson<PreviewResponse>('/api/ads/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId:  value.campaignId,
        productIds:  value.productIds,
        mediaIds:    value.mediaIds,
        templateIds: value.templateIds,
        cta:         { text: value.ctaText, url: value.ctaUrl },
        urlParams:   value.urlParams,
        platformFormat: value.platformFormat,
        kinds:          value.adKinds,
        excludePairings,
        includeCategoryMatched: value.includeCategoryMatched,
        includeBrandMatched:    value.includeBrandMatched
      })
    })
      .then(res => { if (!cancelled) setPreview(res); })
      .catch(()  => { if (!cancelled) setPreview(null); })
      .finally(()=> { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [
    value.campaignId,
    value.productIds.join(','),
    value.mediaIds.join(','),
    value.templateIds.join(','),
    value.ctaText,
    value.ctaUrl,
    value.urlParams,
    value.platformFormat,
    value.adKinds,
    value.includeCategoryMatched,
    value.includeBrandMatched,
    (value.excludedPairings || []).join(','),
    seedCount
  ]);

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
          platformFormat: value.platformFormat,
          kinds:          value.adKinds,
          excludePairings,
          includeCategoryMatched: value.includeCategoryMatched,
          includeBrandMatched:    value.includeBrandMatched
          // refresh:true was a smoke-test workaround for the bug where
          // dedupe-hit ads kept their original campaignRunId and made
          // /ads?campaignRunId=X come back empty. Resolved by #111
          // (campaignRunIds[] $addToSet on every run pick), so we now
          // run with dedupe-by-default — re-running the wizard on the
          // same picks correctly surfaces the existing ads in the new
          // run's gallery.
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
        <Divider my={2} />

        <HStack justify="space-between" align="center">
          <Box>
            <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">Output</Text>
            <HStack spacing={2} mt={1}>
              <Text fontSize="lg" fontWeight="800" color="brand.ink">{totalCreatives}</Text>
              <Text fontSize="sm" color="brand.muted">
                creative{totalCreatives === 1 ? '' : 's'}
                {preview ? (
                  <> ({preview.byVariantKind?.product_image ?? 0} product image{(preview.byVariantKind?.product_image ?? 0) === 1 ? '' : 's'}, {preview.byVariantKind?.ugc ?? 0} UGC; ≤3 per product)</>
                ) : (
                  <> (estimate; backend dry-run pending)</>
                )}
              </Text>
              {previewLoading && <Spinner size="xs" color="brand.muted" />}
            </HStack>
          </Box>
          <Tooltip label={gateTip} isDisabled={!gateDisabled} hasArrow whiteSpace="pre-line">
            <Button
              variant="brand"
              size="md"
              onClick={generate}
              isLoading={busy}
              loadingText="Generating…"
              isDisabled={gateDisabled || seedCount === 0}
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

