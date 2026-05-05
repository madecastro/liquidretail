// Phase A-1 — aspect-ratio variant strip below the canvas.
// Phase A-2 polish — variants are now clickable; selected variant
// drives what the canvas displays. Original returns to the full
// source frame (with overlays). Crop variants show the cropped
// image without overlays since the bbox math was computed against
// the source frame, not the crop. Re-projecting overlays is a
// follow-up.

import { HStack, VStack, Box, Text, Badge, Image } from '@chakra-ui/react';
import { qualityBucket, buildCloudinaryCropUrl } from './format';
import type { DetectResult } from './types';

export type AspectVariant = {
  ratio:    string;
  label:    string;
  imageUrl: string | null;
  score:    number | null;
};

type Props = {
  fileUrl: string;
  detect:  DetectResult | null;
  value:   string;                                  // selected ratio key (default 'original')
  onChange: (variant: AspectVariant) => void;
};

export function AspectRatioStrip({ fileUrl, detect, value, onChange }: Props) {
  const variants = buildVariantList(fileUrl, detect);
  return (
    <HStack
      spacing={3}
      px={5}
      py={3}
      borderTopWidth="1px"
      borderTopColor="brand.border"
      bg="brand.surface"
      overflowX="auto"
    >
      {variants.map(v => (
        <VariantThumb
          key={v.ratio}
          v={v}
          selected={v.ratio === value}
          onClick={() => onChange(v)}
        />
      ))}
    </HStack>
  );
}

function VariantThumb({ v, selected, onClick }: { v: AspectVariant; selected: boolean; onClick: () => void }) {
  const q = v.score == null ? null : qualityBucket(v.score);
  const disabled = !v.imageUrl;
  return (
    <VStack
      spacing={1}
      flexShrink={0}
      w="120px"
      onClick={disabled ? undefined : onClick}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.55 : 1}
      role={disabled ? undefined : 'button'}
      aria-pressed={selected}
    >
      <Box
        w="100%"
        h="80px"
        borderRadius="md"
        bg="gray.100"
        overflow="hidden"
        borderWidth={selected ? '2px' : '1px'}
        borderColor={selected ? 'rsViolet.400' : 'brand.border'}
        boxShadow={selected ? '0 0 0 3px rgba(122,53,232,0.18)' : undefined}
        position="relative"
        transition="border-color 120ms, box-shadow 120ms"
        _hover={!disabled && !selected ? { borderColor: 'gray.400' } : undefined}
      >
        {v.imageUrl ? (
          <Image src={v.imageUrl} alt={v.ratio} w="100%" h="100%" objectFit="cover" />
        ) : (
          <Text fontSize="9px" color="brand.muted" textAlign="center" mt={6}>not yet generated</Text>
        )}
      </Box>
      <Text
        fontSize="xs"
        fontWeight="700"
        color={selected ? 'rsViolet.700' : 'brand.ink'}
      >
        {v.label}
      </Text>
      {q ? (
        <Badge variant="subtle" fontSize="9px" px={1.5} borderRadius="md" style={{ color: q.tone }}>
          {q.label}
        </Badge>
      ) : (
        <Box h={4} />
      )}
    </VStack>
  );
}

// ── data shaping ──

function buildVariantList(fileUrl: string, detect: DetectResult | null): AspectVariant[] {
  const out: AspectVariant[] = [];
  out.push({ ratio: 'original', label: 'Original', imageUrl: fileUrl, score: null });

  // Smart-crop ratios live on detect.crops[ratio][] with judge winners
  // surfaced via detect.judge[`crop_<ratio>`]. The flat shape varies a
  // bit between paths; we treat them as opaque dictionaries and fall
  // back gracefully when keys are missing.
  const baseRatios: { ratio: string; label: string; judgeKey: string; cropKey: string }[] = [
    { ratio: '5:4',  label: '5:4 Landscape', judgeKey: 'crop_5_4',  cropKey: '5:4' },
    { ratio: '1:1',  label: '1:1 Square',     judgeKey: 'crop_1_1',  cropKey: '1:1' },
    { ratio: '4:5',  label: '4:5 Portrait',   judgeKey: 'crop_4_5',  cropKey: '4:5' }
  ];
  const judge = (detect?.judge as Record<string, { winnerId?: string; winnerScore?: number }> | undefined) || {};
  const cropsMap = (detect?.crops as Record<string, Array<Record<string, unknown>>> | undefined) || {};

  for (const b of baseRatios) {
    const winnerId = judge[b.judgeKey]?.winnerId;
    const winnerScore = judge[b.judgeKey]?.winnerScore ?? null;
    const list = cropsMap[b.cropKey] || [];
    const winner = list.find(c => c['id'] === winnerId) || list[0];
    // Smart crops are stored as coordinate-only objects (no imageUrl).
    // Build a Cloudinary c_crop transform URL on the fly from the
    // source image so the strip shows actual previews.
    let imageUrl: string | null = typeof winner?.['imageUrl'] === 'string' ? winner['imageUrl'] as string : null;
    if (!imageUrl && winner) {
      imageUrl = buildCloudinaryCropUrl(fileUrl, {
        x1: Number(winner['x1']),
        y1: Number(winner['y1']),
        x2: Number(winner['x2']),
        y2: Number(winner['y2'])
      });
    }
    out.push({
      ratio: b.ratio,
      label: b.label,
      imageUrl,
      score: typeof winnerScore === 'number' ? winnerScore : null
    });
  }

  // Extended ratios — pull from extendedCrops candidates (Gemini extension/generation)
  const extMap = (detect?.extendedCrops as Record<string, Array<Record<string, unknown>>> | undefined) || {};
  for (const ratio of ['9:16', '1.91:1']) {
    const list = extMap[ratio] || [];
    const winner = list.find(c => c['provider'] === 'gemini' && c['variant'] === 'extension') || list[0];
    out.push({
      ratio,
      label: ratio === '9:16' ? '9:16 Story' : '1.91:1 Landscape',
      imageUrl: typeof winner?.['imageUrl'] === 'string' ? winner['imageUrl'] as string : null,
      score:    null   // extended judge scores live elsewhere; A-1 doesn't surface them
    });
  }

  return out;
}
