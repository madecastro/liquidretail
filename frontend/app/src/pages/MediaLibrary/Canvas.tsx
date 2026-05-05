// Phase A-1 — the main canvas. Renders the source image scaled to fit
// and stacks overlay layers on top. Each overlay layer is a positioned
// <div> tree using percentages so it scales with the image. We assume
// the underlying media's intrinsic dimensions are known; if not we
// degrade to "image only, no overlays" rather than risk misaligned bboxes.

import { Box, Spinner, Text, Flex, VStack } from '@chakra-ui/react';
import type {
  DetectResult,
  LayerKey,
  TextRegion,
  RefinedProduct,
  YoloProduct,
  Restriction,
  DensityGrid
} from './types';
import { densityCellColor } from './format';

type Props = {
  fileUrl:        string;
  detect:         DetectResult | null;
  loading:        boolean;
  activeLayers:   Set<LayerKey>;
  // When a non-original aspect-ratio variant is selected, the canvas
  // swaps to the cropped image and suppresses overlays — the bbox
  // coords were computed against the source frame, so they no longer
  // align inside the cropped view. Set both fields together; if
  // displayUrl is null/undefined, the canvas falls back to fileUrl
  // and shows overlays as usual.
  displayUrl?:    string | null;
  isCroppedView?: boolean;
  cropAspect?:    string | null;
};

export function Canvas({ fileUrl, detect, loading, activeLayers, displayUrl, isCroppedView, cropAspect }: Props) {
  const w = detect?.width  || 0;
  const h = detect?.height || 0;
  const renderUrl = displayUrl || fileUrl;

  // Pull the canonical overlay-zone analysis (5:4 base, falling back to
  // any). Used by Safe Zones + Density layers.
  const overlay = pickPrimaryOverlay(detect);

  // CSS aspect-ratio container. We pin the height (so the box always
  // claims usable space inside the flex column) and let the width
  // follow from the image's intrinsic ratio. maxWidth caps overflow on
  // wide images; maxHeight caps very tall images so the bottom strip
  // stays visible. AspectRatio (Chakra) was collapsing to 0 width when
  // width was "auto" inside a flex-centered parent — switched to raw
  // CSS aspect-ratio which Chrome / Safari / Firefox all support.
  //
  // When a cropped variant is selected, the container's aspect-ratio
  // switches to that variant so the cropped image fills it correctly
  // (otherwise the crop would letterbox/pillarbox inside the source
  // frame's ratio).
  const ratio = isCroppedView && cropAspect
    ? cropAspect.replace(':', ' / ')
    : (w && h ? `${w} / ${h}` : '4 / 5');
  const hasDims = w > 0 && h > 0;
  const showOverlays = !isCroppedView;

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
          height: '100%',          // claim all available column height
          width: 'auto',           // width derives from aspect-ratio
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        {renderUrl && (
          <img
            src={renderUrl}
            alt="media"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {detect && hasDims && showOverlays && (
          <Box position="absolute" inset={0} pointerEvents="none">
            {activeLayers.has('density')    && overlay?.densityGrid   && <DensityLayer grid={overlay.densityGrid} />}
            {activeLayers.has('safe-zones') && overlay?.restrictions && <SafeZonesLayer restrictions={overlay.restrictions} />}
            {activeLayers.has('crops')      && detect.refinedProducts && <CropsLayer refinedProducts={detect.refinedProducts} imgW={w} imgH={h} />}
            {activeLayers.has('products')   && detect.refinedProducts && <ProductsLayer refinedProducts={detect.refinedProducts} imgW={w} imgH={h} />}
            {activeLayers.has('people')     && detect.products       && <PeopleLayer yoloProducts={detect.products} imgW={w} imgH={h} />}
            {activeLayers.has('text')       && detect.text            && <TextLayer regions={detect.text} />}
          </Box>
        )}

        {isCroppedView && (
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
            {cropAspect} crop · overlays hidden
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

function ProductsLayer({ refinedProducts, imgW, imgH }: { refinedProducts: RefinedProduct[]; imgW: number; imgH: number }) {
  return (
    <>
      {refinedProducts.map(rp => {
        const box = pixelToPct(rp, imgW, imgH);
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

function PeopleLayer({ yoloProducts, imgW, imgH }: { yoloProducts: YoloProduct[]; imgW: number; imgH: number }) {
  const people = yoloProducts.filter(p => p.className === 'person');
  return (
    <>
      {people.map(p => {
        const box = pixelToPct(p, imgW, imgH);
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

function TextLayer({ regions }: { regions: TextRegion[] }) {
  return (
    <>
      {regions.map(t => (
        <BboxOverlay
          key={`text-${t.id}`}
          // text bboxes already normalized 0..1
          box={t}
          color="#F57C00"
          label={`${t.content || 'text'} ${formatPct(t.confidence)}`}
        />
      ))}
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
  // Use a CSS grid overlay; one cell per density-grid cell.
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

function CropsLayer({ refinedProducts, imgW, imgH }: { refinedProducts: RefinedProduct[]; imgW: number; imgH: number }) {
  // Visualizes the smart-crop bbox of each refined product as a dashed
  // outline — same data as Products layer but rendered without label so
  // both can stack visually.
  return (
    <>
      {refinedProducts.map(rp => {
        const box = pixelToPct(rp, imgW, imgH);
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

function pixelToPct(p: { x1: number; y1: number; x2: number; y2: number }, imgW: number, imgH: number) {
  return {
    x1: imgW > 0 ? p.x1 / imgW : 0,
    y1: imgH > 0 ? p.y1 / imgH : 0,
    x2: imgW > 0 ? p.x2 / imgW : 0,
    y2: imgH > 0 ? p.y2 / imgH : 0
  };
}

function formatPct(v: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  if (v <= 1) return `${Math.round(v * 100)}%`;
  return `${Math.round(v)}%`;
}

function pickPrimaryOverlay(detect: DetectResult | null) {
  if (!detect?.overlayZones) return null;
  const zones = detect.overlayZones;
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
