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
import type { MouseEvent } from 'react';
import { Box, VStack, HStack, Text, Button, Wrap, WrapItem, Image, Tooltip, Badge } from '@chakra-ui/react';
import type { WizardSelections } from './index';
import { StepShell } from './index';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';
import { RibbonPicker, ProductTile, MediaTile } from './RibbonPicker';

// Match-evidence fields the picker surfaces on related-ribbon tiles.
// Backed by /api/catalog/:id/matches, /api/media/:id/related-products,
// and /api/brand/:id/brand-matches — all three return matchTier +
// outcomeReasoning so the tooltip shows "why this match" alongside
// the score and provider winner.
type MatchTier = 'product_match' | 'product_category' | 'brand_match';
type MatchEvidence = {
  matchTier:        MatchTier | null;
  outcomeReasoning: string | null;
  winner:           string | null;
  matchSource:      string | null;
  catalogCombinedScore: number | null;
};

type ProductRow = {
  id:        string;
  title:     string;
  imageUrl:  string | null;
  price?:    number | null;
  currency?: string | null;
  brand?:    string | null;
  source?:        string | null;     // CatalogProduct.source — 'ig-catalog' | 'manual-upload' | 'detect-identified'
  lastSyncedAt?:  string | null;     // ISO
  // Catalog-side imagery refs. URLs are the raw source-CDN strings;
  // *MediaId fields point at the wrapped catalog-product Media docs.
  // Used by the brand-kind unified ribbon to render alt tiles and
  // wire (productId, altMediaId) exclusions.
  additionalImages?:        string[];
  imageMediaId?:            string | null;
  additionalImageMediaIds?: string[];
} & Partial<MatchEvidence> & {
  // Set on tiles surfaced from /api/media/:id/related-products. Used
  // as the "seed" when constructing the exclusion key for an X click.
  seedMediaId?: string;
};

type MediaRow = {
  id:                  string;
  fileType:            'image' | 'video';
  fileUrl:             string;
  creatorHandle:       string | null;
  primarySubjectLabel: string | null;
  postedAt?:           string | null;   // ISO; populated for IG posts surfaced via /api/catalog/:id/matches and /api/brand/:id/brand-matches
  source?:             string | null;   // Media.source — e.g. 'instagram', 'catalog-product'
} & Partial<MatchEvidence> & {
  seedProductId?: string | null;   // null for brand_match (no SKU)
  likes?:    number | null;
  comments?: number | null;
  saves?:    number | null;
};

// Pairing-key encoder. brand_match seeds use 'null' as the productId
// half so brand-wide exclusions don't collide with SKU-targeted ones.
function pairingKey(productId: string | null, mediaId: string): string {
  return `${productId || 'null'}|${mediaId}`;
}

