// Phase A-1 — the main canvas. Renders the source image scaled to fit
// and stacks overlay layers on top. Each overlay layer is a positioned
// <div> tree using percentages so it scales with the image. We assume
// the underlying media's intrinsic dimensions are known; if not we
// degrade to "image only, no overlays" rather than risk misaligned bboxes.
//
// Phase A-2 polish — when the user picks a smart-crop variant from the
// strip below, the canvas:
//   1. Swaps the image to the cropped view
//   2. Switches the container's CSS aspect-ratio to the crop's
//   3. Re-projects products / people / text bboxes from source pixels
//      into the cropped frame's normalized [0,1] coords (clipped at
//      crop edges, dropping bboxes entirely outside)
//   4. Pulls the OverlayZoneArtifact analysis for THAT specific ratio
//      (already computed in the cropped frame's coord space) — so
//      density + safe-zones still align
// Extended-crop variants (Gemini-generated 9:16 / 1.91:1) are NOT crops
// of the source — they're new images. Source-frame overlays don't
// translate, so products/people/text are hidden in those views; the
// per-ratio overlay-zone analysis (density + safe zones) still renders
// since it was computed against the extended image directly.

import { Box, Spinner, Text, Flex, VStack } from '@chakra-ui/react';
import type {
  DetectResult,
  LayerKey,
  TextRegion,
  RefinedProduct,
  YoloProduct,
  Restriction,
  DensityGrid,
  OverlayZoneAnalysis
} from './types';
import type { AspectVariant } from './AspectRatioStrip';
import { densityCellColor, projectBboxToCrop, cloudinaryVideoPoster } from './format';

type Props = {
  fileUrl:      string;
  fileType:     'image' | 'video';
  detect:       DetectResult | null;
  loading:      boolean;
  activeLayers: Set<LayerKey>;
  variant:      AspectVariant;       // current selection from the strip
};

