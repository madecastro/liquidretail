// Phase 4d — Preview card.
//
// Shows what brand identity (colors, logo, tagline, font) looks like
// applied to a sample ad creative. Pure client-side mockup — there's
// no rendering pipeline that emits "preview ads for a brand" yet, so
// we cycle through 4 layout templates using the brand's existing
// fields as content.
//
// Future: a /api/brand/:id/preview endpoint that returns N actual
// rendered creatives (Phase B render-service ticket). For now this
// gives operators a "what does this brand FEEL like applied?" sanity
// check in the same panel as Visual Identity.

import { useState } from 'react';
import { Card, CardBody, HStack, VStack, Box, Text, Heading, Image, IconButton, Icon } from '@chakra-ui/react';
import type { Brand } from './types';

type LayoutKind = 'hero' | 'split' | 'minimal' | 'badge';
const LAYOUTS: LayoutKind[] = ['hero', 'split', 'minimal', 'badge'];

export function PreviewCard({ brand }: { brand: Brand }) {
  const [layout, setLayout] = useState<LayoutKind>('hero');

  return (
    <Card variant="outline" h="100%">
      <CardBody>
        <HStack justify="space-between" mb={3}>
          <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em">Preview</Heading>
          <Text fontSize="9px" color="brand.muted">Brand identity applied</Text>
        </HStack>

        <Box position="relative">
          <PreviewCanvas brand={brand} layout={layout} />

          {/* Carousel chevrons */}
          <IconButton
            aria-label="Previous layout"
            size="xs"
            position="absolute"
            top="50%"
            left={1}
            transform="translateY(-50%)"
            bg="whiteAlpha.800"
            _hover={{ bg: 'white' }}
            onClick={() => setLayout(LAYOUTS[(LAYOUTS.indexOf(layout) - 1 + LAYOUTS.length) % LAYOUTS.length])}
            icon={<ChevLeftIcon />}
          />
          <IconButton
            aria-label="Next layout"
            size="xs"
            position="absolute"
            top="50%"
            right={1}
            transform="translateY(-50%)"
            bg="whiteAlpha.800"
            _hover={{ bg: 'white' }}
            onClick={() => setLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length])}
            icon={<ChevRightIcon />}
          />
        </Box>

        {/* Carousel dots */}
        <HStack justify="center" spacing={2} mt={3}>
          {LAYOUTS.map(k => (
            <Box
              key={k}
              w="8px"
              h="8px"
              borderRadius="full"
              bg={k === layout ? 'rsViolet.500' : 'gray.300'}
              cursor="pointer"
              onClick={() => setLayout(k)}
              transition="background 120ms"
            />
          ))}
        </HStack>

        <Text fontSize="9px" color="brand.muted" mt={3} textAlign="center" fontStyle="italic">
          Mock preview — final renders ship from the render service in a follow-up.
        </Text>
      </CardBody>
    </Card>
  );
}

// ── Layouts ────────────────────────────────────────────────────────

function PreviewCanvas({ brand, layout }: { brand: Brand; layout: LayoutKind }) {
  const primary    = brand.primaryColor   || '#0B1020';
  const secondary  = brand.secondaryColor || '#FFFFFF';
  const accent     = brand.accentColor    || '#F57C00';
  const fontColor  = brand.fontColor      || '#FFFFFF';
  const fontFamily = brand.fontFamily     || 'Inter, system-ui, sans-serif';
  const headline   = brand.tagline || 'Bold. Distinct. Yours.';
  const ctaText    = 'Shop Now';

  if (layout === 'hero')    return <HeroLayout    brand={brand} primary={primary} accent={accent} fontColor={fontColor} fontFamily={fontFamily} headline={headline} ctaText={ctaText} />;
  if (layout === 'split')   return <SplitLayout   brand={brand} primary={primary} secondary={secondary} accent={accent} fontColor={fontColor} fontFamily={fontFamily} headline={headline} ctaText={ctaText} />;
  if (layout === 'minimal') return <MinimalLayout brand={brand} primary={primary} accent={accent} fontFamily={fontFamily} headline={headline} ctaText={ctaText} />;
  return <BadgeLayout brand={brand} primary={primary} accent={accent} fontColor={fontColor} fontFamily={fontFamily} headline={headline} ctaText={ctaText} />;
}

