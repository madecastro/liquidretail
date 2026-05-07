// Quick Campaign Builder modal.
//
// Three inputs: name, kind (brand-only vs product-driven), and — only
// when kind=product — optional product + media multi-select pickers.
// On submit fires POST /api/campaigns and redirects into the Generate
// Ads wizard, hand-off URL shaped by what the user picked:
//
//   kind=brand                        → /generate-ads?campaignId=X&step=settings
//   kind=product (no selections)      → /generate-ads?campaignId=X&step=products
//   kind=product + products selected  → /generate-ads?campaignId=X&step=products
//                                       (campaign carries matchedProductIds[])
//   kind=product + media selected     → /generate-ads?campaignId=X&mediaIds=...&step=products
//   kind=product + both selected      → /generate-ads?campaignId=X&mediaIds=...&step=products
//
// Media isn't persisted on the Campaign in V1 — we pass it via the
// wizard URL since that flow is per-launch. Matches existing
// MediaLibrary deep-link convention (?mediaIds=X,Y).

import { useEffect, useMemo, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, FormControl, FormLabel, Input, Button, ButtonGroup,
  HStack, VStack, Box, Text, Image, Spinner, Tag, TagLabel, TagCloseButton,
  Wrap, WrapItem, useToast, Card, CardBody, Divider
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

// Compact catalog row — only fields the picker renders.
type ProductOption = {
  id:        string;
  title:     string;
  brand:     string | null;
  price:     number | null;
  currency:  string | null;
  imageUrl:  string | null;
};

// Compact media row.
type MediaOption = {
  mediaId:    string;
  fileUrl:    string;
  fileType:   'image' | 'video';
  caption:    string | null;
  source:     string;
};

const PICKER_LIMIT = 30;

export function NewCampaignModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName]                 = useState('');
  const [kind, setKind]                 = useState<CampaignKind>('product');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedMediaIds, setSelectedMediaIds]     = useState<string[]>([]);
  const [submitting, setSubmitting]     = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setKind('product');
      setSelectedProductIds([]);
      setSelectedMediaIds([]);
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
          productIds: kind === 'product' ? selectedProductIds : []
        })
      });
      toast({
        title: 'Campaign created',
        description: `${res.campaign.name} — opening the ad generator.`,
        status: 'success',
        duration: 3000
      });

      // Hand-off to the wizard. Land at settings for brand-only
      // campaigns (nothing to pick at Step 2); land at products for
      // everything else so the operator can review pre-selection.
      const params = new URLSearchParams({
        campaignId: res.campaign.id,
        step:       kind === 'brand' ? 'settings' : 'products'
      });
      if (kind === 'product' && selectedMediaIds.length > 0) {
        params.set('mediaIds', selectedMediaIds.join(','));
      }
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
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" closeOnOverlayClick={!submitting}>
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
                  ? 'Promotes specific SKUs. Pick products and/or media below — adding either is enough; the renderer auto-resolves the missing side.'
                  : 'Awareness-style. The renderer uses brand-matched media; no SKU focus.'}
              </Text>
            </FormControl>

            {kind === 'product' && (
              <>
                <Divider />
                <ProductPicker
                  selectedIds={selectedProductIds}
                  onChange={setSelectedProductIds}
                  disabled={submitting}
                />
                <MediaPicker
                  selectedIds={selectedMediaIds}
                  onChange={setSelectedMediaIds}
                  disabled={submitting}
                />
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

// ── Product picker ────────────────────────────────────────────────

function ProductPicker({
  selectedIds, onChange, disabled
}: {
  selectedIds: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<{ products: ProductOption[] }>(`/api/catalog?limit=${PICKER_LIMIT}`);
        if (!cancelled) setProducts(res.products || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load catalog');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedRows = useMemo(
    () => (products || []).filter(p => selectedIds.includes(p.id)),
    [products, selectedIds]
  );

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Text fontSize="sm" fontWeight="700" color="brand.ink">
          Pre-select products <Text as="span" fontWeight="400" color="brand.muted">(optional)</Text>
        </Text>
        <Text fontSize="11px" color="brand.muted">{selectedIds.length} selected</Text>
      </HStack>

      {selectedRows.length > 0 && (
        <Wrap spacing={2} mb={3}>
          {selectedRows.map(p => (
            <WrapItem key={p.id}>
              <Tag size="md" variant="subtle" colorScheme="purple">
                <TagLabel>{p.title}</TagLabel>
                <TagCloseButton onClick={() => toggle(p.id)} isDisabled={disabled} />
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      )}

      <Input
        size="sm"
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        mb={3}
        isDisabled={disabled || !products}
      />

      {!products && !error && (
        <HStack py={6} justify="center">
          <Spinner size="sm" />
          <Text fontSize="sm" color="brand.muted">Loading catalog…</Text>
        </HStack>
      )}
      {error && (
        <Text fontSize="sm" color="red.600">{error}</Text>
      )}
      {products && products.length === 0 && (
        <Text fontSize="sm" color="brand.muted">No products in catalog yet.</Text>
      )}
      {products && filtered.length > 0 && (
        <Box maxH="220px" overflowY="auto" borderWidth="1px" borderColor="brand.border" borderRadius="md">
          {filtered.map(p => {
            const selected = selectedIds.includes(p.id);
            return (
              <HStack
                key={p.id}
                px={3} py={2}
                spacing={3}
                cursor={disabled ? 'default' : 'pointer'}
                bg={selected ? 'rsViolet.50' : 'transparent'}
                _hover={!disabled ? { bg: selected ? 'rsViolet.50' : 'gray.50' } : undefined}
                onClick={() => toggle(p.id)}
                borderBottomWidth="1px"
                borderBottomColor="brand.border"
              >
                <Box w="40px" h="40px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                  {p.imageUrl && <Image src={p.imageUrl} alt={p.title} w="100%" h="100%" objectFit="cover" />}
                </Box>
                <Box flex={1} minW={0}>
                  <Text fontSize="sm" fontWeight="600" color="brand.ink" noOfLines={1}>{p.title}</Text>
                  <Text fontSize="11px" color="brand.muted" noOfLines={1}>
                    {p.brand || '—'}{p.price != null ? ` · ${p.currency || ''}${p.price}` : ''}
                  </Text>
                </Box>
                {selected && <Text fontSize="xs" color="rsViolet.600" fontWeight="700">Selected</Text>}
              </HStack>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ── Media picker ──────────────────────────────────────────────────

function MediaPicker({
  selectedIds, onChange, disabled
}: {
  selectedIds: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const [media, setMedia] = useState<MediaOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<{ rows?: MediaOption[]; media?: MediaOption[] }>(`/api/media?limit=${PICKER_LIMIT}`);
        const rows = res.rows || res.media || [];
        if (!cancelled) setMedia(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load media');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Text fontSize="sm" fontWeight="700" color="brand.ink">
          Pre-select media <Text as="span" fontWeight="400" color="brand.muted">(optional)</Text>
        </Text>
        <Text fontSize="11px" color="brand.muted">{selectedIds.length} selected</Text>
      </HStack>

      {!media && !error && (
        <HStack py={6} justify="center">
          <Spinner size="sm" />
          <Text fontSize="sm" color="brand.muted">Loading media…</Text>
        </HStack>
      )}
      {error && (
        <Text fontSize="sm" color="red.600">{error}</Text>
      )}
      {media && media.length === 0 && (
        <Card variant="outline">
          <CardBody>
            <Text fontSize="sm" color="brand.muted">No media yet. Upload some on the Media Library page first.</Text>
          </CardBody>
        </Card>
      )}
      {media && media.length > 0 && (
        <Box
          display="grid"
          gridTemplateColumns="repeat(6, 1fr)"
          gap={2}
          maxH="240px"
          overflowY="auto"
          p={2}
          borderWidth="1px"
          borderColor="brand.border"
          borderRadius="md"
        >
          {media.map(m => {
            const selected = selectedIds.includes(m.mediaId);
            return (
              <Box
                key={m.mediaId}
                position="relative"
                role="button"
                aria-pressed={selected}
                onClick={() => toggle(m.mediaId)}
                cursor={disabled ? 'default' : 'pointer'}
                borderWidth="2px"
                borderColor={selected ? 'rsViolet.500' : 'transparent'}
                borderRadius="md"
                overflow="hidden"
                bg="gray.100"
                style={{ aspectRatio: '1 / 1' }}
              >
                {m.fileType === 'video'
                  ? (
                    <Box w="100%" h="100%" bg="gray.900" display="grid" placeItems="center" color="whiteAlpha.700" fontSize="10px">
                      VIDEO
                    </Box>
                  )
                  : <Image src={m.fileUrl} alt={m.caption || ''} w="100%" h="100%" objectFit="cover" />}
                {selected && (
                  <Box
                    position="absolute" top={1} right={1}
                    bg="rsViolet.500" color="white"
                    w="18px" h="18px" borderRadius="full"
                    display="grid" placeItems="center"
                    fontSize="11px" fontWeight="800"
                  >
                    ✓
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
