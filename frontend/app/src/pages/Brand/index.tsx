// Phase 4a — Brand page entry. Replaces the legacy /brand placeholder.
// Phase 4b — wires inline edit mode via useBrandEdit. The hook owns
// the working draft + dirty tracking; cards render edit affordances
// when isEditing is true. SaveBar surfaces only when editing or dirty.
//
// Layout (top to bottom):
//   Breadcrumb
//   Header card (logo, name, status pill, URL, tagline, timestamps, CTAs)
//   Integrations card                  ← Phase 4c placeholder
//   Two-col: Automation Engine ┃ Brand Safety   ← Phase 4c / 4d placeholders
//   Brand Voice Profile (full width)
//   Three-col: Visual Identity ┃ Preview ┃ Audience Personas
//   Danger Zone
//   SaveBar (sticky, surfaces only when editing/dirty)

import { Box, VStack, HStack, SimpleGrid, Text, Spinner, Card, CardBody, useToast } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useBrandDetail } from './useBrandDetail';
import { useBrandEdit } from './useBrandEdit';
import { BrandHeader } from './Header';
import { BrandVoiceCard } from './BrandVoiceCard';
import { VisualIdentityCard } from './VisualIdentityCard';
import { AudiencePersonasCard } from './AudiencePersonasCard';
import { DangerZone } from './DangerZone';
import { SaveBar } from './SaveBar';
import { PlaceholderCard } from './PlaceholderCard';

export function BrandPage() {
  const { brand, loading, error, refresh } = useBrandDetail();
  const edit = useBrandEdit(brand, refresh);
  const toast = useToast();

  // Surface save errors via toast (also rendered inline in SaveBar)
  useEffect(() => {
    if (edit.error) {
      toast({ title: 'Save failed', description: edit.error, status: 'error', duration: 4000 });
    }
  }, [edit.error, toast]);

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
      <Breadcrumb brandName={brand.name} />

      <VStack align="stretch" spacing={5} mt={3} pb={20}>
        <BrandHeader brand={brand} edit={edit} onChanged={refresh} />

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

        <BrandVoiceCard brand={brand} edit={edit} />

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={5}>
          <VisualIdentityCard brand={brand} edit={edit} />
          <PlaceholderCard
            title="Preview"
            phase="Phase 4d"
            iconColor="#16B8D8"
            description="Carousel of sample ad creatives rendered with this brand applied. Backend prereq: a /api/brand/:id/preview endpoint that returns 3-4 layout-input previews using a representative Media."
          />
          <AudiencePersonasCard brand={brand} edit={edit} />
        </SimpleGrid>

        <DangerZone brand={brand} />
      </VStack>

      <SaveBar
        isEditing={edit.isEditing}
        dirty={edit.dirty}
        saving={edit.saving}
        error={edit.error}
        onCancel={edit.cancelEdit}
        onSave={edit.save}
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
