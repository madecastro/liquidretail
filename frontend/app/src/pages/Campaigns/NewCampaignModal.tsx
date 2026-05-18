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
  SimpleGrid, Divider, Image, Box
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type CampaignKind = 'brand' | 'product' | 'promotional';

type DiscountType = 'percent' | 'amount' | 'bogo' | 'bundle' | 'gift' | 'free_shipping' | 'raffle';

type PromotionalDetails = {
  discountType?:  DiscountType | '';
  discountValue?: number | null;
  discountCode?:  string;
  giveaway?:      string;
  startsAt?:      string;     // yyyy-mm-dd from <input type="date">
  endsAt?:        string;
  headline?:      string;
  notes?:         string;
  // Raffle / sweepstakes fields — populated only when discountType='raffle'.
  // entriesPerDollar is editable post-create from the CampaignDetail page;
  // prize media is picked at create time from the brand's Media library.
  raffleEntriesPerDollar?: number | null;
  rafflePrize?:            string;
  rafflePrizeMediaId?:     string | null;
  raffleDrawDate?:         string;     // yyyy-mm-dd; defaults to endsAt server-side if absent
};

// Lightweight summary of the selected prize media, kept in state so we
// can render a thumbnail next to the picker button without re-fetching.
type PrizePreview = {
  id:       string;
  fileType: 'image' | 'video';
  thumbUrl: string;
  label:    string | null;
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
  const [prizePreview, setPrizePreview] = useState<PrizePreview | null>(null);
  const [prizePickerOpen, setPrizePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setKind('product');
      setPromo({});
      setPrizePreview(null);
      setPrizePickerOpen(false);
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
    // Raffle fields — only included when discountType is 'raffle' so
    // a stale raffleEntriesPerDollar value doesn't tag along after the
    // operator flips back to percent/amount.
    if (promo.discountType === 'raffle') {
      if (promo.raffleEntriesPerDollar != null && !Number.isNaN(promo.raffleEntriesPerDollar)) {
        out.raffleEntriesPerDollar = promo.raffleEntriesPerDollar;
      }
      if (promo.rafflePrize?.trim())     out.rafflePrize        = promo.rafflePrize.trim();
      if (promo.rafflePrizeMediaId)      out.rafflePrizeMediaId = promo.rafflePrizeMediaId;
      if (promo.raffleDrawDate)          out.raffleDrawDate     = promo.raffleDrawDate;
    }
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
                      <option value="raffle">Raffle / Sweepstakes</option>
                    </Select>
                  </FormControl>
                  {promo.discountType === 'raffle' ? (
                    <FormControl>
                      <FormLabel fontSize="sm">Entries per dollar</FormLabel>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="5"
                        value={promo.raffleEntriesPerDollar ?? ''}
                        onChange={e => {
                          const n = e.target.value === '' ? null : Number(e.target.value);
                          setPromo(p => ({ ...p, raffleEntriesPerDollar: n }));
                        }}
                        isDisabled={submitting}
                      />
                      <FormHelperText fontSize="11px" color="brand.muted">
                        5 = 5 entries per $1. A purchase always earns at least 1 entry. Editable later from the campaign detail page.
                      </FormHelperText>
                    </FormControl>
                  ) : (
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
                  )}
                </SimpleGrid>

                {/* Raffle-specific block — only shows for sweepstakes
                    campaigns. Prize description + prize media picker
                    live here. Drawing date sits alongside endsAt below
                    (operators can also reuse endsAt as the draw date). */}
                {promo.discountType === 'raffle' && (
                  <>
                    <FormControl>
                      <FormLabel fontSize="sm">Prize</FormLabel>
                      <Input
                        value={promo.rafflePrize || ''}
                        onChange={e => setPromo(p => ({ ...p, rafflePrize: e.target.value }))}
                        placeholder="$500 Italian getaway"
                        isDisabled={submitting}
                      />
                      <FormHelperText fontSize="11px" color="brand.muted">
                        What's being raffled. The headline LLM frames the ad around this.
                      </FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Prize media</FormLabel>
                      <HStack spacing={3} align="center">
                        {prizePreview ? (
                          <HStack
                            bg="brand.surface"
                            borderWidth="1px"
                            borderColor="brand.border"
                            borderRadius="md"
                            p={1}
                            spacing={2}
                          >
                            <Image
                              src={prizePreview.thumbUrl}
                              alt={prizePreview.label || 'Prize'}
                              w="48px" h="48px" objectFit="cover" borderRadius="sm"
                            />
                            <Text fontSize="xs" color="brand.muted" noOfLines={1} maxW="200px">
                              {prizePreview.label || `Media ${prizePreview.id.slice(-6)}`}
                            </Text>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setPrizePreview(null);
                                setPromo(p => ({ ...p, rafflePrizeMediaId: null }));
                              }}
                              isDisabled={submitting}
                            >
                              ✕
                            </Button>
                          </HStack>
                        ) : (
                          <Text fontSize="xs" color="brand.muted">No prize media selected yet.</Text>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrizePickerOpen(true)}
                          isDisabled={submitting}
                        >
                          {prizePreview ? 'Change' : 'Pick from media library'}
                        </Button>
                      </HStack>
                      <FormHelperText fontSize="11px" color="brand.muted">
                        The prize visual — usually a reel/post/carousel the brand has on social. This becomes the hero of every raffle ad.
                      </FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Drawing date (optional)</FormLabel>
                      <Input
                        type="date"
                        value={promo.raffleDrawDate || ''}
                        onChange={e => setPromo(p => ({ ...p, raffleDrawDate: e.target.value }))}
                        isDisabled={submitting}
                      />
                      <FormHelperText fontSize="11px" color="brand.muted">
                        Defaults to the campaign end date if you leave this blank. Set separately when the campaign runs past the drawing.
                      </FormHelperText>
                    </FormControl>
                  </>
                )}

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

      <PrizeMediaPicker
        isOpen={prizePickerOpen}
        onClose={() => setPrizePickerOpen(false)}
        onSelect={(preview) => {
          setPrizePreview(preview);
          setPromo(p => ({ ...p, rafflePrizeMediaId: preview.id }));
          setPrizePickerOpen(false);
        }}
      />
    </Modal>
  );
}

