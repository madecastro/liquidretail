// Campaigns page — primary nav entry for the campaign-driven ad-gen flow.
//
// Lists synced campaigns from connected integrations (Meta Ads, Google Ads,
// TikTok Shop) and is the launch point for the Generate Ads wizard.
// Backend campaign sync adapters are still unimplemented (B-2 / B-3 on the
// backlog), so the page renders an empty state with the Generate Ads CTA
// pointing into the wizard. Once /api/campaigns is wired the empty state
// becomes a list with per-row Generate buttons.

import { Card, CardBody, VStack, HStack, Text, Heading, Button, Badge, Box } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';

export function CampaignsPage() {
  // TODO(wizard backend): swap this mock list for a real /api/campaigns
  // fetch keyed on brandId. The Generate Ads CTA currently jumps straight
  // into the wizard's Step 1 (campaign select) which itself shows the
  // empty state.
  const campaigns: Array<{ id: string; name: string; platform: string; status: string }> = [];

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Step 2 / 3"
        title="Campaigns"
        description="Connected campaigns from Meta Ads, Google Ads, and TikTok Shop. Pick one to generate a fresh batch of ads — or upload media to start a new campaign."
      />

      <HStack justify="space-between" align="center">
        <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
          Synced campaigns
        </Heading>
        <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
          Generate Ads
        </Button>
      </HStack>

      {campaigns.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No campaigns yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="lg">
                Connect Meta Ads, Google Ads, or TikTok Shop to sync your campaigns.
              </Text>
              <Text color="brand.muted" fontSize="sm" maxW="520px" mx="auto">
                Once connected, this list shows every active campaign with its product set,
                budget, and targeting — and a per-row Generate button kicks off the ad-generation
                wizard pre-filled with that campaign's products.
              </Text>
              <HStack justify="center" spacing={2} pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="sm">
                  Connect integrations
                </Button>
                <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
                  Start without a campaign
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <VStack align="stretch" spacing={3}>
          {campaigns.map(c => (
            <Card key={c.id} variant="outline">
              <CardBody>
                <HStack justify="space-between">
                  <Box>
                    <HStack spacing={2}>
                      <Text fontWeight="700" color="brand.ink">{c.name}</Text>
                      <Badge fontSize="9px" colorScheme="purple" variant="subtle">{c.platform}</Badge>
                      <Badge fontSize="9px" colorScheme={c.status === 'active' ? 'green' : 'gray'} variant="subtle">
                        {c.status}
                      </Badge>
                    </HStack>
                  </Box>
                  <Button
                    as={RouterLink}
                    to={`/generate-ads?campaignId=${c.id}`}
                    variant="brand"
                    size="sm"
                  >
                    Generate Ads
                  </Button>
                </HStack>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
