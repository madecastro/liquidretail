// Ads page — gallery of rendered creatives produced by the renderer.
//
// Backend renderer (Phase 1 — Puppeteer image render) and the
// RenderArtifact model are still on the backlog, so the page ships as
// a stub with the empty state. Once /api/render-artifacts (or similar)
// is live, this becomes a filterable grid of every rendered creative
// keyed by brand/campaign/template.

import { Card, CardBody, VStack, HStack, Text, Heading, Button } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';

export function AdsPage() {
  // TODO(render service): replace with a real /api/render-artifacts
  // fetch and grid layout (template, ratio, format, thumbnail, status).
  const ads: Array<{ id: string; templateName: string; aspectRatio: string; thumbnailUrl: string }> = [];

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Step 3 / 3"
        title="Ads"
        description="Every ad creative the renderer has produced for this brand. Filter by campaign, template, or aspect ratio; download for export to the platform of your choice."
      />

      <HStack justify="space-between" align="center">
        <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
          Rendered creatives
        </Heading>
        <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
          Generate Ads
        </Button>
      </HStack>

      {ads.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No rendered ads yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="lg">
                Run the Generate Ads wizard from a campaign to produce your first batch.
              </Text>
              <Text color="brand.muted" fontSize="sm" maxW="540px" mx="auto">
                Each generated creative lands here as a downloadable PNG (Phase 1 image renderer)
                tied back to the campaign, the chosen template, and the source product. Phase 2
                adds video.
              </Text>
              <HStack justify="center" pt={2}>
                <Button as={RouterLink} to="/campaigns" variant="outline" size="sm">
                  Pick a campaign
                </Button>
                <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
                  Generate Ads
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      ) : null}
    </VStack>
  );
}
