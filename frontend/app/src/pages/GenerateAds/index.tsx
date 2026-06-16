// Generate Ads wizard — three-step state machine driving the
// campaign → products → generate flow.
//
// Settings (templates / CTA / tracking URL) was dropped from the wizard
// in favor of AI-driven variety: all ai_* templates run by default per
// (media × product) seed, copy_candidates feed the CTA text at render
// time, and ctaUrl falls back to brand.websiteUrl. Operators no longer
// pick templates or author CTA copy in the wizard — the four
// CreativeDirector concepts per media are what drive output variety.
//
// Step state lives in the URL (?step=campaign|products|generate) so
// back/forward and sharable bookmarks work. Selections live in React
// state and are passed to each step as props.
//
// Routes that fold into this wizard via empty states:
//   no campaigns → Step 1 offers Connect / New Campaign / Upload Media
//   no media     → Step 2 redirects to /upload (deep-link route preserved)
//
// Legacy ?step=settings URLs from older bookmarks fall through to
// 'campaign' via the STEPS.some() guard below — the type keeps
// 'settings' as a valid (but unused) key so TS doesn't complain on
// stale links until they get rewritten by the next save.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, HStack, VStack, Button, Text, Heading, Flex, Badge } from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';
import { Step1Campaign } from './Step1Campaign';
import { Step2Picker } from './Step2Picker';
import { Step4Generate } from './Step4Generate';

export type WizardStepKey = 'campaign' | 'products' | 'generate';

// Default template fanout — all five ai_* templates run per seed so
// the LLM has the widest creative-style menu without operator picking.
// Variety within a template comes from the four Director concepts.
const DEFAULT_TEMPLATE_IDS = [
  'ai_brand_led',
  'ai_ugc_led',
  'ai_social_proof_led',
  'ai_editorial',
  'ai_promotional'
];

export type PlatformFormat = 'meta_feed_1_1' | 'meta_reels_9_16';

export type WizardSelections = {
  campaignId:   string | null;
  // Hydrated by Step 2 from /api/campaigns/:id. Lets the wizard know
  // when a brand-mode campaign is active so we can relax Step 2's
  // "must pick something" gate (brand campaigns seed brand_match
  // media on the backend without explicit picks).
  campaignKind: string | null;
  // Platform-format-aware ad generation (Phase 2 wizard picker).
  // Drives the Director + HTML Gen format constraints + safe-area
  // pixel boxes downstream. Default 'meta_feed_1_1' preserves legacy
  // behavior (no extra constraints — same as Director was producing
  // pre-Phase-2). Sent through /api/ads/generate body to expand-
  // WizardJob, which overrides Campaign.platformFormat for this run.
  platformFormat: PlatformFormat;
  productIds:  string[];
  // Pre-populated when the wizard is deep-linked from the media
  // library's "Generate Ads" button. Each id rides through to the
  // POST /api/ads/generate payload as mediaIds[]; the campaign service
  // dispatches by ProductMatchArtifact.outcome to determine product
  // featuring.
  mediaIds:    string[];
  templateIds: string[];
  ctaText:     string;
  ctaUrl:      string;
  urlParams:   string;       // raw querystring fragment, e.g. utm_source=...&utm_medium=...
  // Pairing-level exclusions surfaced from Step 2's match ribbons.
  // Each entry is `${productId||'null'}|${mediaId}` — POST'd to
  // /api/ads/generate as [{productId, mediaId}] objects so the
  // backend can drop the matching tuples from the cartesian.
  // brand_match exclusions use productId='null' (no specific SKU).
  excludedPairings: string[];
  // Product-kind tier toggles. Default false — product campaigns
  // only seed strict product_match UGC unless the operator clicks
  // the "Include category-matched" / "Include brand-matched" expand
  // buttons in Step 2. Plumbed through Step 4 into the
  // POST /api/ads/generate body where seedsFromProduct consumes them.
  includeCategoryMatched: boolean;
  includeBrandMatched:    boolean;
};

