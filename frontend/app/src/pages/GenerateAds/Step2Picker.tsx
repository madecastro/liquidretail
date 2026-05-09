// Step 2 — Pick products + media.
//
// Two horizontal ribbons (products, media). Operator can pick from
// either; the picker fetches "related" items from the other side
// and surfaces them in a sub-ribbon below the main one. This mirrors
// the seeder logic on the backend: a media seeds creatives via its
// matched products; a product seeds creatives via its matched media.
//
// Pre-fill sources:
//   - Wizard URL params (?productIds, ?mediaIds) — already absorbed
//     into wizard state
//   - Campaign pinned items — when a campaign is chosen in Step 1, the
//     campaign's pinnedProducts / pinnedMedia auto-select here
//
// The render-cap (MAX_CREATIVES_PER_RUN = 6 on the backend) is mirrored
// in the helper text so operators understand why selecting many items
// won't proportionally produce more ads.

import { useEffect, useMemo, useState } from 'react';
import { Box, VStack, HStack, Text, Badge, Button, Wrap, WrapItem } from '@chakra-ui/react';
import type { WizardSelections } from './index';
import { StepShell } from './index';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';
import { RibbonPicker, ProductTile, MediaTile } from './RibbonPicker';

type ProductRow = {
  id:        string;
  title:     string;
  imageUrl:  string | null;
  price?:    number | null;
  currency?: string | null;
  brand?:    string | null;
};

