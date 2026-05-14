// Quick Campaign Builder modal.
//
// Three campaign kinds:
//   product     — promotes specific SKUs. Step 2 of the wizard collects
//                 products + media. Composition: existing match-outcome
//                 driven framing.
//   brand       — awareness-style. Step 2 skipped. Composition: headline
//                 anchors on Brand.tagline; LLM produces tone-aware
//                 variants matching Brand.tone[].
//   promotional — time-bound offer. Operator supplies offer details
//                 (discount, code, window, giveaway). Headline MUST
//                 surface the offer; urgency phrasing auto-injects
//                 when endsAt is within 7 days.
//
// Hand-off:
//   kind=brand        → /generate-ads?campaignId=X&step=settings
//   kind=product      → /generate-ads?campaignId=X&step=products
//   kind=promotional  → /generate-ads?campaignId=X&step=products
//                       (operator picks which products are on promo)

import { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, FormControl, FormLabel, FormHelperText, Input, Select,
  Textarea, Button, ButtonGroup, HStack, VStack, Text, useToast,
  SimpleGrid, Divider
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';

type CampaignKind = 'brand' | 'product' | 'promotional';

type DiscountType = 'percent' | 'amount' | 'bogo' | 'bundle' | 'gift' | 'free_shipping';

type PromotionalDetails = {
  discountType?:  DiscountType | '';
  discountValue?: number | null;
  discountCode?:  string;
  giveaway?:      string;
  startsAt?:      string;     // yyyy-mm-dd from <input type="date">
  endsAt?:        string;
  headline?:      string;
  notes?:         string;
};

type CreatedCampaign = {
  id:                  string;
  platform:            string;
  externalId:          string;
  name:                string;
  kind:                CampaignKind | null;
  matchedProductCount: number;
};

type CreateResponse = { campaign: CreatedCampaign };

const KIND_BLURBS: Record<CampaignKind, string> = {
  product:     'Promotes specific SKUs. The next step lets you pick products and/or media.',
  brand:       'Awareness-style. Headlines anchor on the brand tagline; tone-aware variants. No SKU focus.',
  promotional: 'Time-bound offer (sale, giveaway, launch). Headline surfaces the offer; urgency phrasing kicks in when the end date is near.'
};

export function NewCampaignModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CampaignKind>('product');
  const [promo, setPromo] = useState<PromotionalDetails>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setKind('product');
      setPromo({});
      setSubmitting(false);
    }
  }, [isOpen]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  // Build the promotionalDetails payload — strip empties so we don't
  // POST {discountValue: null, giveaway: ''}. Backend already coerces
  // ISO date strings to Dates; we just send the form values verbatim.
  function buildPromoPayload(): PromotionalDetails | null {
    if (kind !== 'promotional') return null;
    const out: PromotionalDetails = {};
    if (promo.discountType)  out.discountType  = promo.discountType;
    if (promo.discountValue != null && !Number.isNaN(promo.discountValue)) out.discountValue = promo.discountValue;
    if (promo.discountCode?.trim())  out.discountCode  = promo.discountCode.trim();
    if (promo.giveaway?.trim())      out.giveaway      = promo.giveaway.trim();
    if (promo.startsAt)              out.startsAt      = promo.startsAt;
    if (promo.endsAt)                out.endsAt        = promo.endsAt;
    if (promo.headline?.trim())      out.headline      = promo.headline.trim();
    if (promo.notes?.trim())         out.notes         = promo.notes.trim();
    return Object.keys(out).length ? out : null;
  }

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiJson<CreateResponse>('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:               trimmed,
          kind,
          productIds:         [],
          mediaIds:           [],
          promotionalDetails: buildPromoPayload()
        })
      });
      toast({
        title: 'Campaign created',
        description: `${res.campaign.name} — opening the ad generator.`,
        status: 'success',
        duration: 3000
      });

      // Hand-off to the wizard. Brand campaigns skip Step 2 (nothing
      // to pick at the product/media stage); product + promotional
      // campaigns land on Step 2 where the ribbon picker handles
      // selection.
      const params = new URLSearchParams({
        campaignId: res.campaign.id,
        step:       'products'
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg" closeOnOverlayClick={!submitting}>
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
                  isDisabled={submitting}
                >
                  Product
                </Button>
                <Button
                  flex={1}
                  onClick={() => setKind('brand')}
                  variant={kind === 'brand' ? 'softBrand' : 'outline'}
                  isDisabled={submitting}
                >
                  Brand
                </Button>
                <Button
                  flex={1}
                  onClick={() => setKind('promotional')}
                  variant={kind === 'promotional' ? 'softBrand' : 'outline'}
                  isDisabled={submitting}
                >
                  Promotional
                </Button>
              </ButtonGroup>
              <Text fontSize="11px" color="brand.muted" mt={2}>
                {KIND_BLURBS[kind]}
              </Text>
            </FormControl>

            {kind === 'promotional' && (
              <>
                <Divider />
                <Text fontSize="xs" fontWeight="700" color="brand.ink" textTransform="uppercase" letterSpacing="0.06em">
                  Promotional details
                </Text>

                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm">Offer type</FormLabel>
                    <Select
                      value={promo.discountType || ''}
                      onChange={e => setPromo(p => ({ ...p, discountType: e.target.value as DiscountType | '' }))}
                      isDisabled={submitting}
                    >
                      <option value="">—</option>
                      <option value="percent">Percent off</option>
                      <option value="amount">Dollar amount off</option>
                      <option value="bogo">Buy one get one</option>
                      <option value="bundle">Bundle savings</option>
                      <option value="gift">Free gift</option>
                      <option value="free_shipping">Free shipping</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Value</FormLabel>
                    <Input
                      type="number"
                      placeholder={promo.discountType === 'percent' ? '20' : promo.discountType === 'amount' ? '5' : ''}
                      value={promo.discountValue ?? ''}
                      onChange={e => {
                        const n = e.target.value === '' ? null : Number(e.target.value);
                        setPromo(p => ({ ...p, discountValue: n }));
                      }}
                      isDisabled={submitting || !promo.discountType || promo.discountType === 'bogo' || promo.discountType === 'bundle' || promo.discountType === 'gift' || promo.discountType === 'free_shipping'}
                    />
                    <FormHelperText fontSize="11px" color="brand.muted">
                      {promo.discountType === 'percent' ? '20 = 20% off' :
                       promo.discountType === 'amount'  ? '5 = $5 off' :
                       'Set a numeric value when offer type is percent or dollar amount.'}
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel fontSize="sm">Promo code (optional)</FormLabel>
                  <Input
                    value={promo.discountCode || ''}
                    onChange={e => setPromo(p => ({ ...p, discountCode: e.target.value }))}
                    placeholder="HOTOIL20"
                    isDisabled={submitting}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">Giveaway (optional)</FormLabel>
                  <Input
                    value={promo.giveaway || ''}
                    onChange={e => setPromo(p => ({ ...p, giveaway: e.target.value }))}
                    placeholder="Free spoon with $50+ orders"
                    isDisabled={submitting}
                  />
                </FormControl>

                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm">Starts</FormLabel>
                    <Input
                      type="date"
                      value={promo.startsAt || ''}
                      onChange={e => setPromo(p => ({ ...p, startsAt: e.target.value }))}
                      isDisabled={submitting}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Ends</FormLabel>
                    <Input
                      type="date"
                      value={promo.endsAt || ''}
                      onChange={e => setPromo(p => ({ ...p, endsAt: e.target.value }))}
                      isDisabled={submitting}
                    />
                    <FormHelperText fontSize="11px" color="brand.muted">
                      Urgency phrasing auto-injects when ≤ 7 days away.
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel fontSize="sm">Preferred headline (optional)</FormLabel>
                  <Input
                    value={promo.headline || ''}
                    onChange={e => setPromo(p => ({ ...p, headline: e.target.value }))}
                    placeholder='e.g. "Summer Sale: 20% Off Hot Crispy Oil"'
                    isDisabled={submitting}
                  />
                  <FormHelperText fontSize="11px" color="brand.muted">
                    LLM uses this as an anchor; varies tone + length to fit each slot.
                  </FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm">Notes for the LLM (optional)</FormLabel>
                  <Textarea
                    value={promo.notes || ''}
                    onChange={e => setPromo(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any extra context — e.g. 'first-time-buyer only', 'limit one per household', 'pairs with Free Spoon promo'."
                    isDisabled={submitting}
                    rows={2}
                  />
                </FormControl>
              </>
            )}
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
