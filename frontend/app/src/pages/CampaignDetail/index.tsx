// Campaign detail / edit page.
//
// Three sections (Products / Media / Ads), each with row-level
// remove + an add-from-library modal. "Remove ad" maps to UNLINK
// (sets Ad.campaignId = null) per product call — the ad doc and
// Cloudinary asset stay intact, only the campaign association is
// dropped. Hard delete still lives on the /ads detail modal.
//
// Editable fields today: name. Kind is shown but not editable from
// here (would invalidate existing renders). Platform-synced
// campaigns (meta-ads / google-ads) render in read-only mode since
// edits would drift from the source of truth.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  VStack, HStack, Text, Heading, Button, Card, CardBody, Badge,
  Box, Image, Spinner, IconButton, Icon, useToast, Tabs, TabList, Tab,
  TabPanels, TabPanel, Editable, EditableInput, EditablePreview,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, useDisclosure, Input, SimpleGrid
} from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

// ── Types ─────────────────────────────────────────────────────────

type Campaign = {
  id:            string;
  platform:      string;
  externalId:    string;
  name:          string;
  status:        string | null;
  objective:     string | null;
  kind:          string | null;
  matchedProductIds?: string[];
  productSetIds?: string[];
};

type ProductRow = {
  id:          string;
  title:       string;
  brand:       string | null;
  price:       number | null;
  currency:    string | null;
  imageUrl:    string | null;
};

type MediaRow = {
  mediaId:    string;
  fileType:   'image' | 'video';
  fileUrl:    string;
  caption:    string | null;
  source:     string | null;
};

type AdRow = {
  id:          string;
  template:    string;
  aspectRatio: string;
  renderUrl:   string;
  status:      'draft' | 'live' | 'archived';
  copy:        { headline?: string; productName?: string; productPrice?: string; cta_text?: string };
  generatedAt: string;
};

const PICKER_LIMIT = 50;

