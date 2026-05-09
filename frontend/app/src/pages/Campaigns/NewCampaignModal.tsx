// Quick Campaign Builder modal.
//
// Two inputs only: name + kind (brand-only vs product-driven). The
// product/media pickers that used to live here have been removed —
// the Generate Ads wizard's Step 2 already does that work via the
// ribbon picker, and having two picker UIs in a row was confusing.
//
// Hand-off:
//   kind=brand    → /generate-ads?campaignId=X&step=settings
//   kind=product  → /generate-ads?campaignId=X&step=products

import { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, FormControl, FormLabel, Input, Button, ButtonGroup,
  HStack, VStack, Text, useToast
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';

type CampaignKind = 'brand' | 'product';

type CreatedCampaign = {
  id:                  string;
  platform:            string;
  externalId:          string;
  name:                string;
  kind:                CampaignKind | null;
  matchedProductCount: number;
};

type CreateResponse = { campaign: CreatedCampaign };

export function NewCampaignModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName]             = useState('');
  const [kind, setKind]             = useState<CampaignKind>('product');
  const [submitting, setSubmitting] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setKind('product');
      setSubmitting(false);
    }
  }, [isOpen]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiJson<CreateResponse>('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       trimmed,
          kind,
          productIds: [],
          mediaIds:   []
        })
      });
      toast({
        title: 'Campaign created',
        description: `${res.campaign.name} — opening the ad generator.`,
        status: 'success',
        duration: 3000
      });

      // Hand-off to the wizard. Brand campaigns skip Step 2 (nothing
      // to pick at the product/media stage); product campaigns land
      // on Step 2 where the ribbon picker handles selection.
      const params = new URLSearchParams({
        campaignId: res.campaign.id,
        step:       kind === 'brand' ? 'settings' : 'products'
      });
      navigate(`/generate-ads?${params.toString()}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      toast({ title: 'Could not create campaign', description: msg, status: 'error', duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnOverlayClick={!submitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New campaign</ModalHeader>
        <ModalCloseButton isDisabled={submitting} />
        <ModalBody pb={0}>
          <VStack align="stretch" spacing={5}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Campaign name</FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer 2026 launch"
                autoFocus
                isDisabled={submitting}
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Type</FormLabel>
              <ButtonGroup isAttached variant="outline" w="100%">
                <Button
                  flex={1}
                  onClick={() => setKind('product')}
                  variant={kind === 'product' ? 'softBrand' : 'outline'}
                >
                  Product-driven
                </Button>
                <Button
                  flex={1}
                  onClick={() => setKind('brand')}
                  variant={kind === 'brand' ? 'softBrand' : 'outline'}
                >
                  Brand-only
                </Button>
              </ButtonGroup>
              <Text fontSize="11px" color="brand.muted" mt={2}>
                {kind === 'product'
                  ? 'Promotes specific SKUs. The next step lets you pick products and/or media.'
                  : 'Awareness-style. The renderer uses brand-matched media; no SKU focus.'}
              </Text>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button onClick={onClose} variant="outline" isDisabled={submitting}>Cancel</Button>
            <Button
              variant="brand"
              onClick={submit}
              isDisabled={!canSubmit}
              isLoading={submitting}
              loadingText="Creating…"
            >
              Create &amp; open generator
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