type MediaRow = {
  id:                  string;
  fileType:            'image' | 'video';
  fileUrl:             string;
  creatorHandle:       string | null;
  primarySubjectLabel: string | null;
};

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step2Picker({ value, onChange }: Props) {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;

  const [products, setProducts]         = useState<ProductRow[]>([]);
  const [media, setMedia]               = useState<MediaRow[]>([]);
  const [loadingP, setLoadingP]         = useState(false);
  const [loadingM, setLoadingM]         = useState(false);
  const [relatedMedia, setRelatedMedia] = useState<MediaRow[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<ProductRow[]>([]);

  // Load brand catalog + media list. Both endpoints support pagination,
  // but the picker shows a generous first page (50 items each) and
  // relies on the operator filtering via search later.
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    setLoadingP(true);
    apiJson<{ products: ProductRow[] }>(`/api/catalog?brandId=${encodeURIComponent(brandId)}&limit=50`)
      .then(res => { if (!cancelled) setProducts(res.products || []); })
      .finally(() => { if (!cancelled) setLoadingP(false); });
    setLoadingM(true);
    apiJson<{ media: MediaRow[] }>(`/api/media?brandId=${encodeURIComponent(brandId)}&limit=50`)
      .then(res => {
        if (cancelled) return;
        // The list endpoint exposes mediaId not id — normalize.
        const rows = (res.media || []).map(m => ({
          ...(m as MediaRow & { mediaId?: string }),
          id: (m as MediaRow & { mediaId?: string }).mediaId || (m as MediaRow).id
        }));
        setMedia(rows);
      })
      .finally(() => { if (!cancelled) setLoadingM(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  // Pre-fill from campaign pinned items the first time we have a
  // campaign selected. We don't overwrite operator picks — only fold
  // pinned items into existing selections.
  useEffect(() => {
    if (!value.campaignId) return;
    let cancelled = false;
    apiJson<{ pinnedProducts: { id: string }[]; pinnedMedia: { id: string }[] }>(
      `/api/campaigns/${value.campaignId}`
    )
      .then(res => {
        if (cancelled) return;
        const pinnedProductIds = (res.pinnedProducts || []).map(p => p.id);
        const pinnedMediaIds   = (res.pinnedMedia    || []).map(m => m.id);
        if (!pinnedProductIds.length && !pinnedMediaIds.length) return;
        onChange({
          productIds: Array.from(new Set([...value.productIds, ...pinnedProductIds])),
          mediaIds:   Array.from(new Set([...value.mediaIds,   ...pinnedMediaIds]))
        });
      })
      .catch(() => { /* non-blocking — pinned hydration is best-effort */ });
    return () => { cancelled = true; };
    // Run once per campaignId change. Adding value.* into deps would
    // re-fire on every selection — not what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.campaignId]);

  // Cross-direction lookups. When the operator selects one or more
  // media, fetch related products from each (deduped); same for
  // products → related media. Cap each related ribbon to ~12 to
  // keep it scannable.
  useEffect(() => {
    let cancelled = false;
    if (!value.mediaIds.length) { setRelatedProducts([]); return; }
    Promise.all(
      value.mediaIds.slice(0, 5).map(id =>
        apiJson<{ products: ProductRow[] }>(`/api/media/${id}/related-products`)
          .then(r => r.products || [])
          .catch(() => [])
      )
    ).then(lists => {
      if (cancelled) return;
      const seen = new Set(value.productIds.map(String));
      const flat: ProductRow[] = [];
      for (const list of lists) {
        for (const p of list) {
          if (!seen.has(p.id)) { seen.add(p.id); flat.push(p); }
        }
      }
      setRelatedProducts(flat.slice(0, 12));
    });
    return () => { cancelled = true; };
  }, [value.mediaIds, value.productIds]);

  useEffect(() => {
    let cancelled = false;
    if (!value.productIds.length) { setRelatedMedia([]); return; }
    Promise.all(
      value.productIds.slice(0, 5).map(id =>
        apiJson<{ matches: { mediaId: string; media: MediaRow }[] }>(`/api/catalog/${id}/matches`)
          .then(r => (r.matches || []).map(x => ({ ...x.media, id: x.mediaId })))
          .catch(() => [] as MediaRow[])
      )
    ).then(lists => {
      if (cancelled) return;
      const seen = new Set(value.mediaIds.map(String));
      const flat: MediaRow[] = [];
      for (const list of lists) {
        for (const m of list) {
          if (!seen.has(m.id)) { seen.add(m.id); flat.push(m); }
        }
      }
      setRelatedMedia(flat.slice(0, 12));
    });
    return () => { cancelled = true; };
  }, [value.productIds, value.mediaIds]);

  const productSet = useMemo(() => new Set(value.productIds), [value.productIds]);
  const mediaSet   = useMemo(() => new Set(value.mediaIds),   [value.mediaIds]);

  const toggleProduct = (id: string) => {
    onChange({
      productIds: productSet.has(id)
        ? value.productIds.filter(x => x !== id)
        : [...value.productIds, id]
    });
  };
  const toggleMedia = (id: string) => {
    onChange({
      mediaIds: mediaSet.has(id)
        ? value.mediaIds.filter(x => x !== id)
        : [...value.mediaIds, id]
    });
  };

  const totalSelected = value.productIds.length + value.mediaIds.length;

  return (
    <StepShell
      heading="Pick products + media"
      helper={`Each product or media seeds creatives. The render path caps at 6 ads per run, so 1–2 picks usually fills the batch. ${totalSelected > 0 ? `${totalSelected} selected.` : ''}`}
    >
      <VStack align="stretch" spacing={6}>
        {/* Selected items summary */}
        {totalSelected > 0 && (
          <Box>
            <Text fontSize="xs" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={2}>
              Selected ({totalSelected})
            </Text>
            <Wrap spacing={2}>
              {value.productIds.map(id => {
                const p = products.find(x => x.id === id);
                return (
                  <WrapItem key={`p-${id}`}>
                    <Badge
                      colorScheme="purple" variant="subtle" px={2} py={1} borderRadius="md"
                      cursor="pointer"
                      onClick={() => toggleProduct(id)}
                    >
                      Product · {p?.title || id.slice(-6)} ✕
                    </Badge>
                  </WrapItem>
                );
              })}
              {value.mediaIds.map(id => {
                const m = media.find(x => x.id === id);
                return (
                  <WrapItem key={`m-${id}`}>
                    <Badge
                      colorScheme="blue" variant="subtle" px={2} py={1} borderRadius="md"
                      cursor="pointer"
                      onClick={() => toggleMedia(id)}
                    >
                      Media · {m?.primarySubjectLabel || m?.creatorHandle || id.slice(-6)} ✕
                    </Badge>
                  </WrapItem>
                );
              })}
              <WrapItem>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onChange({ productIds: [], mediaIds: [] })}
                >
                  Clear all
                </Button>
              </WrapItem>
            </Wrap>
          </Box>
        )}

        {/* Products ribbon */}
        <SectionHeader title="Products" subtitle="Click to feature in generated ads" />
        <RibbonPicker
          items={products}
          getId={p => p.id}
          selectedIds={productSet}
          onToggle={toggleProduct}
          loading={loadingP}
          emptyHint="No products in this brand's catalog yet."
          render={(p, selected, onClick) => (
            <ProductTile product={p} selected={selected} onClick={onClick} />
          )}
        />

        {/* Related products from selected media */}
        {relatedProducts.length > 0 && (
          <Box>
            <SectionHeader
              title="Related products"
              subtitle="Surfaced from your selected media — click to add"
              tone="muted"
            />
            <RibbonPicker
              items={relatedProducts}
              getId={p => p.id}
              selectedIds={productSet}
              onToggle={toggleProduct}
              render={(p, selected, onClick) => (
                <ProductTile product={p} selected={selected} onClick={onClick} />
              )}
            />
          </Box>
        )}

        {/* Media ribbon */}
        <SectionHeader title="Media" subtitle="Click to feature creator content in ads" />
        <RibbonPicker
          items={media}
          getId={m => m.id}
          selectedIds={mediaSet}
          onToggle={toggleMedia}
          loading={loadingM}
          emptyHint="No media yet — connect Instagram or upload manually."
          render={(m, selected, onClick) => (
            <MediaTile media={m} selected={selected} onClick={onClick} />
          )}
        />

        {/* Related media from selected products */}
        {relatedMedia.length > 0 && (
          <Box>
            <SectionHeader
              title="Related media"
              subtitle="Surfaced from your selected products — click to add"
              tone="muted"
            />
            <RibbonPicker
              items={relatedMedia}
              getId={m => m.id}
              selectedIds={mediaSet}
              onToggle={toggleMedia}
              render={(m, selected, onClick) => (
                <MediaTile media={m} selected={selected} onClick={onClick} />
              )}
            />
          </Box>
        )}
      </VStack>
    </StepShell>
  );
}

function SectionHeader({ title, subtitle, tone }: { title: string; subtitle?: string; tone?: 'muted' }) {
  return (
    <HStack justify="space-between" align="baseline" mb={2} mt={tone === 'muted' ? 2 : 0}>
      <Box>
        <Text
          fontSize="xs" fontWeight="800"
          color={tone === 'muted' ? 'brand.muted' : 'brand.ink'}
          textTransform="uppercase" letterSpacing="0.06em"
        >
          {title}
        </Text>
        {subtitle && <Text fontSize="11px" color="brand.muted" mt={0.5}>{subtitle}</Text>}
      </Box>
    </HStack>
  );
}
