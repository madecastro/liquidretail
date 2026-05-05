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
import { IntegrationsCard } from './IntegrationsCard';
import { AutomationEngineCard } from './AutomationEngineCard';
import { BrandSafetyCard } from './BrandSafetyCard';
import { PreviewCard } from './PreviewCard';
import { DangerZone } from './DangerZone';
import { SaveBar } from './SaveBar';

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

        <IntegrationsCard brand={brand} />

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
          <AutomationEngineCard brand={brand} onChanged={refresh} />
          <BrandSafetyCard brand={brand} onChanged={refresh} />
        </SimpleGrid>

        <BrandVoiceCard brand={brand} edit={edit} />

        <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={5}>
          <VisualIdentityCard brand={brand} edit={edit} />
          <PreviewCard brand={brand} />
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