// Prize media picker — small nested modal that browses the brand's
// Media library and returns a single selection. Filters to image +
// video media; excludes catalog-product (those are SKU shots, not
// brand stories).
type MediaLibRow = {
  id?:        string;
  mediaId?:   string;
  fileType:   'image' | 'video';
  fileUrl:    string;
  creatorHandle?:       string | null;
  primarySubjectLabel?: string | null;
};
function PrizeMediaPicker({ isOpen, onClose, onSelect }: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preview: PrizePreview) => void;
}) {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;
  const [rows, setRows]       = useState<MediaLibRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !brandId) return;
    let cancelled = false;
    setLoading(true);
    apiJson<{ media: MediaLibRow[] }>(`/api/media?brandId=${encodeURIComponent(brandId)}&limit=100`)
      .then(res => { if (!cancelled) setRows(res.media || []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, brandId]);

  function thumbFor(m: MediaLibRow): string {
    if (m.fileType === 'video' && m.fileUrl.includes('/video/upload/')) {
      return m.fileUrl
        .replace('/video/upload/', '/video/upload/so_0/')
        .replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, '.jpg$2');
    }
    return m.fileUrl;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Pick prize media</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? (
            <Text fontSize="sm" color="brand.muted" py={4} textAlign="center">Loading media…</Text>
          ) : rows.length === 0 ? (
            <Text fontSize="sm" color="brand.muted" py={4} textAlign="center">
              No media in this brand's library yet. Connect Instagram or upload manually first.
            </Text>
          ) : (
            <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} spacing={3}>
              {rows.map(m => {
                const id = m.mediaId || m.id || '';
                const label = m.primarySubjectLabel || m.creatorHandle || `Media ${id.slice(-6)}`;
                const thumb = thumbFor(m);
                return (
                  <Box
                    key={id}
                    as="button"
                    onClick={() => onSelect({ id, fileType: m.fileType, thumbUrl: thumb, label })}
                    borderWidth="2px"
                    borderColor="brand.border"
                    borderRadius="md"
                    overflow="hidden"
                    textAlign="left"
                    _hover={{ borderColor: 'rsViolet.400', transform: 'translateY(-1px)' }}
                    transition="all 120ms"
                  >
                    <Box w="100%" bg="gray.100" style={{ aspectRatio: '1 / 1' }}>
                      <Image src={thumb} alt={label} w="100%" h="100%" objectFit="cover" />
                    </Box>
                    <Box p={2}>
                      <Text fontSize="11px" fontWeight="700" color="brand.ink" noOfLines={1}>{label}</Text>
                      <Text fontSize="9px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">
                        {m.fileType}
                      </Text>
                    </Box>
                  </Box>
                );
              })}
            </SimpleGrid>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