const STEPS: Array<{ key: WizardStepKey; label: string; description: string }> = [
  { key: 'campaign', label: 'Campaign', description: 'Pick a synced campaign or create one' },
  { key: 'products', label: 'Products', description: 'Select what to feature' },
  { key: 'generate', label: 'Generate', description: 'Review & render' }
];

// Brand-kind campaigns frame Step 2 as a media-first selection (one
// unified ribbon mixing catalog imagery + UGC). Override the visible
// label + description without changing the URL slug 'products' so
// back/forward + deep links stay stable.
function stepsForKind(kind: string | null): typeof STEPS {
  if (kind !== 'brand') return STEPS;
  return STEPS.map(s => s.key === 'products'
    ? { ...s, label: 'Media', description: 'Select Media — catalog imagery and social posts' }
    : s);
}

function stepIndex(k: WizardStepKey): number {
  return STEPS.findIndex(s => s.key === k);
}

export function GenerateAdsWizard() {
  const [params, setParams] = useSearchParams();
  const initialCampaignId = params.get('campaignId');
  // ?mediaIds=X,Y,Z — comma-separated list deep-linked from the media
  // library's "Generate Ads" button. ?productIds=A,B can also pre-pop
  // from a future product-catalog deep-link.
  const initialMediaIds = (params.get('mediaIds') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const initialProductIds = (params.get('productIds') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const stepFromUrl = (params.get('step') as WizardStepKey) || 'campaign';
  const step: WizardStepKey = STEPS.some(s => s.key === stepFromUrl) ? stepFromUrl : 'campaign';

  const [selections, setSelections] = useState<WizardSelections>({
    campaignId:   initialCampaignId,
    campaignKind: null,
    productIds:   initialProductIds,
    mediaIds:     initialMediaIds,
    // Settings step was dropped — defaults below replace what the
    // operator used to author. Templates run all 5 ai_* by default,
    // CTA text/URL/UTMs ship blank and the backend fills them in
    // (copy_candidates for cta_text, brand.websiteUrl for ctaUrl,
    // no UTM tracking).
    templateIds:  DEFAULT_TEMPLATE_IDS.slice(),
    ctaText:      '',
    ctaUrl:       '',
    urlParams:    '',
    platformFormat: 'meta_feed_1_1',
    excludedPairings: [],
    includeCategoryMatched: false,
    includeBrandMatched:    false
  });

  // Clean up one-shot deep-link params (mediaIds / productIds) once
  // we've absorbed them into state — those were carried in from the
  // Media Library / Catalog Browser "Generate Ads" buttons and shouldn't
  // re-trigger on back/forward. campaignId DOES stay in the URL —
  // it's the wizard's session anchor, so refreshing on any step keeps
  // the campaign context (and lets Step 2 hydrate the campaignKind
  // before rendering the picker, instead of falling through to the
  // legacy "other kinds" layout on a kindless re-init).
  useEffect(() => {
    if (initialMediaIds.length || initialProductIds.length) {
      const next = new URLSearchParams(params);
      next.delete('mediaIds');
      next.delete('productIds');
      next.set('step', step);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (k: WizardStepKey) => {
    const next = new URLSearchParams(params);
    next.set('step', k);
    // Keep campaignId in the URL on every step navigation so a refresh
    // on Step 2/3/4 re-hydrates the wizard with the right campaign
    // context (and the right Step 2 layout via campaignKind).
    if (selections.campaignId) next.set('campaignId', selections.campaignId);
    setParams(next, { replace: false });
  };
  const back = () => {
    const i = stepIndex(step);
    if (i > 0) goTo(STEPS[i - 1].key);
  };
  const next = () => {
    const i = stepIndex(step);
    if (i < STEPS.length - 1) goTo(STEPS[i + 1].key);
  };

  const update = (patch: Partial<WizardSelections>) =>
    setSelections(prev => {
      // Changing the campaign invalidates downstream selections — but
      // ONLY when the operator is switching between two real campaigns
      // mid-wizard. The first-time selection (prev.campaignId is null →
      // first pick) must preserve any deep-linked productIds / mediaIds
      // the wizard arrived with from the Media Library or Catalog
      // Browser, otherwise they're silently dropped on Step 1.
      const switchingExistingCampaign =
        patch.campaignId !== undefined
        && patch.campaignId !== prev.campaignId
        && !!prev.campaignId;
      if (switchingExistingCampaign) {
        return {
          ...prev,
          ...patch,
          productIds: [],
          mediaIds: [],
          excludedPairings: [],
          includeCategoryMatched: false,
          includeBrandMatched: false
        };
      }
      return { ...prev, ...patch };
    });

  // Step → can-proceed gate. Each step decides what it requires; the
  // Kind-aware step labels for the Stepper + Next button. The
  // underlying STEPS keys / URL slugs stay stable.
  const displayedSteps = useMemo(() => stepsForKind(selections.campaignKind), [selections.campaignKind]);

  // wizard footer reads this to enable/disable Next.
  const canProceed = useMemo(() => {
    if (step === 'campaign') return !!selections.campaignId;
    // Brand-mode campaigns can proceed with no picks — the seeder
    // falls back to brand_match media. Product/synced campaigns
    // still require a picked product or media.
    if (step === 'products') {
      return selections.productIds.length > 0
          || selections.mediaIds.length > 0
          || selections.campaignKind === 'brand';
    }
    return true;
  }, [step, selections]);

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Generate Ads"
        title="New ad batch"
        description="Pick a campaign, choose products or media, and render. Templates and CTA copy are AI-driven — no setup required."
      />

      <Stepper current={step} steps={displayedSteps} />

      <Box>
        {step === 'campaign' && <Step1Campaign value={selections} onChange={update} />}
        {step === 'products' && <Step2Picker value={selections} onChange={update} />}
        {step === 'generate' && <Step4Generate value={selections} />}
      </Box>

      <HStack justify="space-between" pt={2}>
        <Button as={RouterLink} to="/campaigns" variant="ghost" size="sm">
          Cancel
        </Button>
        <HStack spacing={2}>
          {stepIndex(step) > 0 && (
            <Button onClick={back} variant="outline" size="sm">Back</Button>
          )}
          {step !== 'generate' ? (
            <Button onClick={next} variant="brand" size="sm" isDisabled={!canProceed}>
              Next: {displayedSteps[stepIndex(step) + 1]?.label}
            </Button>
          ) : null}
        </HStack>
      </HStack>
    </VStack>
  );
}

function Stepper({ current, steps }: { current: WizardStepKey; steps: typeof STEPS }) {
  const idx = stepIndex(current);
  return (
    <Flex
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="lg"
      bg="brand.surface"
      px={4}
      py={3}
      gap={3}
      align="center"
      wrap="wrap"
    >
      {steps.map((s, i) => {
        const status = i < idx ? 'done' : i === idx ? 'active' : 'pending';
        return (
          <HStack key={s.key} spacing={2} flex={1} minW="180px">
            <Box
              w="24px" h="24px"
              borderRadius="full"
              bg={status === 'active' ? 'rsViolet.500' : status === 'done' ? 'green.400' : 'gray.200'}
              color="white"
              display="flex" alignItems="center" justifyContent="center"
              fontSize="xs" fontWeight="800"
              flexShrink={0}
            >
              {status === 'done' ? '✓' : i + 1}
            </Box>
            <Box minW={0}>
              <Text fontSize="sm" fontWeight="700" color={status === 'active' ? 'rsViolet.700' : 'brand.ink'} noOfLines={1}>
                {s.label}
              </Text>
              <Text fontSize="10px" color="brand.muted" noOfLines={1}>{s.description}</Text>
            </Box>
            {status === 'active' && <Badge fontSize="9px" colorScheme="purple" variant="subtle">Now</Badge>}
          </HStack>
        );
      })}
    </Flex>
  );
}

export function StepShell({ heading, helper, children }: { heading: string; helper?: string; children: React.ReactNode }) {
  return (
    <Box borderWidth="1px" borderColor="brand.border" borderRadius="lg" bg="brand.surface" p={5}>
      <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink" mb={1}>{heading}</Heading>
      {helper && <Text fontSize="xs" color="brand.muted" mb={4}>{helper}</Text>}
      {children}
    </Box>
  );
}
