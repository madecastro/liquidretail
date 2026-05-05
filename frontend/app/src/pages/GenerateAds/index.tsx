// Generate Ads wizard — four-step state machine driving the
// campaign → products → settings → generate flow described in the
// reorg.
//
// Step state lives in the URL (?step=campaign|products|settings|generate)
// so back/forward and sharable bookmarks work. Selections live in
// React state and are passed to each step as props; once the backend
// endpoints land (campaigns list, per-campaign filtered catalog,
// templates list, /api/ads/generate) the steps swap their stub UI for
// real data.
//
// Routes that fold into this wizard via empty states:
//   no campaigns → Step 1 offers Connect / New Campaign / Upload Media
//   no media     → Step 2 redirects to /upload (deep-link route preserved)

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, HStack, VStack, Button, Text, Heading, Flex, Badge } from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';
import { Step1Campaign } from './Step1Campaign';
import { Step2Products } from './Step2Products';
import { Step3Settings } from './Step3Settings';
import { Step4Generate } from './Step4Generate';

export type WizardStepKey = 'campaign' | 'products' | 'settings' | 'generate';

export type WizardSelections = {
  campaignId:  string | null;
  productIds:  string[];
  templateIds: string[];
  ctaText:     string;
  ctaUrl:      string;
  urlParams:   string;       // raw querystring fragment, e.g. utm_source=...&utm_medium=...
};

const STEPS: Array<{ key: WizardStepKey; label: string; description: string }> = [
  { key: 'campaign', label: 'Campaign', description: 'Pick a synced campaign or create one' },
  { key: 'products', label: 'Products', description: 'Select what to feature' },
  { key: 'settings', label: 'Settings', description: 'Templates, CTA, tracking' },
  { key: 'generate', label: 'Generate', description: 'Review & render' }
];

function stepIndex(k: WizardStepKey): number {
  return STEPS.findIndex(s => s.key === k);
}

export function GenerateAdsWizard() {
  const [params, setParams] = useSearchParams();
  const initialCampaignId = params.get('campaignId');

  const stepFromUrl = (params.get('step') as WizardStepKey) || 'campaign';
  const step: WizardStepKey = STEPS.some(s => s.key === stepFromUrl) ? stepFromUrl : 'campaign';

  const [selections, setSelections] = useState<WizardSelections>({
    campaignId:  initialCampaignId,
    productIds:  [],
    templateIds: [],
    ctaText:     '',
    ctaUrl:      '',
    urlParams:   ''
  });

  // Keep ?campaignId=… clean once we've absorbed it into state — saves
  // a stale param leaking into the next step's URL.
  useEffect(() => {
    if (initialCampaignId) {
      const next = new URLSearchParams(params);
      next.delete('campaignId');
      next.set('step', step);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (k: WizardStepKey) => {
    const next = new URLSearchParams(params);
    next.set('step', k);
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
      // Changing the campaign invalidates downstream selections —
      // products are scoped to the previous campaign, so clear them
      // so Step 2's auto-select can re-fire against the new match set.
      if (patch.campaignId !== undefined && patch.campaignId !== prev.campaignId) {
        return { ...prev, ...patch, productIds: [] };
      }
      return { ...prev, ...patch };
    });

  // Step → can-proceed gate. Each step decides what it requires; the
  // wizard footer reads this to enable/disable Next.
  const canProceed = useMemo(() => {
    if (step === 'campaign') return !!selections.campaignId;
    if (step === 'products') return selections.productIds.length > 0;
    if (step === 'settings') return selections.templateIds.length > 0 && selections.ctaText.trim().length > 0;
    return true;
  }, [step, selections]);

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Generate Ads"
        title="New ad batch"
        description="Pick a campaign, choose products, set templates + CTA, and render. Each step locks in your selection before moving on."
      />

      <Stepper current={step} />

      <Box>
        {step === 'campaign' && <Step1Campaign value={selections} onChange={update} />}
        {step === 'products' && <Step2Products value={selections} onChange={update} />}
        {step === 'settings' && <Step3Settings value={selections} onChange={update} />}
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
              Next: {STEPS[stepIndex(step) + 1]?.label}
            </Button>
          ) : null}
        </HStack>
      </HStack>
    </VStack>
  );
}

function Stepper({ current }: { current: WizardStepKey }) {
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
      {STEPS.map((s, i) => {
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