// Catalog-imagery row shape — hero + alt URLs for a CatalogProduct.
// Shared between the picker and the brand-unified view, so declared
// at module scope rather than inside the component.
//
// imageMediaId is the catalog-product Media doc ID (when materialized
// by catalogProductDetectService); used to key (productId, altMediaId)
// exclusions so the operator can opt an alt out of the cartesian
// without dropping its product.
type CatalogImageRow = {
  productId:           string;
  productTitle:        string | null;
  productSource:       string | null;     // CatalogProduct.source — 'ig-catalog' | 'manual-upload' | 'detect-identified'
  productLastSyncedAt: string | null;     // ISO
  imageUrl:            string;
  imageMediaId:        string | null;
  role:                'hero' | 'alt';
  altIndex?:           number;
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

  // Hydrate any pre-selected ids that aren't in the first page. The
  // wizard arrives with productIds/mediaIds from URL params (Generate
  // Ads triggered from the Media Library or Catalog Browser) or from
  // campaign pinned items — those ids aren't guaranteed to be in the
  // most-recent-50 the picker loads by default. Use the ?ids= batch
  // hydration we just added on the backend to fetch them, then PREPEND
  // to the ribbon arrays so they're highlighted at the front.
  useEffect(() => {
    if (!brandId) return;
    const known = new Set(products.map(p => p.id));
    const missing = value.productIds.filter(id => !known.has(id));
    if (!missing.length) return;
    let cancelled = false;
    apiJson<{ products: ProductRow[] }>(`/api/catalog?brandId=${encodeURIComponent(brandId)}&ids=${missing.join(',')}`)
      .then(res => {
        if (cancelled || !res.products?.length) return;
        setProducts(prev => {
          const have = new Set(prev.map(p => p.id));
          return [...res.products.filter(p => !have.has(p.id)), ...prev];
        });
      })
      .catch(() => { /* best-effort hydration */ });
    return () => { cancelled = true; };
  }, [brandId, value.productIds, products]);

  useEffect(() => {
    if (!brandId) return;
    const known = new Set(media.map(m => m.id));
    const missing = value.mediaIds.filter(id => !known.has(id));
    if (!missing.length) return;
    let cancelled = false;
    apiJson<{ media: MediaRow[] }>(`/api/media?brandId=${encodeURIComponent(brandId)}&ids=${missing.join(',')}`)
      .then(res => {
        if (cancelled || !res.media?.length) return;
        const rows = (res.media || []).map(m => ({
          ...(m as MediaRow & { mediaId?: string }),
          id: (m as MediaRow & { mediaId?: string }).mediaId || (m as MediaRow).id
        }));
        setMedia(prev => {
          const have = new Set(prev.map(m => m.id));
          return [...rows.filter(m => !have.has(m.id)), ...prev];
        });
      })
      .catch(() => { /* best-effort hydration */ });
    return () => { cancelled = true; };
  }, [brandId, value.mediaIds, media]);

  // Pre-fill from campaign pinned items the first time we have a
  // campaign selected. We don't overwrite operator picks — only fold
  // pinned items into existing selections.
  useEffect(() => {
    if (!value.campaignId) return;
    let cancelled = false;
    apiJson<{
      campaign: { kind: string | null };
      pinnedProducts: { id: string }[];
      pinnedMedia: { id: string }[];
    }>(`/api/campaigns/${value.campaignId}`)
      .then(res => {
        if (cancelled) return;
        const pinnedProductIds = (res.pinnedProducts || []).map(p => p.id);
        const pinnedMediaIds   = (res.pinnedMedia    || []).map(m => m.id);
        const campaignKind     = res.campaign?.kind || null;
        // Stash kind so the wizard's Step 2 gate can let brand
        // campaigns proceed without picks. Always patch it (even
        // when null) so a campaign change resets the prior value.
        const patch: { campaignKind: string | null; productIds?: string[]; mediaIds?: string[] } = { campaignKind };
        if (pinnedProductIds.length) patch.productIds = Array.from(new Set([...value.productIds, ...pinnedProductIds]));
        if (pinnedMediaIds.length)   patch.mediaIds   = Array.from(new Set([...value.mediaIds,   ...pinnedMediaIds]));
        onChange(patch);
      })
      .catch(() => { /* non-blocking — pinned hydration is best-effort */ });
    return () => { cancelled = true; };
    // Run once per campaignId change. Adding value.* into deps would
    // re-fire on every selection — not what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.campaignId]);

  // Cross-direction lookups. When the operator selects one or more
  // media, fetch related products from each (deduped + tagged with
  // the seed mediaId so the X exclusion knows which pairing to drop);
  // same for products → related media. Cap each related ribbon to ~24
  // (was 12) so the per-tier groups don't all squeeze into one bucket.
  useEffect(() => {
    let cancelled = false;
    if (!value.mediaIds.length) { setRelatedProducts([]); return; }
    Promise.all(
      value.mediaIds.slice(0, 5).map(seedId =>
        apiJson<{ products: ProductRow[] }>(`/api/media/${seedId}/related-products`)
          .then(r => (r.products || []).map(p => ({ ...p, seedMediaId: seedId })))
          .catch(() => [] as ProductRow[])
      )
    ).then(lists => {
      if (cancelled) return;
      const seen = new Set(value.productIds.map(String));
      const flat: ProductRow[] = [];
      for (const list of lists) {
        for (const p of list) {
          // Dedupe by (seedMediaId, productId) so the same product
          // surfaced from two seed media still gets one tile per pair —
          // each pair is independently excludable.
          const key = `${p.seedMediaId}|${p.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          flat.push(p);
        }
      }
      setRelatedProducts(flat.slice(0, 24));
    });
    return () => { cancelled = true; };
  }, [value.mediaIds, value.productIds]);

  // Kind detectors + effective seed-product set. Declared here so the
  // relatedMedia useEffect below can fetch off the union (explicit
  // picks ∪ media-derived for brand-kind) rather than just
  // value.productIds.
  const isProductKind = value.campaignKind === 'product';
  const isBrandKind   = value.campaignKind === 'brand';
  const mediaDerivedProductIds = useMemo(() => {
    if (!isBrandKind) return [] as string[];
    return relatedProducts
      .filter(p => p.matchTier === 'product_match')
      .map(p => p.id);
  }, [isBrandKind, relatedProducts]);
  const expansionSeedProductIds = useMemo(() => {
    if (!isBrandKind) return value.productIds;
    return Array.from(new Set([...value.productIds, ...mediaDerivedProductIds]));
  }, [isBrandKind, value.productIds, mediaDerivedProductIds]);

  useEffect(() => {
    let cancelled = false;
    // Fetch on the effective seed-product set so the brand-kind
    // media-seed branch picks up matched posts for media-derived
    // products (not just explicit picks). Product-kind / other kinds
    // fall back to value.productIds via expansionSeedProductIds's
    // own derivation.
    if (!expansionSeedProductIds.length) { setRelatedMedia([]); return; }
    Promise.all(
      expansionSeedProductIds.slice(0, 5).map(seedId =>
        apiJson<{ matches: { mediaId: string; matchTier: MatchTier | null; outcomeReasoning: string | null; winner: string | null; matchSource: string | null; catalogCombinedScore: number | null; media: MediaRow }[] }>(`/api/catalog/${seedId}/matches?adEligible=1`)
          .then(r => (r.matches || []).map(x => ({
            ...x.media,
            id: x.mediaId,
            seedProductId:        seedId,
            matchTier:            x.matchTier,
            outcomeReasoning:     x.outcomeReasoning,
            winner:               x.winner,
            matchSource:          x.matchSource,
            catalogCombinedScore: x.catalogCombinedScore
          })))
          .catch(() => [] as MediaRow[])
      )
    ).then(lists => {
      if (cancelled) return;
      const seen = new Set(value.mediaIds.map(String));
      const flat: MediaRow[] = [];
      for (const list of lists) {
        for (const m of list) {
          // Dedupe by (seedProductId, mediaId) — same media surfaced
          // from two seed products gets one tile per pair so each is
          // independently excludable.
          const key = `${m.seedProductId}|${m.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          flat.push(m);
        }
      }
      setRelatedMedia(flat.slice(0, 24));
    });
    return () => { cancelled = true; };
  }, [expansionSeedProductIds, value.mediaIds]);

  // Promotional context — when the active campaign is promotional,
  // surface the operator-supplied offer details as a banner above the
  // picker so they stay oriented while choosing products/media. Lives
  // outside WizardSelections (read-only, doesn't ride into the
  // generate POST). Hydrated alongside the existing campaign fetch.
  type PromoContext = {
    kind:          string | null;
    discountType:  string | null;
    discountValue: number | null;
    discountCode:  string | null;
    rafflePrize:   string | null;
    raffleEntriesPerDollar: number | null;
    raffleDrawDate: string | null;
    endsAt:        string | null;
  };
  const [promoContext, setPromoContext] = useState<PromoContext | null>(null);
  useEffect(() => {
    if (!value.campaignId) { setPromoContext(null); return; }
    let cancelled = false;
    apiJson<{ campaign: { kind: string | null; promotionalDetails: Record<string, unknown> | null } }>(
      `/api/campaigns/${value.campaignId}`
    ).then(res => {
      if (cancelled) return;
      const c = res.campaign;
      if (c?.kind !== 'promotional' || !c?.promotionalDetails) {
        setPromoContext(null);
        return;
      }
      const p = c.promotionalDetails;
      setPromoContext({
        kind:          c.kind,
        discountType:  (p.discountType as string)  || null,
        discountValue: (p.discountValue as number) ?? null,
        discountCode:  (p.discountCode as string)  || null,
        rafflePrize:   (p.rafflePrize as string)   || null,
        raffleEntriesPerDollar: (p.raffleEntriesPerDollar as number) ?? null,
        raffleDrawDate: (p.raffleDrawDate as string) || null,
        endsAt:        (p.endsAt as string)        || null
      });
    }).catch(() => { if (!cancelled) setPromoContext(null); });
    return () => { cancelled = true; };
  }, [value.campaignId]);

  // Brand-wide brand_match posts. Always fetched (independent of which
  // products/media are picked) — these are the seeds that ride along
  // for any ad-generate run regardless of product selection. Operator
  // can individually exclude any of them via the X overlay.
  const [brandMatches, setBrandMatches] = useState<MediaRow[]>([]);
  useEffect(() => {
    if (!brandId) { setBrandMatches([]); return; }
    let cancelled = false;
    apiJson<{ matches: Array<{
      mediaId: string;
      matchTier: MatchTier;
      outcome: string | null;
      outcomeReasoning: string | null;
      winner: string | null;
      matchSource: string | null;
      confidence: number | null;
      media: { externalId: string; fileType: 'image' | 'video'; fileUrl: string; source: string; permalink: string | null; creatorHandle: string | null; postedAt: string | null; likes: number | null; comments: number | null; saves: number | null; adSuitability: number | null; createdAt: string };
    }> }>(`/api/brand/${encodeURIComponent(brandId)}/brand-matches?limit=24`)
      .then(r => {
        if (cancelled) return;
        const rows: MediaRow[] = (r.matches || []).map(x => ({
          id:                  x.mediaId,
          fileType:            x.media.fileType,
          fileUrl:             x.media.fileUrl,
          creatorHandle:       x.media.creatorHandle,
          primarySubjectLabel: null,
          postedAt:            x.media.postedAt,
          source:              x.media.source,
          seedProductId:       null,             // brand_match has no SKU seed
          matchTier:           x.matchTier,
          outcomeReasoning:    x.outcomeReasoning,
          winner:              x.winner,
          matchSource:         x.matchSource,
          catalogCombinedScore: x.confidence,
          likes:               x.media.likes,
          comments:            x.media.comments,
          saves:               x.media.saves
        }));
        setBrandMatches(rows);
      })
      .catch(() => { if (!cancelled) setBrandMatches([]); });
    return () => { cancelled = true; };
  }, [brandId]);

  // Catalog imagery for the effective seed products. Informational
  // rail — shows hero + alts that will fan out as product_image seeds
  // in the cartesian. Operator doesn't pick from these (every catalog
  // Media seeds automatically); the rail just makes the fanout visible.
  const [catalogImagery, setCatalogImagery] = useState<CatalogImageRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!expansionSeedProductIds.length) { setCatalogImagery([]); return; }
    Promise.all(
      expansionSeedProductIds.slice(0, 5).map(pid =>
        apiJson<{ product: {
          id: string;
          title: string | null;
          source: string | null;
          imageUrl: string | null;
          additionalImages: string[];
          imageMediaId: string | null;
          additionalImageMediaIds: string[];
          lastSyncedAt: string | null;
        } }>(`/api/catalog/${pid}`)
          .then(r => {
            const out: CatalogImageRow[] = [];
            const title = r.product?.title || null;
            const productSource = r.product?.source || null;
            const lastSyncedAt = r.product?.lastSyncedAt || null;
            const altIds = r.product?.additionalImageMediaIds || [];
            if (r.product?.imageUrl) {
              out.push({
                productId: pid,
                productTitle: title,
                productSource,
                productLastSyncedAt: lastSyncedAt,
                imageUrl: r.product.imageUrl,
                imageMediaId: r.product.imageMediaId || null,
                role: 'hero'
              });
            }
            (r.product?.additionalImages || []).forEach((url, i) => {
              if (url) out.push({
                productId: pid,
                productTitle: title,
                productSource,
                productLastSyncedAt: lastSyncedAt,
                imageUrl: url,
                imageMediaId: altIds[i] || null,
                role: 'alt',
                altIndex: i + 1
              });
            });
            return out;
          })
          .catch(() => [] as CatalogImageRow[])
      )
    ).then(lists => {
      if (cancelled) return;
      setCatalogImagery(lists.flat());
    });
    return () => { cancelled = true; };
  }, [expansionSeedProductIds]);

  const productSet = useMemo(() => new Set(value.productIds), [value.productIds]);
  const mediaSet   = useMemo(() => new Set(value.mediaIds),   [value.mediaIds]);
  const excludedSet = useMemo(() => new Set(value.excludedPairings), [value.excludedPairings]);

  // Tier-grouped related media for the expansion view. Filters the
  // single relatedMedia list by matchTier so each block can be shown
  // independently behind its expand button.
  const productMatchedRelated  = useMemo(() => relatedMedia.filter(m => m.matchTier === 'product_match'),    [relatedMedia]);
  const categoryMatchedRelated = useMemo(() => relatedMedia.filter(m => m.matchTier === 'product_category'), [relatedMedia]);

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
  // Toggle a (productId, mediaId) pairing in the exclusion set. Used
  // by the X overlay on every related-ribbon tile. Pure additive —
  // doesn't change picks, only what fans out from them.
  const toggleExclude = (productId: string | null, mediaId: string) => {
    const k = pairingKey(productId, mediaId);
    onChange({
      excludedPairings: excludedSet.has(k)
        ? value.excludedPairings.filter(x => x !== k)
        : [...value.excludedPairings, k]
    });
  };

  const totalSelected = value.productIds.length + value.mediaIds.length;
  const excludedCount = value.excludedPairings.length;

  return (
    <StepShell
      heading="Pick products + media"
      helper={`Each product or media seeds creatives. The render path caps at 6 ads per run, so 1–2 picks usually fills the batch. ${totalSelected > 0 ? `${totalSelected} selected.` : ''}`}
    >
      <VStack align="stretch" spacing={6}>
        {promoContext && <PromoContextBanner ctx={promoContext} />}

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
                    <SelectionChip
                      tone="purple"
                      kindLabel="Product"
                      label={p?.title || id.slice(-6)}
                      thumbSrc={p?.imageUrl || null}
                      onRemove={() => toggleProduct(id)}
                    />
                  </WrapItem>
                );
              })}
              {value.mediaIds.map(id => {
                const m = media.find(x => x.id === id);
                const thumbSrc = m
                  ? (m.fileType === 'video' && m.fileUrl.includes('/video/upload/')
                      ? m.fileUrl.replace('/video/upload/', '/video/upload/so_0/').replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, '.jpg$2')
                      : m.fileUrl)
                  : null;
                return (
                  <WrapItem key={`m-${id}`}>
                    <SelectionChip
                      tone="blue"
                      kindLabel="Media"
                      label={m?.primarySubjectLabel || m?.creatorHandle || id.slice(-6)}
                      thumbSrc={thumbSrc}
                      onRemove={() => toggleMedia(id)}
                    />
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

        {isBrandKind ? (
          // ── Brand-kind: collapsed two-ribbon layout ──
          <BrandUnifiedView
            products={products}
            media={media}
            productSet={productSet}
            mediaSet={mediaSet}
            excludedSet={excludedSet}
            toggleProduct={toggleProduct}
            toggleMedia={toggleMedia}
            toggleExclude={toggleExclude}
            relatedProducts={relatedProducts}
            productMatchedRelated={productMatchedRelated}
            categoryMatchedRelated={categoryMatchedRelated}
            brandMatches={brandMatches}
            catalogImagery={catalogImagery}
            loadingP={loadingP}
            loadingM={loadingM}
            includeCategoryMatched={value.includeCategoryMatched}
            includeBrandMatched={value.includeBrandMatched}
            onTierToggle={(field, next) => onChange({ [field]: next } as Partial<WizardSelections>)}
            anyPicks={value.productIds.length + value.mediaIds.length > 0}
          />
        ) : isProductKind ? (
          // ── Product-kind: hero ribbon + unified Media Related section ──
          <ProductKindView
            products={products}
            productSet={productSet}
            mediaSet={mediaSet}
            excludedSet={excludedSet}
            toggleProduct={toggleProduct}
            toggleMedia={toggleMedia}
            toggleExclude={toggleExclude}
            catalogImagery={catalogImagery}
            productMatchedRelated={productMatchedRelated}
            categoryMatchedRelated={categoryMatchedRelated}
            brandMatches={brandMatches}
            loadingP={loadingP}
            includeCategoryMatched={value.includeCategoryMatched}
            includeBrandMatched={value.includeBrandMatched}
            onTierToggle={(field, next) => onChange({ [field]: next } as Partial<WizardSelections>)}
            anyProductPicked={value.productIds.length > 0}
          />
        ) : (
          // ── Other kinds (promotional, unset): existing browse-everything layout ──
          <>
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

            {relatedProducts.length > 0 && (
              <RelatedTierBlocks
                heading="Products that will pair with your selected media"
                tiers={groupByTier(relatedProducts)}
                renderTile={(p, key) => {
                  const excluded = excludedSet.has(key);
                  return (
                    <ExcludeWrapper
                      excluded={excluded}
                      onExclude={() => toggleExclude(p.id, p.seedMediaId || '')}
                      reason={p.outcomeReasoning}
                      score={p.catalogCombinedScore}
                      winner={p.winner}
                      source={p.matchSource}
                    >
                      <ProductTile product={p} selected={productSet.has(p.id)} onClick={() => toggleProduct(p.id)} />
                    </ExcludeWrapper>
                  );
                }}
                keyFor={(p) => pairingKey(p.id, p.seedMediaId || '')}
              />
            )}

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

            {relatedMedia.length > 0 && (
              <RelatedTierBlocks
                heading="Posts that will pair with your selected products"
                tiers={groupByTier(relatedMedia)}
                renderTile={(m, key) => {
                  const excluded = excludedSet.has(key);
                  return (
                    <ExcludeWrapper
                      excluded={excluded}
                      onExclude={() => toggleExclude(m.seedProductId || null, m.id)}
                      reason={m.outcomeReasoning}
                      score={m.catalogCombinedScore}
                      winner={m.winner}
                      source={m.matchSource}
                      stats={{ likes: m.likes ?? null, comments: m.comments ?? null, saves: m.saves ?? null }}
                    >
                      <MediaTile media={m} selected={mediaSet.has(m.id)} onClick={() => toggleMedia(m.id)} />
                    </ExcludeWrapper>
                  );
                }}
                keyFor={(m) => pairingKey(m.seedProductId || null, m.id)}
              />
            )}

            {brandMatches.length > 0 && (
              <Box>
                <SectionHeader
                  title="Brand-only posts"
                  subtitle={`Posts matched to the brand without identifying a specific product. These ride along on every run unless excluded. (${brandMatches.length})`}
                  tone="muted"
                />
                <RibbonPicker
                  items={brandMatches}
                  getId={m => m.id}
                  selectedIds={mediaSet}
                  onToggle={toggleMedia}
                  render={(m) => {
                    const key = pairingKey(null, m.id);
                    const excluded = excludedSet.has(key);
                    return (
                      <ExcludeWrapper
                        excluded={excluded}
                        onExclude={() => toggleExclude(null, m.id)}
                        reason={m.outcomeReasoning}
                        score={m.catalogCombinedScore}
                        winner={m.winner}
                        source={m.matchSource}
                        stats={{ likes: m.likes ?? null, comments: m.comments ?? null, saves: m.saves ?? null }}
                      >
                        <MediaTile media={m} selected={mediaSet.has(m.id)} onClick={() => toggleMedia(m.id)} />
                      </ExcludeWrapper>
                    );
                  }}
                />
              </Box>
            )}
          </>
        )}

        {excludedCount > 0 && (
          <HStack pt={1}>
            <Badge colorScheme="orange" variant="subtle" fontSize="10px">
              {excludedCount} pairing{excludedCount === 1 ? '' : 's'} excluded
            </Badge>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onChange({ excludedPairings: [] })}
            >
              Clear exclusions
            </Button>
          </HStack>
        )}
      </VStack>
    </StepShell>
  );
}