export function Canvas({ fileUrl, fileType, detect, loading, activeLayers, variant }: Props) {
  const w = detect?.width  || 0;
  const h = detect?.height || 0;
  const renderUrl = (variant.kind === 'original' ? fileUrl : variant.imageUrl) || fileUrl;
  // Videos: render <video> only on the original variant. For
  // smart-crop and extended-crop variants the renderUrl is a JPEG
  // (we never crop video frames in the pipeline), so an <img> is
  // correct there. The `original` variant's renderUrl points at the
  // .mp4 — needs a <video> tag with a poster so the user sees a
  // thumbnail before clicking play.
  const isVideoOriginal = fileType === 'video' && variant.kind === 'original';
  const posterUrl = isVideoOriginal ? cloudinaryVideoPoster(renderUrl) : null;
  const isOriginal     = variant.kind === 'original';
  const isSmartCrop    = variant.kind === 'smart-crop';
  const isExtendedCrop = variant.kind === 'extended-crop';

  // Pick the overlay-zone analysis matching the active variant's ratio.
  // For 'original', use the canonical 5:4-base fallback. For smart-crop
  // and extended-crop, use that ratio's analysis (already in its own
  // 0..1 coord space).
  const overlay = pickOverlayForVariant(detect, variant);

  // CSS aspect-ratio container. We pin the height (so the box always
  // claims usable space inside the flex column) and let the width
  // follow from the image's intrinsic ratio. maxWidth caps overflow on
  // wide images; maxHeight caps very tall images so the bottom strip
  // stays visible.
  const ratio = isOriginal
    ? (w && h ? `${w} / ${h}` : '4 / 5')
    : variant.ratio.replace(':', ' / ');

  const hasDims = w > 0 && h > 0;
  // Source-frame layers (products / people / text) only render when:
  //   - original view (no projection needed), OR
  //   - smart-crop with a known cropBbox + valid source dims
  const canShowSourceLayers = isOriginal || (isSmartCrop && variant.cropBbox && hasDims);

  return (
    <Box
      flex={1}
      minH={0}
      bg="gray.50"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={5}
      overflow="auto"
    >
      <Box
        position="relative"
        bg="gray.100"
        borderRadius="md"
        overflow="hidden"
        sx={{
          aspectRatio: ratio,
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        {renderUrl && (
          isVideoOriginal ? (
            <video
              src={renderUrl}
              poster={posterUrl || undefined}
              controls
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
            />
          ) : (
            <img
              src={renderUrl}
              alt="media"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )
        )}

        {detect && (
          <Box position="absolute" inset={0} pointerEvents="none">
            {/* Density + safe-zones come from the variant's matching analysis,
                which is already in that ratio's coord space — no projection. */}
            {activeLayers.has('density')    && overlay?.densityGrid   && <DensityLayer grid={overlay.densityGrid} />}
            {activeLayers.has('safe-zones') && overlay?.restrictions && <SafeZonesLayer restrictions={overlay.restrictions} />}

            {/* Source-frame layers — original or smart-crop only. */}
            {canShowSourceLayers && activeLayers.has('crops') && isOriginal && detect.refinedProducts && (
              <CropsLayer refinedProducts={detect.refinedProducts} imgW={w} imgH={h} variant={variant} />
            )}
            {canShowSourceLayers && activeLayers.has('products') && detect.refinedProducts && (
              <ProductsLayer refinedProducts={detect.refinedProducts} imgW={w} imgH={h} variant={variant} />
            )}
            {canShowSourceLayers && activeLayers.has('people') && detect.products && (
              <PeopleLayer yoloProducts={detect.products} imgW={w} imgH={h} variant={variant} />
            )}
            {canShowSourceLayers && activeLayers.has('text') && detect.text && (
              <TextLayer regions={detect.text} imgW={w} imgH={h} variant={variant} />
            )}
          </Box>
        )}

        {!isOriginal && (
          <Box
            position="absolute"
            top={2}
            left={2}
            px={2}
            py={1}
            bg="blackAlpha.700"
            borderRadius="md"
            fontSize="10px"
            color="white"
            fontWeight="600"
          >
            {variant.label}{isExtendedCrop ? ' · source overlays hidden (extended)' : ''}
          </Box>
        )}

        {loading && (
          <Flex position="absolute" inset={0} align="center" justify="center" bg="whiteAlpha.700">
            <VStack><Spinner /><Text fontSize="xs" color="brand.muted">Loading detect data…</Text></VStack>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

// ── Layers ──────────────────────────────────────────────────────────

function ProductsLayer({ refinedProducts, imgW, imgH, variant }: { refinedProducts: RefinedProduct[]; imgW: number; imgH: number; variant: AspectVariant }) {
  return (
    <>
      {refinedProducts.map(rp => {
        const box = bboxForVariant(rp, imgW, imgH, variant, false);
        if (!box) return null;
        return (
          <BboxOverlay
            key={`rp-${rp.id}`}
            box={box}
            color="#0B84D8"
            label={`${rp.label || 'product'} ${formatPct(rp.confidence)}`}
          />
        );
      })}
    </>
  );
}

function PeopleLayer({ yoloProducts, imgW, imgH, variant }: { yoloProducts: YoloProduct[]; imgW: number; imgH: number; variant: AspectVariant }) {
  const people = yoloProducts.filter(p => p.className === 'person');
  return (
    <>
      {people.map(p => {
        const box = bboxForVariant(p, imgW, imgH, variant, false);
        if (!box) return null;
        return (
          <BboxOverlay
            key={`person-${p.id}`}
            box={box}
            color="#7A35E8"
            label={`Person ${formatPct(p.confidence)}`}
          />
        );
      })}
    </>
  );
}

function TextLayer({ regions, imgW, imgH, variant }: { regions: TextRegion[]; imgW: number; imgH: number; variant: AspectVariant }) {
  return (
    <>
      {regions.map(t => {
        // text bboxes are stored normalized [0,1] (vs. pixel for products/yolo)
        const box = bboxForVariant(t, imgW, imgH, variant, true);
        if (!box) return null;
        return (
          <BboxOverlay
            key={`text-${t.id}`}
            box={box}
            color="#F57C00"
            label={`${t.content || 'text'} ${formatPct(t.confidence)}`}
          />
        );
      })}
    </>
  );
}

function SafeZonesLayer({ restrictions }: { restrictions: Restriction[] }) {
  // Render high-strictness restrictions as red translucent forbidden
  // zones; low-strictness as green safe-zone tints. Strictness 1.0
  // (hard product rect) gets a stronger border so it stands out.
  return (
    <>
      {restrictions.map(r => {
        const isHard = r.strictness >= 0.9;
        const isSafe = r.strictness < 0.4;
        const color = isHard ? '#DC2626' : isSafe ? '#059669' : '#16B8D8';
        return (
          <BboxOverlay
            key={`r-${r.id}`}
            box={r.rectPct}
            color={color}
            label={`${r.classification} · ${r.strictness.toFixed(1)}`}
            fill={isHard ? 'rgba(220,38,38,0.10)' : isSafe ? 'rgba(5,150,105,0.10)' : 'rgba(22,184,216,0.10)'}
          />
        );
      })}
    </>
  );
}

function DensityLayer({ grid }: { grid: DensityGrid }) {
  const { cols, rows, cells } = grid;
  if (!cols || !rows || !cells?.length) return null;
  return (
    <Box
      position="absolute"
      inset={0}
      display="grid"
      gridTemplateColumns={`repeat(${cols}, 1fr)`}
      gridTemplateRows={`repeat(${rows}, 1fr)`}
      mixBlendMode="multiply"
      pointerEvents="none"
    >
      {cells.flatMap((row, r) => row.map((v, c) => (
        <Box key={`d-${r}-${c}`} bg={densityCellColor(v)} />
      )))}
    </Box>
  );
}

function CropsLayer({ refinedProducts, imgW, imgH, variant }: { refinedProducts: RefinedProduct[]; imgW: number; imgH: number; variant: AspectVariant }) {
  // Visualizes the smart-crop bbox of each refined product as a dashed
  // outline. Only renders in original view — inside a crop it's
  // visually noisy and conceptually redundant.
  return (
    <>
      {refinedProducts.map(rp => {
        const box = bboxForVariant(rp, imgW, imgH, variant, false);
        if (!box) return null;
        return (
          <Box
            key={`c-${rp.id}`}
            position="absolute"
            left={`${box.x1 * 100}%`}
            top={`${box.y1 * 100}%`}
            width={`${(box.x2 - box.x1) * 100}%`}
            height={`${(box.y2 - box.y1) * 100}%`}
            border="2px dashed #16A34A"
            borderRadius="2px"
          />
        );
      })}
    </>
  );
}

// ── helpers ────────────────────────────────────────────────────────

// Resolve the right normalized [0,1] bbox to render given the active
// variant. Returns null when the bbox falls entirely outside a smart
// crop (so the layer can skip it).
function bboxForVariant(
  source: { x1: number; y1: number; x2: number; y2: number },
  imgW: number,
  imgH: number,
  variant: AspectVariant,
  isNormalized: boolean
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (variant.kind === 'original') {
    if (isNormalized) return source;
    return {
      x1: imgW > 0 ? source.x1 / imgW : 0,
      y1: imgH > 0 ? source.y1 / imgH : 0,
      x2: imgW > 0 ? source.x2 / imgW : 0,
      y2: imgH > 0 ? source.y2 / imgH : 0
    };
  }
  if (variant.kind === 'smart-crop' && variant.cropBbox) {
    return projectBboxToCrop(source, variant.cropBbox, imgW, imgH, isNormalized);
  }
  return null;   // extended-crop or smart-crop without bbox → don't project
}

function BboxOverlay({
  box, color, label, fill
}: {
  box: { x1: number; y1: number; x2: number; y2: number };
  color: string;
  label?: string;
  fill?: string;
}) {
  const left = box.x1 * 100;
  const top  = box.y1 * 100;
  const w    = Math.max(0, (box.x2 - box.x1)) * 100;
  const h    = Math.max(0, (box.y2 - box.y1)) * 100;
  return (
    <Box
      position="absolute"
      left={`${left}%`}
      top={`${top}%`}
      width={`${w}%`}
      height={`${h}%`}
      border={`2px solid ${color}`}
      borderRadius="3px"
      bg={fill}
    >
      {label && (
        <Box
          position="absolute"
          top="-22px"
          left="-2px"
          px={1.5}
          py={0.5}
          fontSize="10px"
          fontWeight="700"
          color="white"
          bg={color}
          borderRadius="3px"
          whiteSpace="nowrap"
          maxW="220px"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {label}
        </Box>
      )}
    </Box>
  );
}

function formatPct(v: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  if (v <= 1) return `${Math.round(v * 100)}%`;
  return `${Math.round(v)}%`;
}

// Pick the overlay-zone analysis to render given the active variant.
// For original, fall back to the 5:4 base ratio (most representative
// of the source frame). For a specific variant, prefer that ratio's
// analysis — already computed in its own 0..1 coord space, so density
// + safe zones align without re-projection.
function pickOverlayForVariant(detect: DetectResult | null, variant: AspectVariant): OverlayZoneAnalysis | null {
  const zones = detect?.overlayZones;
  if (!zones) return null;

  if (variant.kind !== 'original') {
    const variants = zones[variant.ratio];
    if (Array.isArray(variants)) {
      const v = variants.find(x => x.analysis);
      if (v?.analysis) return v.analysis;
    }
    // fall through to default if the variant ratio has no analysis yet
  }

  for (const ratio of ['5:4', '1:1', '4:5']) {
    const variants = zones[ratio];
    if (Array.isArray(variants)) {
      const base = variants.find(v => v.variant === 'base' && v.analysis) || variants.find(v => v.analysis);
      if (base?.analysis) return base.analysis;
    }
  }
  for (const ratio of Object.keys(zones)) {
    const variants = zones[ratio];
    if (Array.isArray(variants)) {
      const v = variants.find(x => x.analysis);
      if (v?.analysis) return v.analysis;
    }
  }
  return null;
}
