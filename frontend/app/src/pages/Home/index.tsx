// Home dashboard — the landing page after onboarding completes AND
// the default page when an authenticated user enters the app.
//
// Three action cards drive the operator into the three top-level
// workflows: review the brand, manage campaigns, or generate ads.
// Cards 2 + 3 are gated on useAdReadiness (the same hook the
// Campaigns page + Step 4 of the wizard use) so the operator can't
// click into ad-creation flows while detect is still in flight on
// any connected source.
//
// The onboarding status panel sits between the welcome header and
// the cards so the operator sees pipeline progress at a glance every
// time they return to the app — not just on the brand page.

import { Box, Card, CardBody, VStack, Heading, Text, SimpleGrid, Tooltip } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';
import { useBrand } from '../../brand/BrandContext';
import { useAdReadiness, type AdReadiness } from '../../brand/useAdReadiness';
import { OnboardingStatusPanel } from '../Brand/OnboardingStatusPanel';

// Compose the tooltip body when ad-readiness blocks a card. Same
// shape the Campaigns page uses — leads with the reason, then the
// per-source blockers on their own lines.
function readinessTooltip(r: AdReadiness): string {
  if (r.ready) return '';
  const lines = (r.blockers || []).map(b => `• ${b.message}`);
  return [r.reason, ...lines].filter(Boolean).join('\n');
}

export function HomePage() {
  const { activeBrand } = useBrand();
  const readiness = useAdReadiness();
  const gateDisabled = !readiness.ready;
  const gateTip = readinessTooltip(readiness);
  const brandLabel = activeBrand?.name || 'your brand';

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Home"
        title={`Welcome back`}
        description={`Pick up where you left off with ${brandLabel}. Check pipeline status below and head into the workflow you need.`}
      />

      {activeBrand?.id && <OnboardingStatusPanel brandId={activeBrand.id} />}

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <ActionCard
          to="/brand"
          title="Review brand details"
          description="Tone, voice, visual identity, integrations, automation. Always editable."
          accent="rsViolet"
        />
        <ActionCard
          to="/campaigns"
          title="Create a campaign"
          description="Sync from Meta / Google or build a fresh reach-social campaign (product, brand, promotional, raffle)."
          accent="blue"
          disabled={gateDisabled}
          disabledTip={gateTip}
        />
        <ActionCard
          to="/generate-ads"
          title="Build ads"
          description="Wizard: pick a campaign, choose seeds, set CTA, generate. Output lands on the Ads page for review and push to Meta."
          accent="orange"
          disabled={gateDisabled}
          disabledTip={gateTip}
        />
      </SimpleGrid>
    </VStack>
  );
}

type AccentScheme = 'rsViolet' | 'blue' | 'orange';
function ActionCard({
  to, title, description, accent, disabled, disabledTip
}: {
  to:          string;
  title:       string;
  description: string;
  accent:      AccentScheme;
  disabled?:   boolean;
  disabledTip?: string;
}) {
  // Color tokens — match the existing visual language. accent only
  // tints the top edge and hover state so the card itself stays
  // neutral against the brand surface.
  const accentBorder = `${accent}.400`;
  const cardInner = (
    <Card
      variant="outline"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.55 : 1}
      _hover={disabled
        ? {}
        : { borderColor: accentBorder, transform: 'translateY(-2px)', boxShadow: 'md' }}
      transition="all 140ms"
      h="100%"
    >
      <Box h="4px" bg={accentBorder} borderTopRadius="md" />
      <CardBody>
        <VStack align="stretch" spacing={2}>
          <Heading size="sm" color="brand.ink">{title}</Heading>
          <Text fontSize="sm" color="brand.muted">{description}</Text>
          {disabled && (
            <Text fontSize="11px" color="orange.700" mt={1} fontWeight="700">
              Finish onboarding to enable
            </Text>
          )}
        </VStack>
      </CardBody>
    </Card>
  );

  if (disabled) {
    // Tooltip wrap — Chakra Tooltip on a div lets the operator hover
    // anywhere in the card to see WHY it's disabled. RouterLink is
    // intentionally not rendered so the card can't be clicked through.
    return (
      <Tooltip label={disabledTip} hasArrow whiteSpace="pre-line" placement="top">
        <Box>{cardInner}</Box>
      </Tooltip>
    );
  }
  return (
    <Box as={RouterLink} to={to} _hover={{ textDecoration: 'none' }}>
      {cardInner}
    </Box>
  );
}

export default HomePage;
