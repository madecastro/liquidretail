// Step 4 — Review & Generate.
//
// Summarizes the selections from steps 1–3 so the operator can sanity-
// check before kicking off the render. The Generate button is wired to
// a stubbed POST /api/ads/generate today (no-ops with a friendly toast)
// — once the Phase 1 render service ships, this fires N renders
// (templates × products) and routes to /ads to watch them stream in.

import { useState } from 'react';
import { Box, VStack, HStack, Text, Button, Divider, Badge, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { WizardSelections } from './index';
import { StepShell } from './index';

type Props = {
  value: WizardSelections;
};

export function Step4Generate({ value }: Props) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const totalCreatives = value.productIds.length * value.templateIds.length;
  const composedUrl = composeCtaUrl(value.ctaUrl, value.urlParams);

  const generate = async () => {
    setBusy(true);
    try {
      // TODO(render service): POST /api/ads/generate { campaignId, productIds,
      // templateIds, cta: { text, url }, urlParams }. Until Phase 1 lands the
      // wizard intentionally toasts and bounces to /ads where the empty state
      // explains where the artifacts will appear.
      await new Promise(r => setTimeout(r, 600));
      toast({
        title: 'Render service not yet wired',
        description: `Would generate ${totalCreatives} creative${totalCreatives === 1 ? '' : 's'} once Phase 1 ships.`,
        status: 'info',
        duration: 5000
      });
      navigate('/ads');
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
                creative{totalCreatives === 1 ? '' : 's'} ({value.productIds.length} products × {value.templateIds.length} templates)
              </Text>
            </HStack>
          </Box>
          <Button
            variant="brand"
            size="md"
            onClick={generate}
            isLoading={busy}
            loadingText="Generating…"
            isDisabled={totalCreatives === 0 || !value.ctaText.trim()}
          >
            Generate Ads
          </Button>
        </HStack>

        {totalCreatives === 0 && (
          <Badge alignSelf="flex-start" colorScheme="orange" variant="subtle" fontSize="10px">
            Pick at least one product and one template to enable Generate.
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
