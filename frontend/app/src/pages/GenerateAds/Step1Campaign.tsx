// Step 1 — Campaign select.
//
// Lists the brand's synced campaigns from connected integrations (Meta,
// Google, TikTok). The user picks one — that selection drives the
// product filter in Step 2 and the CTA / URL params suggested in Step 3.
//
// Empty states:
//   no campaigns       → offer Connect Integrations + New Campaign + Upload Media
//   no media at all    → upload form (link to /upload)
//
// Backend wiring lands in a follow-up — for now the campaigns list is
// stubbed empty, so this step always renders the empty state.

import { Box, VStack, HStack, Text, Button, Card, CardBody, Radio, RadioGroup, Badge } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { WizardSelections } from './index';
import { StepShell } from './index';

type Campaign = {
  id:       string;
  name:     string;
  platform: 'meta-ads' | 'google-ads' | 'tiktok-shop';
  status:   string;
  productCount: number;
};

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step1Campaign({ value, onChange }: Props) {
  // TODO(wizard backend): replace with /api/campaigns?brandId=X.
  const campaigns: Campaign[] = [];
  const hasMedia = false;       // TODO: derive from /api/media?brandId=X count

  if (campaigns.length === 0) {
    return (
      <StepShell heading="Pick a campaign" helper="Synced campaigns will appear here once you connect an integration.">
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={6} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No campaigns connected
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="md">
                {hasMedia
                  ? 'Connect Meta Ads, Google Ads, or TikTok Shop to sync existing campaigns — or create a new one.'
                  : 'Connect an integration to sync campaigns, or upload media to start your first campaign from scratch.'}
              </Text>
              <HStack justify="center" spacing={2} pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="sm">
                  Connect integrations
                </Button>
                <Button variant="outline" size="sm" isDisabled>
                  + New campaign
                </Button>
                {!hasMedia && (
                  <Button as={RouterLink} to="/upload" variant="brand" size="sm">
                    Upload media
                  </Button>
                )}
              </HStack>
              <Text fontSize="10px" color="brand.muted" pt={2}>
                Manual campaign creation and the in-wizard upload flow ship in a follow-up.
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </StepShell>
    );
  }

  return (
    <StepShell heading="Pick a campaign" helper="Choose the campaign whose product set you want to generate ads for.">
      <RadioGroup value={value.campaignId || ''} onChange={(v) => onChange({ campaignId: v || null })}>
        <VStack align="stretch" spacing={2}>
          {campaigns.map(c => (
            <CampaignRow key={c.id} campaign={c} selected={c.id === value.campaignId} />
          ))}
        </VStack>
      </RadioGroup>
    </StepShell>
  );
}

function CampaignRow({ campaign, selected }: { campaign: Campaign; selected: boolean }) {
  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <Radio value={campaign.id}>
        <HStack spacing={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="700" color="brand.ink">{campaign.name}</Text>
          <Badge fontSize="9px" colorScheme="purple" variant="subtle">{campaign.platform}</Badge>
          <Badge fontSize="9px" colorScheme={campaign.status === 'active' ? 'green' : 'gray'} variant="subtle">
            {campaign.status}
          </Badge>
        </HStack>
        <Text fontSize="11px" color="brand.muted" mt={0.5}>
          {campaign.productCount} product{campaign.productCount === 1 ? '' : 's'} in set
        </Text>
      </Radio>
    </Box>
  );
}
