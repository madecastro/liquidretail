// Phase 4a — Brand page entry. Replaces the legacy /brand placeholder.
//
// Layout (top to bottom):
//   Breadcrumb
//   Header card (logo, name, status pill, URL, tagline, timestamps, CTAs)
//   Integrations card                  ← Phase 4c placeholder
//   Two-col: Automation Engine ┃ Brand Safety   ← Phase 4c / 4d placeholders
//   Brand Voice Profile (full width)
//   Three-col: Visual Identity ┃ Preview ┃ Audience Personas
//   Danger Zone
//   SaveBar (sticky)
//
// 4a ships read-only display + delete + refresh-AI. 4b adds inline
// edit mode wired to SaveBar. 4c lights up Integrations + Automation.
// 4d adds Brand Safety + Preview render.

import { useState } from 'react';
import { Box, VStack, HStack, SimpleGrid, Text, Spinner, Card, CardBody } from '@chakra-ui/react';
import { useBrandDetail } from './useBrandDetail';
import { BrandHeader } from './Header';
import { BrandVoiceCard } from './BrandVoiceCard';
import { VisualIdentityCard } from './VisualIdentityCard';
import { AudiencePersonasCard } from './AudiencePersonasCard';
import { DangerZone } from './DangerZone';
import { SaveBar } from './SaveBar';
import { PlaceholderCard } from './PlaceholderCard';

export function BrandPage() {
  const { brand, loading, error, refresh } = useBrandDetail();
  // Phase 4a — dirty/saving are stubs. Phase 4b wires real edit state.
  const [dirty]   = useState(false);
  const [saving]  = useState(false);

  if (loading && !brand) {
    return <Card variant="outline"><CardBody><HStack><Spinner /><Text fontSize="sm" color="brand.muted">Loading brand…</Text></HStack></CardBody></Card>;
  }

  if (error) {
    return <Card variant="outline"><CardBody><Text color="red.600" fontSize="sm">Failed to load brand: {error}</Text></CardBody></Card>;
  }

  if (!brand) {
    return (
      <Card variant="outline">
        <CardBody>
          <Text fontSize="sm" color="brand.muted">No active brand. Pick one from the sidebar brand picker, or create a new brand.</Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <Box>
      {/* Breadcrumb sits inline with shell content; the shell already
          gives us page padding. */}
      <Breadcrumb brandName={brand.name} />

      <VStack align="stretch" spacing={5} mt={3} pb={20}>
        <BrandHeader brand={brand} onChanged={refresh} />

        <PlaceholderCard
          title="Integrations"
          phase="Phase 4c"
          iconColor="#0B84D8"
          description="Connect Instagram, Meta Ads, Google Merchant, TikTok Shop. Status, manage/disconnect, last-synced timestamps, and Sync Now CTA. Wires against the existing IntegrationCredential collection."
        />

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
          <PlaceholderCard
            title="Automation Engine"
            phase="Phase 4c"
            iconColor="#7A35E8"
            description="Auto-reply on matches · Auto-create products from detect · Auto-sync schedule. Wires existing Brand.commentReply / uploadSettings.autoCreateFromDetect / syncSettings."
          />
          <PlaceholderCard
            title="Brand Safety"
            phase="Phase 4d"
            iconColor="#DC2626"
            description="Risk Score gauge (0-100) · Category · Blocked Topics. NEW concept — needs schema additions on Brand.brandSafety { riskScore, category, blockedTopics[], adjustedAt } before the UI can wire."
          />
        </SimpleGrid>

        <BrandVoiceCard brand={brand} />

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={5}>
          <VisualIdentityCard brand={brand} />
          <PlaceholderCard
            title="Preview"
            phase="Phase 4d"
            iconColor="#16B8D8"
            description="Carousel of sample ad creatives rendered with this brand applied. Backend prereq: a /api/brand/:id/preview endpoint that returns 3-4 layout-input previews using a representative Media."
          />
          <AudiencePersonasCard brand={brand} />
        </SimpleGrid>

        <DangerZone brand={brand} />
      </VStack>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onCancel={() => {/* Phase 4b */}}
        onSave={() => {/* Phase 4b */}}
      />
    </Box>
  );
}

function Breadcrumb({ brandName }: { brandName: string }) {
  return (
    <HStack spacing={2} fontSize="sm" color="brand.muted">
      <Text>Advertisers</Text>
      <Text color="brand.muted">›</Text>
      <Text color="brand.ink" fontWeight="600">{brandName}</Text>
    </HStack>
  );
}