function HeroLayout({ brand, primary, accent, fontColor, fontFamily, headline, ctaText }: LayoutProps) {
  return (
    <Box
      h="220px"
      borderRadius="lg"
      overflow="hidden"
      bg={primary}
      bgGradient={`linear(135deg, ${primary} 0%, ${shade(primary, -20)} 100%)`}
      position="relative"
      p={4}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      style={{ fontFamily }}
    >
      <BrandLogoMark brand={brand} fontColor={fontColor} />
      <Box>
        <Text fontSize="lg" fontWeight="800" color={fontColor} lineHeight="1.15" noOfLines={2}>
          {headline}
        </Text>
        <Box mt={2} display="inline-block" px={3} py={1.5} borderRadius="full" bg={accent}>
          <Text fontSize="xs" fontWeight="700" color={contrastOn(accent)}>{ctaText}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function SplitLayout({ brand, primary, secondary, accent, fontColor, fontFamily, headline, ctaText }: LayoutProps) {
  return (
    <Box h="220px" borderRadius="lg" overflow="hidden" display="flex" style={{ fontFamily }}>
      <Box flex={1} bg={primary} p={4} display="flex" flexDirection="column" justifyContent="space-between">
        <BrandLogoMark brand={brand} fontColor={fontColor} />
        <Box>
          <Text fontSize="md" fontWeight="800" color={fontColor} lineHeight="1.2" noOfLines={3}>
            {headline}
          </Text>
        </Box>
      </Box>
      <Box flex={1} bg={secondary} p={4} display="flex" alignItems="flex-end">
        <Box display="inline-block" px={3} py={1.5} borderRadius="full" bg={accent}>
          <Text fontSize="xs" fontWeight="700" color={contrastOn(accent)}>{ctaText}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function MinimalLayout({ brand, primary, accent, fontFamily, headline, ctaText }: Omit<LayoutProps, 'fontColor'> & { fontColor?: string }) {
  return (
    <Box
      h="220px"
      borderRadius="lg"
      overflow="hidden"
      bg="white"
      borderWidth="1px"
      borderColor="brand.border"
      p={4}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      style={{ fontFamily }}
    >
      <BrandLogoMark brand={brand} fontColor={primary} />
      <Box>
        <Text fontSize="lg" fontWeight="800" color={primary} lineHeight="1.15" noOfLines={2}>
          {headline}
        </Text>
        <HStack spacing={2} mt={3}>
          <Box w="6px" h="20px" bg={accent} />
          <Text fontSize="xs" fontWeight="700" color={primary} textTransform="uppercase" letterSpacing="0.06em">{ctaText} →</Text>
        </HStack>
      </Box>
    </Box>
  );
}

function BadgeLayout({ brand, primary, accent, fontColor, fontFamily, headline, ctaText }: LayoutProps) {
  return (
    <Box
      h="220px"
      borderRadius="lg"
      overflow="hidden"
      bg={primary}
      position="relative"
      p={4}
      style={{ fontFamily }}
    >
      <Box position="absolute" top={3} right={3} px={2} py={1} bg={accent} borderRadius="md" transform="rotate(8deg)">
        <Text fontSize="10px" fontWeight="800" color={contrastOn(accent)} textTransform="uppercase">New</Text>
      </Box>
      <VStack align="flex-start" spacing={3} h="100%" justify="center">
        <BrandLogoMark brand={brand} fontColor={fontColor} />
        <Text fontSize="md" fontWeight="800" color={fontColor} lineHeight="1.2" noOfLines={3}>
          {headline}
        </Text>
        <Box display="inline-block" px={3} py={1.5} borderRadius="md" bg={fontColor}>
          <Text fontSize="xs" fontWeight="700" color={primary}>{ctaText}</Text>
        </Box>
      </VStack>
    </Box>
  );
}

type LayoutProps = {
  brand:      Brand;
  primary:    string;
  secondary?: string;
  accent:     string;
  fontColor:  string;
  fontFamily: string;
  headline:   string;
  ctaText:    string;
};

function BrandLogoMark({ brand, fontColor }: { brand: Brand; fontColor: string }) {
  if (brand.logoUrl) {
    return (
      <Box maxW="100px" maxH="36px">
        <Image src={brand.logoUrl} alt={brand.name} maxW="100%" maxH="36px" objectFit="contain" />
      </Box>
    );
  }
  return (
    <Text fontSize="md" fontWeight="800" color={fontColor} letterSpacing="0.04em" textTransform="uppercase">
      {brand.name}
    </Text>
  );
}

// ── color helpers ───────────────────────────────────────────────────

function shade(hex: string, percent: number): string {
  // Lighten/darken a hex color by `percent` (negative = darker)
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8)  & 0xff;
  let b =  num        & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

function contrastOn(bgHex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(bgHex);
  if (!m) return '#FFFFFF';
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8)  & 0xff;
  const b =  num        & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#0B1020' : '#FFFFFF';
}

function ChevLeftIcon()  { return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></Icon>; }
function ChevRightIcon() { return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" /></Icon>; }