// ── Page ──────────────────────────────────────────────────────────

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeBrand } = useBrand();
  const activeBrandId = activeBrand?.id || null;
  const toast = useToast();
  const navigate = useNavigate();

  const [campaign, setCampaign]   = useState<Campaign | null>(null);
  const [products, setProducts]   = useState<ProductRow[]>([]);
  const [media, setMedia]         = useState<MediaRow[]>([]);
  const [ads, setAds]             = useState<AdRow[]>([]);
  const [pinnedProductIds, setPinnedProductIds] = useState<string[]>([]);
  const [pinnedMediaIds, setPinnedMediaIds]     = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!id || !activeBrandId) return;
    setLoading(true);
    setError(null);
    try {
      // Campaign + linked products land via /api/campaigns/:id/products
      // (existing endpoint hydrates products + campaign meta in one trip).
      const [productsRes, mediaRes, adsRes, detailRes] = await Promise.all([
        apiJson<{ campaign: Campaign; products: ProductRow[] }>(`/api/campaigns/${id}/products`),
        apiJson<{ media: MediaRow[] }>(`/api/campaigns/${id}/media`),
        apiJson<{ ads: AdRow[] }>(`/api/ads?brandId=${encodeURIComponent(activeBrandId)}&campaignId=${encodeURIComponent(id)}&rendered=true&limit=200`),
        // Detail endpoint surfaces pinnedProducts + pinnedMedia (items
        // added to this campaign that aren't yet on any Ad). We only
        // need the ids — the hydrated rows already come back via the
        // /products + /media endpoints above.
        apiJson<{ pinnedProducts: { id: string }[]; pinnedMedia: { id: string }[] }>(`/api/campaigns/${id}`)
          .catch(() => ({ pinnedProducts: [], pinnedMedia: [] }))
      ]);
      setCampaign(productsRes.campaign);
      setProducts(productsRes.products || []);
      setMedia(mediaRes.media || []);
      setAds(adsRes.ads || []);
      setPinnedProductIds((detailRes.pinnedProducts || []).map(p => p.id));
      setPinnedMediaIds((detailRes.pinnedMedia    || []).map(m => m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id, activeBrandId]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  if (loading && !campaign) {
    return (
      <Card variant="outline">
        <CardBody>
          <HStack py={6} justify="center"><Spinner /><Text fontSize="sm" color="brand.muted">Loading campaign…</Text></HStack>
        </CardBody>
      </Card>
    );
  }

  if (error || !campaign) {
    return (
      <Card variant="outline">
        <CardBody>
          <Text color="red.600" fontSize="sm">{error || 'Campaign not found'}</Text>
          <Button as={RouterLink} to="/campaigns" size="sm" variant="outline" mt={3}>Back to campaigns</Button>
        </CardBody>
      </Card>
    );
  }

  const editable = campaign.platform === 'reach-social';

  const onRename = async (next: string) => {
    if (!editable || !id) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === campaign.name) return;
    try {
      await apiJson(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      setCampaign({ ...campaign, name: trimmed });
      toast({ title: 'Campaign renamed', status: 'success', duration: 2000 });
    } catch (e) {
      toast({ title: 'Rename failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    }
  };

  const launchWizard = (opts?: { onlyPinned?: boolean }) => {
    // Always land on Step 2 — even brand campaigns benefit from showing
    // pinned items in the picker. The Step 2 gate accepts brand campaigns
    // with no picks, so the operator can proceed straight through.
    const params = new URLSearchParams({
      campaignId: campaign.id,
      step:       'products'
    });
    // The picker auto-loads pinned items via /api/campaigns/:id, but
    // when the operator clicks "Generate from pinned only" we ALSO
    // pre-pop the wizard's mediaIds/productIds URL params so picks
    // fire immediately rather than waiting on the picker's hydration.
    if (opts?.onlyPinned) {
      if (pinnedProductIds.length) params.set('productIds', pinnedProductIds.join(','));
      if (pinnedMediaIds.length)   params.set('mediaIds',   pinnedMediaIds.join(','));
    }
    navigate(`/generate-ads?${params.toString()}`);
  };

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow={<RouterLink to="/campaigns" style={{ textDecoration: 'underline' }}>Campaigns</RouterLink> as unknown as string}
        title="Campaign detail"
        description="Review and curate the products, media, and rendered ads attached to this campaign."
      />

      <Card variant="outline">
        <CardBody>
          <HStack justify="space-between" align="flex-start" wrap="wrap" spacing={4}>
            <Box flex={1} minW={0}>
              <HStack spacing={2} mb={2} wrap="wrap">
                <Badge colorScheme="purple" variant="subtle">{platformLabel(campaign.platform)}</Badge>
                {campaign.kind && <Badge variant="outline">{campaign.kind}</Badge>}
                {campaign.status && <Badge colorScheme="green" variant="subtle">{campaign.status}</Badge>}
              </HStack>
              {editable ? (
                <Editable
                  defaultValue={campaign.name}
                  fontSize="2xl"
                  fontWeight="800"
                  color="brand.ink"
                  onSubmit={onRename}
                  submitOnBlur
                >
                  <EditablePreview />
                  <EditableInput />
                </Editable>
              ) : (
                <Heading size="lg" color="brand.ink">{campaign.name}</Heading>
              )}
              <Text fontSize="xs" color="brand.muted" mt={1}>{campaign.externalId}</Text>
            </Box>
            <Button variant="brand" onClick={() => launchWizard()}>Generate Ads</Button>
          </HStack>
        </CardBody>
      </Card>

      {(pinnedProductIds.length > 0 || pinnedMediaIds.length > 0) && (
        <Card variant="outline" bg="rsViolet.50" borderColor="rsViolet.200">
          <CardBody>
            <HStack justify="space-between" wrap="wrap" spacing={3}>
              <Box>
                <Text fontSize="xs" fontWeight="800" color="rsViolet.700" textTransform="uppercase" letterSpacing="0.06em">
                  Queued for ad generation
                </Text>
                <Text fontSize="sm" color="brand.ink" mt={1}>
                  {pinnedProductIds.length} product{pinnedProductIds.length === 1 ? '' : 's'} ·{' '}
                  {pinnedMediaIds.length} media — items added to this campaign that aren't on any rendered ad yet.
                </Text>
              </Box>
              <Button variant="brand" size="sm" onClick={() => launchWizard({ onlyPinned: true })}>
                Generate from pinned
              </Button>
            </HStack>
          </CardBody>
        </Card>
      )}

      <Tabs colorScheme="purple" variant="enclosed">
        <TabList>
          <Tab>Products ({products.length})</Tab>
          <Tab>Media ({media.length})</Tab>
          <Tab>Ads ({ads.length})</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <ProductsSection
              campaignId={campaign.id}
              products={products}
              editable={editable}
              onChanged={refreshAll}
            />
          </TabPanel>
          <TabPanel px={0}>
            <MediaSection
              campaignId={campaign.id}
              media={media}
              editable={editable}
              onChanged={refreshAll}
            />
          </TabPanel>
          <TabPanel px={0}>
            <AdsSection
              campaignId={campaign.id}
              ads={ads}
              editable={editable}
              onChanged={refreshAll}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </VStack>
  );
}

function platformLabel(platform: string): string {
  if (platform === 'meta-ads')   return 'Meta';
  if (platform === 'google-ads') return 'Google';
  if (platform === 'reach-social') return 'In-app';
  return platform;
}

// ── Products section ──────────────────────────────────────────────

function ProductsSection({
  campaignId, products, editable, onChanged
}: {
  campaignId: string; products: ProductRow[]; editable: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const addModal = useDisclosure();

  const remove = async (productId: string) => {
    try {
      await apiJson(`/api/campaigns/${campaignId}/products/${productId}`, { method: 'DELETE' });
      toast({ title: 'Product removed from campaign', status: 'success', duration: 2000 });
      await onChanged();
    } catch (e) {
      toast({ title: 'Remove failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    }
  };

  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between">
        <Text fontSize="sm" color="brand.muted">{products.length} product{products.length === 1 ? '' : 's'} attached</Text>
        {editable && <Button size="sm" variant="outline" onClick={addModal.onOpen}>+ Add products</Button>}
      </HStack>
      {products.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <Text fontSize="sm" color="brand.muted" textAlign="center" py={4}>
              No products attached yet. {editable && 'Click + Add products to attach from your catalog.'}
            </Text>
          </CardBody>
        </Card>
      ) : (
        <VStack align="stretch" spacing={2}>
          {products.map(p => (
            <Card key={p.id} variant="outline">
              <CardBody py={3}>
                <HStack spacing={3}>
                  <Box w="48px" h="48px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                    {p.imageUrl && <Image src={p.imageUrl} alt={p.title} w="100%" h="100%" objectFit="cover" />}
                  </Box>
                  <Box flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{p.title}</Text>
                    <Text fontSize="11px" color="brand.muted" noOfLines={1}>
                      {p.brand || '—'}{p.price != null ? ` · ${p.currency || ''}${p.price}` : ''}
                    </Text>
                  </Box>
                  {editable && (
                    <IconButton aria-label="Remove" size="xs" variant="ghost" colorScheme="red"
                      icon={<XIcon />}
                      onClick={() => remove(p.id)}
                    />
                  )}
                </HStack>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}
      <AddPickerModal
        isOpen={addModal.isOpen}
        onClose={addModal.onClose}
        title="Add products"
        endpoint={`/api/catalog?limit=${PICKER_LIMIT}`}
        existingIds={products.map(p => p.id)}
        renderRow={(row: ProductRow, selected, onToggle) => (
          <HStack
            key={row.id}
            px={3} py={2} spacing={3}
            cursor="pointer"
            bg={selected ? 'rsViolet.50' : 'transparent'}
            _hover={{ bg: selected ? 'rsViolet.50' : 'gray.50' }}
            onClick={onToggle}
            borderBottomWidth="1px" borderBottomColor="brand.border"
          >
            <Box w="40px" h="40px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
              {row.imageUrl && <Image src={row.imageUrl} alt={row.title} w="100%" h="100%" objectFit="cover" />}
            </Box>
            <Box flex={1} minW={0}>
              <Text fontSize="sm" fontWeight="600" color="brand.ink" noOfLines={1}>{row.title}</Text>
              <Text fontSize="11px" color="brand.muted" noOfLines={1}>
                {row.brand || '—'}{row.price != null ? ` · ${row.currency || ''}${row.price}` : ''}
              </Text>
            </Box>
            {selected && <Text fontSize="xs" color="rsViolet.600" fontWeight="700">Selected</Text>}
          </HStack>
        )}
        rowsKey="products"
        getId={(row: ProductRow) => row.id}
        searchKeys={(row: ProductRow) => [row.title, row.brand || ''].join(' ').toLowerCase()}
        onSubmit={async (selectedIds) => {
          await apiJson(`/api/campaigns/${campaignId}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: selectedIds })
          });
          await onChanged();
        }}
      />
    </VStack>
  );
}

// ── Media section ─────────────────────────────────────────────────

function MediaSection({
  campaignId, media, editable, onChanged
}: {
  campaignId: string; media: MediaRow[]; editable: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const addModal = useDisclosure();

  const remove = async (mediaId: string) => {
    try {
      await apiJson(`/api/campaigns/${campaignId}/media/${mediaId}`, { method: 'DELETE' });
      toast({ title: 'Media removed from campaign', status: 'success', duration: 2000 });
      await onChanged();
    } catch (e) {
      toast({ title: 'Remove failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    }
  };

  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between">
        <Text fontSize="sm" color="brand.muted">{media.length} media item{media.length === 1 ? '' : 's'} attached</Text>
        {editable && <Button size="sm" variant="outline" onClick={addModal.onOpen}>+ Add media</Button>}
      </HStack>
      {media.length === 0 ? (
        <Card variant="outline">
          <CardBody>
            <Text fontSize="sm" color="brand.muted" textAlign="center" py={4}>
              No media attached yet. {editable && 'Click + Add media to attach from your library.'}
            </Text>
          </CardBody>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 3, md: 6 }} spacing={3}>
          {media.map(m => (
            <Box key={m.mediaId} position="relative" borderRadius="md" overflow="hidden" bg="gray.100" style={{ aspectRatio: '1 / 1' }}>
              {m.fileType === 'video'
                ? <Box w="100%" h="100%" bg="gray.900" display="grid" placeItems="center" color="whiteAlpha.700" fontSize="xs">VIDEO</Box>
                : <Image src={m.fileUrl} alt={m.caption || ''} w="100%" h="100%" objectFit="cover" />}
              {editable && (
                <IconButton
                  aria-label="Remove"
                  position="absolute" top={1} right={1}
                  size="xs" colorScheme="red" variant="solid"
                  icon={<XIcon />}
                  onClick={() => remove(m.mediaId)}
                />
              )}
            </Box>
          ))}
        </SimpleGrid>
      )}
      <AddPickerModal
        isOpen={addModal.isOpen}
        onClose={addModal.onClose}
        title="Add media"
        endpoint={`/api/media?limit=${PICKER_LIMIT}`}
        existingIds={media.map(m => m.mediaId)}
        rowsKey="rows"
        getId={(row: MediaRow) => row.mediaId}
        searchKeys={(row: MediaRow) => (row.caption || '').toLowerCase()}
        renderRow={(row: MediaRow, selected, onToggle) => (
          <Box
            key={row.mediaId}
            position="relative"
            cursor="pointer"
            borderWidth="2px"
            borderColor={selected ? 'rsViolet.500' : 'transparent'}
            borderRadius="md"
            overflow="hidden"
            bg="gray.100"
            style={{ aspectRatio: '1 / 1' }}
            onClick={onToggle}
          >
            {row.fileType === 'video'
              ? <Box w="100%" h="100%" bg="gray.900" display="grid" placeItems="center" color="whiteAlpha.700" fontSize="10px">VIDEO</Box>
              : <Image src={row.fileUrl} alt={row.caption || ''} w="100%" h="100%" objectFit="cover" />}
            {selected && (
              <Box position="absolute" top={1} right={1} bg="rsViolet.500" color="white" w="18px" h="18px" borderRadius="full" display="grid" placeItems="center" fontSize="11px" fontWeight="800">✓</Box>
            )}
          </Box>
        )}
        layout="grid"
        onSubmit={async (selectedIds) => {
          await apiJson(`/api/campaigns/${campaignId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaIds: selectedIds })
          });
          await onChanged();
        }}
      />
    </VStack>
  );
}

// ── Ads section ──────────────────────────────────────────────────

function AdsSection({
  campaignId, ads, editable, onChanged
}: {
  campaignId: string; ads: AdRow[]; editable: boolean;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();

  const unlink = async (adId: string) => {
    const ok = window.confirm('Remove this ad from the campaign? The ad doc and Cloudinary asset stay; only the campaign link is dropped.');
    if (!ok) return;
    try {
      await apiJson(`/api/campaigns/${campaignId}/ads/${adId}`, { method: 'DELETE' });
      toast({ title: 'Ad unlinked from campaign', status: 'success', duration: 2000 });
      await onChanged();
    } catch (e) {
      toast({ title: 'Unlink failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    }
  };

  if (ads.length === 0) {
    return (
      <Card variant="outline">
        <CardBody>
          <Text fontSize="sm" color="brand.muted" textAlign="center" py={4}>
            No ads generated for this campaign yet. Click <b>Generate Ads</b> above to render some.
          </Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
      {ads.map(ad => (
        <Card key={ad.id} variant="outline">
          <Box position="relative" bg="gray.900" borderTopRadius="md" overflow="hidden" style={{ aspectRatio: '1 / 1' }}>
            <Image src={ad.renderUrl} alt={ad.copy.headline || ad.template} w="100%" h="100%" objectFit="contain" />
            <Badge
              position="absolute" top={2} right={2}
              colorScheme={ad.status === 'live' ? 'green' : ad.status === 'archived' ? 'gray' : 'orange'}
              fontSize="9px" textTransform="uppercase"
            >
              {ad.status}
            </Badge>
          </Box>
          <CardBody py={3}>
            <VStack align="stretch" spacing={1}>
              <HStack justify="space-between" spacing={2}>
                <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
                  {ad.template}
                </Text>
                <Text fontSize="9px" color="brand.muted">{ad.aspectRatio}</Text>
              </HStack>
              <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={2}>
                {ad.copy.headline || '—'}
              </Text>
              {editable && (
                <Button size="xs" variant="outline" colorScheme="red" onClick={() => unlink(ad.id)} mt={2}>
                  Remove from campaign
                </Button>
              )}
            </VStack>
          </CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
}

// ── Reusable add picker modal ─────────────────────────────────────

type AddPickerProps<TRow> = {
  isOpen:       boolean;
  onClose:      () => void;
  title:        string;
  endpoint:     string;
  rowsKey:      string;          // key in the response that holds the array
  existingIds:  string[];
  getId:        (row: TRow) => string;
  searchKeys:   (row: TRow) => string;
  renderRow:    (row: TRow, selected: boolean, onToggle: () => void) => React.ReactNode;
  onSubmit:     (selectedIds: string[]) => Promise<void>;
  layout?:      'list' | 'grid';
};

function AddPickerModal<TRow>(props: AddPickerProps<TRow>) {
  const { isOpen, onClose, title, endpoint, rowsKey, existingIds, getId, searchKeys, renderRow, onSubmit, layout = 'list' } = props;
  const toast = useToast();

  const [rows, setRows]         = useState<TRow[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRows(null);
      setError(null);
      setSearch('');
      setSelected([]);
      setSubmitting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<Record<string, unknown>>(endpoint);
        if (cancelled) return;
        const arr = (res?.[rowsKey] as TRow[]) || (res?.media as TRow[]) || [];
        setRows(arr);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, endpoint, rowsKey]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const existing = new Set(existingIds);
    const q = search.trim().toLowerCase();
    return rows.filter(r => !existing.has(getId(r)) && (!q || searchKeys(r).includes(q)));
  }, [rows, existingIds, search, getId, searchKeys]);

  const toggle = (rowId: string) => {
    setSelected(prev => prev.includes(rowId) ? prev.filter(x => x !== rowId) : [...prev, rowId]);
  };

  const submit = async () => {
    if (selected.length === 0) { onClose(); return; }
    setSubmitting(true);
    try {
      await onSubmit(selected);
      toast({ title: `Added ${selected.length} item${selected.length === 1 ? '' : 's'}`, status: 'success', duration: 2000 });
      onClose();
    } catch (e) {
      toast({ title: 'Add failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" closeOnOverlayClick={!submitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton isDisabled={submitting} />
        <ModalBody pb={0}>
          <Input
            size="sm"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            mb={3}
            isDisabled={submitting || !rows}
          />
          {!rows && !error && (
            <HStack py={6} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading…</Text></HStack>
          )}
          {error && <Text fontSize="sm" color="red.600">{error}</Text>}
          {rows && filtered.length === 0 && (
            <Text fontSize="sm" color="brand.muted" textAlign="center" py={6}>
              {rows.length === 0 ? 'No items yet.' : search ? 'No matches.' : 'Everything in this library is already attached.'}
            </Text>
          )}
          {rows && filtered.length > 0 && (
            layout === 'grid' ? (
              <SimpleGrid columns={5} spacing={2} maxH="320px" overflowY="auto" p={1}>
                {filtered.map(r => renderRow(r, selected.includes(getId(r)), () => toggle(getId(r))))}
              </SimpleGrid>
            ) : (
              <Box maxH="320px" overflowY="auto" borderWidth="1px" borderColor="brand.border" borderRadius="md">
                {filtered.map(r => renderRow(r, selected.includes(getId(r)), () => toggle(getId(r))))}
              </Box>
            )
          )}
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="outline" onClick={onClose} isDisabled={submitting}>Cancel</Button>
            <Button variant="brand" onClick={submit} isLoading={submitting} loadingText="Adding…" isDisabled={selected.length === 0}>
              Add {selected.length > 0 && `(${selected.length})`}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── Tiny X icon (avoid pulling in a heavier icon set) ────────────

function XIcon() {
  return (
    <Icon viewBox="0 0 24 24" boxSize={3.5}>
      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </Icon>
  );
}
