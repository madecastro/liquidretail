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
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBrandDetail } from './useBrandDetail';
import { useBrandEdit } from './useBrandEdit';
import { BrandHeader } from './Header';
import { BrandVoiceCard } from './BrandVoiceCard';
import { VisualIdentityCard } from './VisualIdentityCard';
import { AudiencePersonasCard } from './AudiencePersonasCard';
import { IntegrationsCard, type IntegrationsCardHandle } from './IntegrationsCard';
import { AutomationEngineCard } from './AutomationEngineCard';
import { BrandSafetyCard } from './BrandSafetyCard';
import { PreviewCard } from './PreviewCard';
import { BrandReviewsCard } from './BrandReviewsCard';
import { DangerZone } from './DangerZone';
import { SaveBar } from './SaveBar';

export function BrandPage() {
  const { brand, loading, error, refresh } = useBrandDetail();
  const edit = useBrandEdit(brand, refresh);
  const toast = useToast();

  // Imperative handle into IntegrationsCard so the post-OAuth bounce
  // params (ig_setup / ads_setup) can pop the appropriate picker open
  // immediately on landing, without the user having to click "Finish
  // setup" on the tile.
  const integrationsRef = useRef<IntegrationsCardHandle>(null);
  const [pendingSetup, setPendingSetup] = useState<{ kind: 'Instagram' | 'Meta Ads'; id: string } | null>(null);

  // Surface save errors via toast (also rendered inline in SaveBar)
  useEffect(() => {
    if (edit.error) {
      toast({ title: 'Save failed', description: edit.error, status: 'error', duration: 4000 });
    }
  }, [edit.error, toast]);

  // Consume post-OAuth bounce query params from /api/integrations/*/callback
  // (see services/frontendOriginValidator). The new app is now in the
  // allowlist so callbacks land here on /brand?ig_status=...&ig_setup=...
  // (or ads_status=... for Meta Ads). Show a toast based on status,
  // stash any setupId for the picker auto-open effect, then strip the
  // params so a page reload doesn't re-toast.
  useSearchParamsConsumer({
    onConsume: ({ status, kind, msg, setupId }) => {
      if (status === 'denied') {
        toast({ title: `${kind} not connected`, description: 'You declined the consent screen.', status: 'warning', duration: 4000 });
      } else if (status === 'error') {
        toast({ title: `${kind} connect failed`, description: msg || 'Unknown error', status: 'error', duration: 5000 });
      } else if (status === 'connected' || status === 'active') {
        toast({ title: `${kind} connected`, status: 'success', duration: 2500 });
      }
      // 'pending' yields no toast — the picker modal popping open is
      // sufficient feedback. Stash the setupId; the effect below pops
      // the picker once IntegrationsCard has mounted.
      if (setupId) setPendingSetup({ kind, id: setupId });
    }
  });

  // Pop the picker once both the brand has loaded (so IntegrationsCard
  // is mounted and the imperative ref is wired) and we have a stashed
  // setupId from the OAuth bounce.
  useEffect(() => {
    if (!pendingSetup || !brand || !integrationsRef.current) return;
    if (pendingSetup.kind === 'Instagram') integrationsRef.current.openIGPicker(pendingSetup.id);
    else integrationsRef.current.openAdsPicker(pendingSetup.id);
    setPendingSetup(null);
  }, [pendingSetup, brand]);

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

        <IntegrationsCard ref={integrationsRef} brand={brand} />

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
          <AutomationEngineCard brand={brand} onChanged={refresh} />
          <BrandSafetyCard brand={brand} onChanged={refresh} />
        </SimpleGrid>

        <BrandVoiceCard brand={brand} edit={edit} />

        <BrandReviewsCard brand={brand} onChanged={refresh} />

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

// Consume the post-OAuth bounce query params (ig_status / ig_setup
// from Instagram, ads_status / ads_setup from Meta Ads) once on mount,
// then strip them from the URL so a refresh doesn't re-fire the toast.
// The provider/state-purpose distinction is encoded in the param
// prefix; this hook normalizes them into a single shape.
function useSearchParamsConsumer({
  onConsume
}: {
  onConsume: (event: { status: string; kind: 'Instagram' | 'Meta Ads'; msg: string | null; setupId: string | null }) => void;
}) {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const igStatus  = params.get('ig_status');
    const adsStatus = params.get('ads_status');
    if (!igStatus && !adsStatus) return;

    const status   = igStatus || adsStatus || '';
    const kind: 'Instagram' | 'Meta Ads' = igStatus ? 'Instagram' : 'Meta Ads';
    const msg      = params.get('ig_msg')   || params.get('ads_msg')   || null;
    const setupId  = params.get('ig_setup') || params.get('ads_setup') || null;

    onConsume({ status, kind, msg, setupId });

    // Strip OAuth bounce params; preserve any other query params the
    // page might be using. Replace history entry so back-button doesn't
    // resurrect the params.
    const next = new URLSearchParams(params);
    ['ig_status', 'ig_msg', 'ig_setup', 'ads_status', 'ads_msg', 'ads_setup'].forEach(k => next.delete(k));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