// Group a related-ribbon row list by matchTier. Renders one ribbon per
// non-empty tier with a tier-specific subtitle. Tier 1/2 are derived
// from the per-pick endpoints; brand_match rides along in its own
// section above (not multiplexed here).
const TIER_LABELS: Record<MatchTier, { title: string; subtitle: string }> = {
  product_match:    { title: 'Product match',  subtitle: 'Specific SKU identified in the matched item.' },
  product_category: { title: 'Category match', subtitle: 'Same category, different SKU — broader pairing.' },
  brand_match:      { title: 'Brand match',    subtitle: 'Brand-fit only; no specific product identified.' }
};

function groupByTier<T extends { matchTier?: MatchTier | null }>(rows: T[]): Array<{ tier: MatchTier; items: T[] }> {
  const order: MatchTier[] = ['product_match', 'product_category', 'brand_match'];
  const buckets = new Map<MatchTier, T[]>();
  for (const r of rows) {
    const t = (r.matchTier as MatchTier) || 'product_category';
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t)!.push(r);
  }
  return order.filter(t => buckets.has(t)).map(t => ({ tier: t, items: buckets.get(t)! }));
}

function RelatedTierBlocks<T>({
  heading, tiers, renderTile, keyFor
}: {
  heading: string;
  tiers: Array<{ tier: MatchTier; items: T[] }>;
  renderTile: (item: T, key: string) => React.ReactNode;
  keyFor: (item: T) => string;
}) {
  return (
    <Box>
      <SectionHeader title={heading} subtitle="Click ✕ on any tile to remove that pairing from this run." tone="muted" />
      <VStack align="stretch" spacing={4}>
        {tiers.map(({ tier, items }) => (
          <Box key={tier}>
            <HStack mb={1.5}>
              <Badge fontSize="9px" colorScheme={tier === 'product_match' ? 'green' : tier === 'product_category' ? 'purple' : 'blue'}>
                {TIER_LABELS[tier].title}
              </Badge>
              <Text fontSize="11px" color="brand.muted">{TIER_LABELS[tier].subtitle}</Text>
              <Text fontSize="11px" color="brand.muted" fontWeight="700">· {items.length}</Text>
            </HStack>
            <Box overflowX="auto" overflowY="hidden" pb={2}>
              <HStack spacing={3} align="stretch" minW="min-content">
                {items.map(it => (
                  <Box key={keyFor(it)} flexShrink={0}>{renderTile(it, keyFor(it))}</Box>
                ))}
              </HStack>
            </Box>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

// Wraps any tile with an exclusion overlay (X) + a hover tooltip
// surfacing the match reason / score / provider winner. When excluded,
// dims the tile and changes the X to a "↺" restore action.
function ExcludeWrapper({
  excluded, onExclude, reason, score, winner, source, stats, children
}: {
  excluded: boolean;
  onExclude: () => void;
  reason: string | null | undefined;
  score: number | null | undefined;
  winner: string | null | undefined;
  source: string | null | undefined;
  stats?: { likes: number | null; comments: number | null; saves: number | null };
  children: React.ReactNode;
}) {
  const tipLines: string[] = [];
  if (reason)  tipLines.push(reason);
  if (score != null) tipLines.push(`score: ${(score * 100).toFixed(0)}%`);
  if (winner) tipLines.push(`via: ${winner}${source ? ` @ ${source}` : ''}`);
  if (stats && (stats.likes != null || stats.comments != null || stats.saves != null)) {
    const parts = [];
    if (stats.likes    != null) parts.push(`${stats.likes} likes`);
    if (stats.comments != null) parts.push(`${stats.comments} comments`);
    if (stats.saves    != null) parts.push(`${stats.saves} saves`);
    tipLines.push(parts.join(' · '));
  }
  const tip = tipLines.join('\n') || 'No match evidence stored.';
  return (
    <Tooltip label={tip} hasArrow placement="top" whiteSpace="pre-line" openDelay={200}>
      <Box position="relative" opacity={excluded ? 0.4 : 1} transition="opacity 120ms">
        {children}
        <Box
          as="button"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onExclude(); }}
          position="absolute"
          top={1.5}
          left={1.5}
          w="22px" h="22px"
          borderRadius="full"
          bg={excluded ? 'gray.700' : 'red.500'}
          color="white"
          fontSize="11px"
          fontWeight="800"
          display="flex" alignItems="center" justifyContent="center"
          boxShadow="md"
          _hover={{ transform: 'scale(1.1)' }}
          aria-label={excluded ? 'Restore pairing' : 'Exclude pairing from this run'}
        >
          {excluded ? '↺' : '✕'}
        </Box>
      </Box>
    </Tooltip>
  );
}

function SelectionChip({
  tone, kindLabel, label, thumbSrc, onRemove
}: {
  tone: 'purple' | 'blue';
  kindLabel: string;
  label: string;
  thumbSrc: string | null;
  onRemove: () => void;
}) {
  const bg = tone === 'purple' ? 'rsViolet.50' : 'blue.50';
  const fg = tone === 'purple' ? 'rsViolet.700' : 'blue.700';
  const border = tone === 'purple' ? 'rsViolet.200' : 'blue.200';
  return (
    <HStack
      bg={bg}
      borderWidth="1px"
      borderColor={border}
      borderRadius="md"
      pl={thumbSrc ? 0 : 2}
      pr={2}
      py={thumbSrc ? 0 : 1}
      spacing={2}
      cursor="pointer"
      onClick={onRemove}
      role="button"
      _hover={{ borderColor: tone === 'purple' ? 'rsViolet.400' : 'blue.400' }}
    >
      {thumbSrc && (
        <Image
          src={thumbSrc}
          alt={label}
          w="28px" h="28px"
          objectFit="cover"
          borderLeftRadius="md"
          flexShrink={0}
        />
      )}
      <Text fontSize="xs" color={fg} fontWeight="700" noOfLines={1} maxW="180px">
        {kindLabel} · {label}
      </Text>
      <Text fontSize="xs" color={fg} fontWeight="800" pl={1}>✕</Text>
    </HStack>
  );
}

// Promotional context banner — appears at the top of Step 2 when the
// active campaign is promotional. Keeps the operator oriented while
// picking products/media: shows offer label, promo code, prize (for
// raffle), entries rate, and a countdown when the offer/draw ends
// within the next 14 days.
type PromoContextBannerProps = {
  ctx: {
    discountType:  string | null;
    discountValue: number | null;
    discountCode:  string | null;
    rafflePrize:   string | null;
    raffleEntriesPerDollar: number | null;
    raffleDrawDate: string | null;
    endsAt:        string | null;
  };
};
function PromoContextBanner({ ctx }: PromoContextBannerProps) {
  const isRaffle = ctx.discountType === 'raffle';
  const offerLabel = isRaffle ? 'Raffle / Sweepstakes'
    : ctx.discountType === 'percent'       ? `${ctx.discountValue ?? '—'}% off`
    : ctx.discountType === 'amount'        ? `$${ctx.discountValue ?? '—'} off`
    : ctx.discountType === 'bogo'          ? 'Buy one, get one'
    : ctx.discountType === 'bundle'        ? 'Bundle savings'
    : ctx.discountType === 'gift'          ? 'Free gift'
    : ctx.discountType === 'free_shipping' ? 'Free shipping'
    : 'Promotional';

  const drawOrEnd = (isRaffle ? ctx.raffleDrawDate : null) || ctx.endsAt || null;
  const daysLeft  = drawOrEnd
    ? Math.ceil((new Date(drawOrEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const countdownLabel = isRaffle ? 'Drawing' : 'Ends';
  const urgency = daysLeft != null && Number.isFinite(daysLeft) && daysLeft > 0 && daysLeft <= 14;

  return (
    <Box
      bg="orange.50"
      borderWidth="1px"
      borderColor="orange.200"
      borderRadius="md"
      px={4} py={3}
    >
      <HStack spacing={3} wrap="wrap">
        <Badge colorScheme="orange" variant="solid" fontSize="10px">{offerLabel}</Badge>
        {isRaffle && ctx.rafflePrize && (
          <Text fontSize="sm" color="brand.ink" fontWeight="700">Win: {ctx.rafflePrize}</Text>
        )}
        {isRaffle && ctx.raffleEntriesPerDollar != null && (
          <Text fontSize="sm" color="brand.muted">
            {ctx.raffleEntriesPerDollar} entr{ctx.raffleEntriesPerDollar === 1 ? 'y' : 'ies'} / $1
          </Text>
        )}
        {ctx.discountCode && (
          <HStack spacing={1}>
            <Text fontSize="11px" color="brand.muted">Code:</Text>
            <Text fontSize="11px" fontWeight="700" color="brand.ink" fontFamily="mono">
              {ctx.discountCode}
            </Text>
          </HStack>
        )}
        {urgency && daysLeft != null && (
          <Badge colorScheme="red" variant="subtle" fontSize="10px">
            {countdownLabel} in {daysLeft} day{daysLeft === 1 ? '' : 's'}
          </Badge>
        )}
        {drawOrEnd && !urgency && (
          <Text fontSize="11px" color="brand.muted">
            {countdownLabel}: {new Date(drawOrEnd).toISOString().slice(0, 10)}
          </Text>
        )}
      </HStack>
      <Text fontSize="11px" color="brand.muted" mt={1.5}>
        {isRaffle
          ? 'Headlines anchor on the prize; product becomes the entry mechanic (per-purchase entry counter rides on the product card).'
          : 'Headlines surface the offer. Pick products that fit the offer narrative.'}
      </Text>
    </Box>
  );
}

// ── Product-kind view ───────────────────────────────────────────────
// "Media" ribbon shows only product hero tiles (one per product). After
// any product is picked, a single "Media Related To Your Selection"
// section surfaces every related media — alt catalog images + matched
// UGC posts (dedup'd by mediaId). Each related tile carries a metadata
// strip beneath: "IG catalog · {title} · {updatedAt}" for catalog alts,
// "IG Post · {handle} · {postedAt}" for UGC. Tier expand buttons widen
// what's pulled into the related list.

type ProductRelatedTile =
  | { kind: 'catalog_alt'; img: CatalogImageRow }
  | { kind: 'ugc'; media: MediaRow };

type ProductKindViewProps = {
  products:               ProductRow[];
  productSet:             Set<string>;
  mediaSet:               Set<string>;
  excludedSet:            Set<string>;
  toggleProduct:          (id: string) => void;
  toggleMedia:            (id: string) => void;
  toggleExclude:          (productId: string | null, mediaId: string) => void;
  catalogImagery:         CatalogImageRow[];
  productMatchedRelated:  MediaRow[];
  categoryMatchedRelated: MediaRow[];
  brandMatches:           MediaRow[];
  loadingP:               boolean;
  includeCategoryMatched: boolean;
  includeBrandMatched:    boolean;
  onTierToggle:           (field: 'includeCategoryMatched' | 'includeBrandMatched', next: boolean) => void;
  anyProductPicked:       boolean;
};

function ProductKindView(props: ProductKindViewProps) {
  const {
    products, productSet, mediaSet, excludedSet,
    toggleProduct, toggleMedia, toggleExclude,
    catalogImagery, productMatchedRelated, categoryMatchedRelated, brandMatches,
    loadingP, includeCategoryMatched, includeBrandMatched, onTierToggle, anyProductPicked
  } = props;

  // Build the unified related-tile list. Dedup is by mediaId across
  // catalog alts and UGC posts. Catalog alts seed first (auto-fanout
  // for picked products), then product_match UGC, then optional
  // category/brand tiers behind the expand toggles.
  const relatedTiles: ProductRelatedTile[] = [];
  const seenMediaIds = new Set<string>();

  for (const img of catalogImagery) {
    if (img.role === 'hero') continue;
    const key = img.imageMediaId || `alt-${img.productId}-${img.altIndex}`;
    if (seenMediaIds.has(key)) continue;
    seenMediaIds.add(key);
    relatedTiles.push({ kind: 'catalog_alt', img });
  }
  for (const m of productMatchedRelated) {
    if (seenMediaIds.has(m.id)) continue;
    seenMediaIds.add(m.id);
    relatedTiles.push({ kind: 'ugc', media: m });
  }
  if (includeCategoryMatched) {
    for (const m of categoryMatchedRelated) {
      if (seenMediaIds.has(m.id)) continue;
      seenMediaIds.add(m.id);
      relatedTiles.push({ kind: 'ugc', media: m });
    }
  }
  if (includeBrandMatched) {
    for (const m of brandMatches) {
      if (seenMediaIds.has(m.id)) continue;
      seenMediaIds.add(m.id);
      relatedTiles.push({ kind: 'ugc', media: m });
    }
  }

  return (
    <>
      <SectionHeader
        title="Media"
        subtitle="Pick a product hero. Catalog alts and matched UGC posts fan out automatically."
      />
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

      {anyProductPicked && (
        <>
          <SectionHeader
            title={`Media Related To Your Selection (${relatedTiles.length})`}
            subtitle="All media related to the product(s) selected."
            tone="muted"
          />
          {relatedTiles.length === 0 ? (
            <Box h="100px" bg="gray.50" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="xs" color="brand.muted">
                No related media yet — try the tier expand buttons below.
              </Text>
            </Box>
          ) : (
            <Box
              overflowX="auto"
              overflowY="hidden"
              pb={2}
              sx={{
                '&::-webkit-scrollbar':       { height: '8px' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.18)', borderRadius: '4px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' }
              }}
            >
              <HStack spacing={3} align="stretch" minW="min-content">
                {relatedTiles.map((t, idx) => (
                  <Box key={`pr-${idx}`} flexShrink={0}>
                    {t.kind === 'catalog_alt'
                      ? <ProductRelatedAltTile
                          img={t.img}
                          excludedSet={excludedSet}
                          toggleExclude={toggleExclude}
                        />
                      : <ProductRelatedUgcTile
                          media={t.media}
                          selected={mediaSet.has(t.media.id)}
                          onToggle={() => toggleMedia(t.media.id)}
                        />
                    }
                  </Box>
                ))}
              </HStack>
            </Box>
          )}

          <HStack spacing={3} pt={1} wrap="wrap">
            <Button
              size="xs"
              variant={includeCategoryMatched ? 'softBrand' : 'outline'}
              onClick={() => onTierToggle('includeCategoryMatched', !includeCategoryMatched)}
              isDisabled={categoryMatchedRelated.length === 0 && !includeCategoryMatched}
            >
              {includeCategoryMatched ? '✓ ' : '+ '}
              Include category-matched posts ({categoryMatchedRelated.length})
            </Button>
            <Button
              size="xs"
              variant={includeBrandMatched ? 'softBrand' : 'outline'}
              onClick={() => onTierToggle('includeBrandMatched', !includeBrandMatched)}
              isDisabled={brandMatches.length === 0 && !includeBrandMatched}
            >
              {includeBrandMatched ? '✓ ' : '+ '}
              Include brand-matched posts ({brandMatches.length})
            </Button>
          </HStack>
        </>
      )}
    </>
  );
}

// Catalog-alt tile in the product-kind related ribbon. Mirrors the
// brand-kind auto-fanout / opt-out semantics: default selected
// (purple border + AUTO badge), click toggles a (productId,
// altMediaId) entry in excludedPairings. Beneath the image, a
// metadata strip displays "IG catalog · {title} · {updatedAt}".
function ProductRelatedAltTile({
  img, excludedSet, toggleExclude
}: {
  img: CatalogImageRow;
  excludedSet: Set<string>;
  toggleExclude: (productId: string | null, mediaId: string) => void;
}) {
  const altKey = img.imageMediaId ? pairingKey(img.productId, img.imageMediaId) : null;
  const excluded = altKey ? excludedSet.has(altKey) : false;
  const clickable = !!img.imageMediaId;
  return (
    <Box w="160px">
      <Box
        as={clickable ? 'button' : 'div'}
        onClick={clickable ? () => toggleExclude(img.productId, img.imageMediaId!) : undefined}
        position="relative"
        w="160px" h="160px"
        borderRadius="md"
        overflow="hidden"
        bg="gray.100"
        borderWidth="2px"
        borderColor={excluded ? 'brand.border' : 'rsViolet.400'}
        opacity={excluded ? 0.45 : 1}
        cursor={clickable ? 'pointer' : 'default'}
        transition="all 120ms"
        title={excluded ? 'Click to re-include this alt' : 'Click to exclude this alt'}
      >
        <img
          src={img.imageUrl}
          alt={`${img.productTitle || 'product'} alt ${img.altIndex || ''}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
        <Badge
          position="absolute" top="4px" left="4px"
          fontSize="9px"
          colorScheme={excluded ? 'gray' : 'purple'}
          variant="solid"
        >
          ALT {img.altIndex}
        </Badge>
        <Box
          position="absolute" bottom="0" left="0" right="0"
          bg={excluded ? 'blackAlpha.600' : 'rsViolet.500'}
          color="white"
          px={1.5} py={1}
          fontSize="9px" fontWeight="700"
          textAlign="center"
          letterSpacing="0.04em"
        >
          {excluded ? 'EXCLUDED' : 'AUTO'}
        </Box>
      </Box>
      <Text fontSize="10px" color="brand.muted" mt={1.5} noOfLines={2} lineHeight="1.3">
        {formatCatalogMeta(img)}
      </Text>
    </Box>
  );
}

// UGC tile in the product-kind related ribbon. Wraps MediaTile and
// appends the metadata strip "IG Post · {handle} · {postedAt}".
function ProductRelatedUgcTile({
  media, selected, onToggle
}: {
  media:    MediaRow;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Box w="120px">
      <MediaTile media={media} selected={selected} onClick={onToggle} />
      <Text fontSize="10px" color="brand.muted" mt={1.5} noOfLines={2} lineHeight="1.3">
        {formatUgcMeta(media)}
      </Text>
    </Box>
  );
}

// Metadata strip formatters. Catalog source maps via CATALOG_SOURCE_LABEL.
// UGC posts default to "IG Post" since Media.source today is 'instagram'
// for every ingested post; future platforms (TikTok, etc.) extend the map.
const CATALOG_SOURCE_LABEL: Record<string, string> = {
  'ig-catalog':        'IG catalog',
  'manual-upload':     'Manual upload',
  'detect-identified': 'Auto-detected'
};
const UGC_SOURCE_LABEL: Record<string, string> = {
  'instagram': 'IG Post',
  'tiktok':    'TikTok Post'
};

function formatCatalogMeta(img: CatalogImageRow): string {
  const src = CATALOG_SOURCE_LABEL[img.productSource || ''] || 'Catalog';
  const title = (img.productTitle || '').trim();
  const date = formatShortDate(img.productLastSyncedAt);
  return [src, title, date].filter(Boolean).join(' · ');
}

function formatUgcMeta(m: MediaRow): string {
  const src = UGC_SOURCE_LABEL[m.source || ''] || 'Post';
  const handle = (m.creatorHandle || '').trim();
  const handleStr = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '';
  const date = formatShortDate(m.postedAt);
  return [src, handleStr, date].filter(Boolean).join(' · ');
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.valueOf())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// ── Brand-kind unified view ──────────────────────────────────────────
// Collapses the legacy multi-section brand-campaign picker into two
// ribbons: a Media ribbon mixing product hero tiles + UGC tiles, and
// a Recommended ribbon below that responds to selection. Catalog alts
// surface as informational image-only tiles inside the recommended
// ribbon (no toggle — they fan out automatically when their product
// is picked). Tier expand buttons widen what's pulled into recommended.
type UnifiedTile =
  | { kind: 'product'; product: ProductRow }
  | { kind: 'media';   media:   MediaRow }
  | { kind: 'catalog_alt'; img: CatalogImageRow };

type BrandUnifiedViewProps = {
  products:               ProductRow[];
  media:                  MediaRow[];
  productSet:             Set<string>;
  mediaSet:               Set<string>;
  excludedSet:            Set<string>;
  toggleProduct:          (id: string) => void;
  toggleMedia:            (id: string) => void;
  toggleExclude:          (productId: string | null, mediaId: string) => void;
  relatedProducts:        ProductRow[];
  productMatchedRelated:  MediaRow[];
  categoryMatchedRelated: MediaRow[];
  brandMatches:           MediaRow[];
  catalogImagery:         CatalogImageRow[];
  loadingP:               boolean;
  loadingM:               boolean;
  includeCategoryMatched: boolean;
  includeBrandMatched:    boolean;
  onTierToggle:           (field: 'includeCategoryMatched' | 'includeBrandMatched', next: boolean) => void;
  anyPicks:               boolean;
};

function BrandUnifiedView(props: BrandUnifiedViewProps) {
  const {
    products, media, productSet, mediaSet, excludedSet,
    toggleProduct, toggleMedia, toggleExclude,
    relatedProducts, productMatchedRelated, categoryMatchedRelated, brandMatches, catalogImagery,
    loadingP, loadingM, includeCategoryMatched, includeBrandMatched, onTierToggle, anyPicks
  } = props;

  // Main ribbon: every available tile across the brand —
  //   product hero      → ProductTile (toggles value.productIds)
  //   product alts      → CatalogAltTile (auto-fanout; click toggles
  //                       a (productId, altMediaId) exclusion so the
  //                       operator can opt-out specific alts without
  //                       dropping the product)
  //   UGC media         → MediaTile (toggles value.mediaIds)
  // Products are emitted as a hero + N alt block per row, then all
  // UGC follows. Operator scrolls horizontally to browse the full set.
  const mainTiles: UnifiedTile[] = [];
  for (const p of products) {
    mainTiles.push({ kind: 'product', product: p });
    const altUrls = p.additionalImages || [];
    const altMediaIds = p.additionalImageMediaIds || [];
    for (let i = 0; i < altUrls.length; i++) {
      if (!altUrls[i]) continue;
      mainTiles.push({
        kind: 'catalog_alt',
        img: {
          productId:           p.id,
          productTitle:        p.title,
          productSource:       p.source || null,
          productLastSyncedAt: p.lastSyncedAt || null,
          imageUrl:            altUrls[i],
          imageMediaId:        altMediaIds[i] || null,
          role:                'alt',
          altIndex:            i + 1
        }
      });
    }
  }
  for (const m of media) {
    mainTiles.push({ kind: 'media', media: m });
  }

  // Recommended ribbon: media related to operator picks. Includes
  // discovered products from picked media + matched UGC for effective
  // products + (gated) category-matched + brand-matched. Catalog alts
  // are NOT duplicated here under brand-kind (they're already in the
  // main ribbon).
  void catalogImagery; // referenced only by product-kind flow; kept on the props signature for symmetry
  const recommendedTiles: UnifiedTile[] = [];
  const seenProductIds = new Set<string>();
  const seenMediaIds = new Set<string>();
  for (const p of relatedProducts) {
    if (seenProductIds.has(p.id)) continue;
    seenProductIds.add(p.id);
    recommendedTiles.push({ kind: 'product', product: p });
  }
  for (const m of productMatchedRelated) {
    if (seenMediaIds.has(m.id)) continue;
    seenMediaIds.add(m.id);
    recommendedTiles.push({ kind: 'media', media: m });
  }
  if (includeCategoryMatched) {
    for (const m of categoryMatchedRelated) {
      if (seenMediaIds.has(m.id)) continue;
      seenMediaIds.add(m.id);
      recommendedTiles.push({ kind: 'media', media: m });
    }
  }
  if (includeBrandMatched) {
    for (const m of brandMatches) {
      if (seenMediaIds.has(m.id)) continue;
      seenMediaIds.add(m.id);
      recommendedTiles.push({ kind: 'media', media: m });
    }
  }

  return (
    <>
      <SectionHeader
        title="Media"
        subtitle="Catalog imagery (hero + alts) and social posts. Pick any tile to feature — alts fan out automatically alongside their hero; click an alt to opt it out."
      />
      <UnifiedRibbon
        tiles={mainTiles}
        loading={loadingP || loadingM}
        emptyHint="No products or media yet — connect a catalog or Instagram to get started."
        productSet={productSet}
        mediaSet={mediaSet}
        excludedSet={excludedSet}
        toggleProduct={toggleProduct}
        toggleMedia={toggleMedia}
        toggleExclude={toggleExclude}
      />

      {anyPicks && (
        <>
          <SectionHeader
            title={`Media related to your selection (${recommendedTiles.length})`}
            subtitle="Other products and posts that pair with what you've picked. Click any tile to add or remove it."
            tone="muted"
          />
          {recommendedTiles.length === 0 ? (
            <Box h="100px" bg="gray.50" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="xs" color="brand.muted">
                No related items yet — try the tier expand buttons below to widen the recommendation pool.
              </Text>
            </Box>
          ) : (
            <UnifiedRibbon
              tiles={recommendedTiles}
              loading={false}
              productSet={productSet}
              mediaSet={mediaSet}
              excludedSet={excludedSet}
              toggleProduct={toggleProduct}
              toggleMedia={toggleMedia}
              toggleExclude={toggleExclude}
            />
          )}

          <HStack spacing={3} pt={1} wrap="wrap">
            <Button
              size="xs"
              variant={includeCategoryMatched ? 'softBrand' : 'outline'}
              onClick={() => onTierToggle('includeCategoryMatched', !includeCategoryMatched)}
              isDisabled={categoryMatchedRelated.length === 0 && !includeCategoryMatched}
            >
              {includeCategoryMatched ? '✓ ' : '+ '}
              Include category-matched ({categoryMatchedRelated.length})
            </Button>
            <Button
              size="xs"
              variant={includeBrandMatched ? 'softBrand' : 'outline'}
              onClick={() => onTierToggle('includeBrandMatched', !includeBrandMatched)}
              isDisabled={brandMatches.length === 0 && !includeBrandMatched}
            >
              {includeBrandMatched ? '✓ ' : '+ '}
              Include brand-matched ({brandMatches.length})
            </Button>
          </HStack>
        </>
      )}
    </>
  );
}

type UnifiedRibbonProps = {
  tiles:         UnifiedTile[];
  loading:       boolean;
  emptyHint?:    string;
  productSet:    Set<string>;
  mediaSet:      Set<string>;
  excludedSet:   Set<string>;
  toggleProduct: (id: string) => void;
  toggleMedia:   (id: string) => void;
  toggleExclude: (productId: string | null, mediaId: string) => void;
};

function UnifiedRibbon(props: UnifiedRibbonProps) {
  const { tiles, loading, emptyHint, productSet, mediaSet, excludedSet, toggleProduct, toggleMedia, toggleExclude } = props;

  if (loading && tiles.length === 0) {
    return (
      <Box h="120px" bg="gray.50" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
        <Text fontSize="xs" color="brand.muted">Loading…</Text>
      </Box>
    );
  }
  if (tiles.length === 0) {
    return (
      <Box h="120px" bg="gray.50" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
        <Text fontSize="xs" color="brand.muted">{emptyHint || 'Nothing here yet.'}</Text>
      </Box>
    );
  }
  return (
    <Box
      overflowX="auto"
      overflowY="hidden"
      pb={2}
      sx={{
        '&::-webkit-scrollbar':       { height: '8px' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.18)', borderRadius: '4px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' }
      }}
    >
      <HStack spacing={3} align="stretch" minW="min-content">
        {tiles.map((t, idx) => {
          if (t.kind === 'product') {
            const p = t.product;
            const sel = productSet.has(p.id);
            const key = pairingKey(p.id, p.seedMediaId || '');
            const excluded = p.seedMediaId ? excludedSet.has(key) : false;
            return (
              <Box key={`p-${p.id}-${idx}`} flexShrink={0} position="relative" opacity={excluded ? 0.4 : 1}>
                <ProductTile product={p} selected={sel} onClick={() => toggleProduct(p.id)} />
                {p.seedMediaId && (
                  <Box
                    as="button"
                    onClick={(e: MouseEvent) => { e.stopPropagation(); toggleExclude(p.id, p.seedMediaId || ''); }}
                    position="absolute"
                    top="4px"
                    right="4px"
                    w="18px" h="18px" borderRadius="full"
                    bg="rgba(0,0,0,0.55)" color="white"
                    fontSize="11px" fontWeight="800"
                    display="flex" alignItems="center" justifyContent="center"
                    title={excluded ? 'Re-include this pairing' : 'Exclude this pairing'}
                  >
                    {excluded ? '+' : '×'}
                  </Box>
                )}
              </Box>
            );
          }
          if (t.kind === 'media') {
            const m = t.media;
            const sel = mediaSet.has(m.id);
            const key = pairingKey(m.seedProductId || null, m.id);
            const excluded = (m.seedProductId !== undefined) ? excludedSet.has(key) : false;
            return (
              <Box key={`m-${m.id}-${idx}`} flexShrink={0} position="relative" opacity={excluded ? 0.4 : 1}>
                <MediaTile media={m} selected={sel} onClick={() => toggleMedia(m.id)} />
                {m.seedProductId !== undefined && (
                  <Box
                    as="button"
                    onClick={(e: MouseEvent) => { e.stopPropagation(); toggleExclude(m.seedProductId || null, m.id); }}
                    position="absolute"
                    top="4px"
                    right="4px"
                    w="18px" h="18px" borderRadius="full"
                    bg="rgba(0,0,0,0.55)" color="white"
                    fontSize="11px" fontWeight="800"
                    display="flex" alignItems="center" justifyContent="center"
                    title={excluded ? 'Re-include this pairing' : 'Exclude this pairing'}
                  >
                    {excluded ? '+' : '×'}
                  </Box>
                )}
              </Box>
            );
          }
          // catalog_alt — auto-fanout default, click toggles exclusion.
          // Selected look (purple border) means "will fan out when its
          // parent product is in scope". Excluded look (dimmed +
          // strikethrough) means the operator opted this alt out via
          // a (productId, altMediaId) excludedPairings entry. Alts
          // with no Media doc id (legacy catalog row without the
          // wrapper materialized) render as informational and can't
          // be toggled.
          const img = t.img;
          const altKey = img.imageMediaId
            ? pairingKey(img.productId, img.imageMediaId)
            : null;
          const altExcluded = altKey ? excludedSet.has(altKey) : false;
          const altClickable = !!img.imageMediaId;
          return (
            <Box key={`alt-${img.productId}-${img.altIndex || 0}-${idx}`} flexShrink={0}>
              <Box
                as={altClickable ? 'button' : 'div'}
                onClick={altClickable ? () => toggleExclude(img.productId, img.imageMediaId!) : undefined}
                position="relative"
                w="120px" h="120px"
                borderRadius="md"
                overflow="hidden"
                bg="gray.100"
                borderWidth="2px"
                borderColor={altExcluded ? 'brand.border' : 'rsViolet.400'}
                opacity={altExcluded ? 0.45 : 1}
                cursor={altClickable ? 'pointer' : 'default'}
                transition="all 120ms"
                title={altExcluded ? 'Click to re-include this alt' : 'Click to exclude this alt'}
              >
                <img
                  src={img.imageUrl}
                  alt={`${img.productTitle || 'product'} alt ${img.altIndex || ''}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
                <Badge
                  position="absolute" top="4px" left="4px"
                  fontSize="9px"
                  colorScheme={altExcluded ? 'gray' : 'purple'}
                  variant="solid"
                >
                  ALT {img.altIndex}
                </Badge>
                <Box
                  position="absolute" bottom="0" left="0" right="0"
                  bg={altExcluded ? 'blackAlpha.600' : 'rsViolet.500'}
                  color="white"
                  px={1.5} py={1}
                  fontSize="9px" fontWeight="700"
                  textAlign="center"
                  letterSpacing="0.04em"
                >
                  {altExcluded ? 'EXCLUDED' : 'AUTO'}
                </Box>
              </Box>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}
