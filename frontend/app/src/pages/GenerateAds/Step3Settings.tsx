// Step 3 — Settings.
//
// Three sub-fields the renderer needs:
//   1. Templates (multi-select) — which creative templates to fan out
//      across. List mirrors campaignAdsGenerationService.SUPPORTED_TEMPLATES
//      (the 4 V1 renderer-ready templates). Each tile shows a schematic
//      preview of the layout's zone arrangement so the operator can pick
//      by visual character without needing a full render.
//   2. CTA — text + landing URL the rendered creative will link to.
//   3. URL params — querystring fragment appended to the CTA URL for
//      tracking (utm_source, utm_medium, …). Pre-filled from the
//      selected campaign's tracking config when available.

import { Box, VStack, HStack, Text, Input, Textarea, FormControl, FormLabel, SimpleGrid, Card, CardBody, Tag, TagLabel, TagLeftIcon, Icon } from '@chakra-ui/react';
import type { WizardSelections } from './index';
import { StepShell } from './index';

type TemplateOption = {
  id:           string;
  label:        string;
  emphasis:     string;
  description:  string;
  ratios:       string[];
  schematic:    'spotlight' | 'split' | 'testimonial-overlay' | 'product-overlay' | 'ai';
  disabled?:    boolean;
  isAi?:        boolean;
};

// V1 ships 1:1, 9:16, 16:9 — other ratios are filtered server-side.
const SHIPPING_RATIOS = ['1:1', '9:16', '16:9'];

// Max templates the operator can pick per generation. Keeps the
// cartesian (templates × ratios = up to MAX_TEMPLATES × 3 ratios)
// inside the MAX_CREATIVES_PER_RUN cap on the backend (10).
const MAX_TEMPLATES_PER_RUN = 2;

// Mirrors server/services/campaignAdsGenerationService.js SUPPORTED_TEMPLATES.
// Overlay templates are temporarily disabled in the UI until layout
// polish lands; the backend still accepts them via direct API.
const TEMPLATES: TemplateOption[] = [
  {
    id: 'testimonial_spotlight',
    label: 'Testimonial Spotlight',
    emphasis: 'Quote-first',
    description: 'Editorial layout — a single hero testimonial, paired with product + rating support.',
    ratios: SHIPPING_RATIOS,
    schematic: 'spotlight'
  },
  {
    id: 'ugc_split_screen',
    label: 'UGC Split-Screen',
    emphasis: 'UGC-first',
    description: 'Creator media on one side, copy + product card on the other — feels native to social.',
    ratios: SHIPPING_RATIOS,
    schematic: 'split'
  },
  {
    id: 'testimonial_overlay',
    label: 'Testimonial Overlay',
    emphasis: 'Image-first',
    description: 'Full-bleed photo with floating headline, quote, and CTA placed in subject-safe regions.',
    ratios: SHIPPING_RATIOS,
    schematic: 'testimonial-overlay',
    disabled: true
  },
  {
    id: 'product_overlay',
    label: 'Product Overlay',
    emphasis: 'Image-first',
    description: 'Full-bleed photo with a floating product card (image + name + price) and CTA.',
    ratios: SHIPPING_RATIOS,
    schematic: 'product-overlay',
    disabled: true
  },
  // AI templates — each maps 1:1 to a creativeStyle in the backend's
  // CREATIVE_STYLES map. Operator picks one or more; the cartesian
  // fans across them so a 3-style pick on 4 media = 12 ads in 3
  // creative directions instead of 12 ads in the safest default.
  // 1:1 only on the first cut.
  {
    id: 'ai_brand_led',
    label: 'AI: Brand-led',
    emphasis: 'AI-generated',
    description: 'Brand colors, logo, and hero media dominate; product card + CTA support.',
    ratios: ['1:1'],
    schematic: 'ai',
    isAi: true
  },
  {
    id: 'ai_ugc_led',
    label: 'AI: UGC-led',
    emphasis: 'AI-generated',
    description: 'Full-bleed creator photo carries the ad; minimal brand chrome, creator attribution visible.',
    ratios: ['1:1'],
    schematic: 'ai',
    isAi: true
  },
  {
    id: 'ai_social_proof_led',
    label: 'AI: Social Proof',
    emphasis: 'AI-generated',
    description: 'Real comments / ratings / engagement stats are the visual anchor.',
    ratios: ['1:1'],
    schematic: 'ai',
    isAi: true
  },
  {
    id: 'ai_editorial',
    label: 'AI: Editorial',
    emphasis: 'AI-generated',
    description: 'Magazine-spread aesthetic — typography hero, image inset, generous whitespace.',
    ratios: ['1:1'],
    schematic: 'ai',
    isAi: true
  },
  {
    id: 'ai_promotional',
    label: 'AI: Promotional',
    emphasis: 'AI-generated',
    description: 'Offer-first — discount or sale callout dominates with urgency cues.',
    ratios: ['1:1'],
    schematic: 'ai',
    isAi: true
  }
];

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step3Settings({ value, onChange }: Props) {
  const toggleTemplate = (id: string) => {
    const tpl = TEMPLATES.find(t => t.id === id);
    if (tpl?.disabled) return;
    const set = new Set(value.templateIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      if (set.size >= MAX_TEMPLATES_PER_RUN) return;
      set.add(id);
    }
    onChange({ templateIds: Array.from(set) });
  };

  const atCap = value.templateIds.length >= MAX_TEMPLATES_PER_RUN;

  return (
    <StepShell heading="Settings" helper="Templates fan out across selected products. CTA + tracking params apply to every rendered ad.">
      <VStack align="stretch" spacing={5}>
        {/* Templates */}
        <Box>
          <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" mb={2}>
            Templates ({value.templateIds.length} of {MAX_TEMPLATES_PER_RUN} selected)
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={3}>
            {TEMPLATES.map(t => {
              const selected = value.templateIds.includes(t.id);
              const disabled = !!t.disabled;
              const capLocked = !selected && !disabled && atCap;
              const inactive = disabled || capLocked;
              return (
                <Card
                  key={t.id}
                  variant="outline"
                  onClick={inactive ? undefined : () => toggleTemplate(t.id)}
                  cursor={inactive ? 'not-allowed' : 'pointer'}
                  borderColor={selected ? 'rsViolet.400' : 'brand.border'}
                  bg={selected ? 'rsViolet.50' : 'brand.surface'}
                  opacity={disabled ? 0.45 : (capLocked ? 0.7 : 1)}
                  transition="all 120ms"
                  _hover={inactive ? undefined : { borderColor: 'rsViolet.300' }}
                  aria-disabled={inactive}
                >
                  <CardBody p={3}>
                    <Schematic kind={t.schematic} />
                    <HStack justify="space-between" mt={3} spacing={2}>
                      <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{t.label}</Text>
                      <Tag size="sm" colorScheme="purple" variant="subtle" flexShrink={0}>{t.emphasis}</Tag>
                    </HStack>
                    <Text fontSize="11px" color="brand.muted" mt={1} noOfLines={3}>{t.description}</Text>
                    <Text fontSize="10px" color="brand.muted" mt={2} fontFamily="mono">
                      {t.ratios.join(' · ')}
                    </Text>
                    {selected && (
                      <Tag mt={2} size="sm" colorScheme="green" variant="subtle">
                        <TagLeftIcon as={CheckIcon} />
                        <TagLabel>Selected</TagLabel>
                      </Tag>
                    )}
                    {disabled && (
                      <Tag mt={2} size="sm" colorScheme="gray" variant="subtle">
                        <TagLabel>Coming soon</TagLabel>
                      </Tag>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </SimpleGrid>
        </Box>

        {/* CTA */}
        <HStack align="flex-start" spacing={4}>
          <FormControl flex={1}>
            <FormLabel fontSize="sm">CTA text</FormLabel>
            <Input
              size="sm"
              value={value.ctaText}
              onChange={e => onChange({ ctaText: e.target.value })}
              placeholder="Shop Now"
              maxLength={32}
            />
            <Text fontSize="10px" color="brand.muted" mt={1}>Max 32 chars · appears as the button label.</Text>
          </FormControl>
          <FormControl flex={2}>
            <FormLabel fontSize="sm">Landing URL</FormLabel>
            <Input
              size="sm"
              value={value.ctaUrl}
              onChange={e => onChange({ ctaUrl: e.target.value })}
              placeholder="https://yourbrand.com/collection"
            />
            <Text fontSize="10px" color="brand.muted" mt={1}>The CTA links here, with tracking params appended below.</Text>
          </FormControl>
        </HStack>

        {/* URL params */}
        <FormControl>
          <FormLabel fontSize="sm">URL tracking params</FormLabel>
          <Textarea
            size="sm"
            rows={2}
            value={value.urlParams}
            onChange={e => onChange({ urlParams: e.target.value })}
            placeholder="utm_source=meta&utm_medium=cpc&utm_campaign=summer24"
            fontFamily="mono"
            fontSize="11px"
          />
          <Text fontSize="10px" color="brand.muted" mt={1}>
            Appended to the landing URL with a leading <code>?</code> or <code>&amp;</code> as needed.
            Defaults pull from the selected campaign's tracking config once that wiring lands.
          </Text>
        </FormControl>
      </VStack>
    </StepShell>
  );
}

// Schematic mini-preview — a 1:1 SVG illustration of each template's
// zone layout. Not a real render; conveys layout character (where the
// media sits, where copy sits, full-bleed vs split) so the operator
// can pick visually. Real reference images can swap in later.
function Schematic({ kind }: { kind: TemplateOption['schematic'] }) {
  const PALETTE = {
    bg:        '#F7F5FB',     // canvas
    media:     '#1F1F2E',     // photo region
    panel:     '#FFFFFF',     // copy panel
    panelEdge: '#D9D5E6',
    text:      '#9A93B5',     // copy bars
    cta:       '#7C3AED',     // CTA pill (rsViolet)
    overlay:   'rgba(255,255,255,0.92)',
    overlayEdge: 'rgba(255,255,255,0.6)'
  };

  return (
    <Box
      role="img"
      aria-label="Layout schematic"
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="md"
      overflow="hidden"
      bg={PALETTE.bg}
    >
      <svg viewBox="0 0 100 100" width="100%" height="auto" style={{ display: 'block' }}>
        {kind === 'spotlight' && <SpotlightSchematic p={PALETTE} />}
        {kind === 'split' && <SplitSchematic p={PALETTE} />}
        {kind === 'testimonial-overlay' && <TestimonialOverlaySchematic p={PALETTE} />}
        {kind === 'product-overlay' && <ProductOverlaySchematic p={PALETTE} />}
        {kind === 'ai' && <AiSchematic p={PALETTE} />}
      </svg>
    </Box>
  );
}

type Pal = {
  bg: string; media: string; panel: string; panelEdge: string;
  text: string; cta: string; overlay: string; overlayEdge: string;
};

// AI-generated layout — no fixed zone arrangement. Schematic shows a
// "?" inside a panel with a sparkle motif to convey "designed at
// render time" rather than predicting a specific composition.
function AiSchematic({ p }: { p: Pal }) {
  return (
    <g>
      {/* dashed-border canvas frame */}
      <rect x="4" y="10" width="92" height="80" rx="3"
        fill={p.bg}
        stroke={p.cta}
        strokeWidth="0.8"
        strokeDasharray="2 1.5"
      />
      {/* gradient hero-suggestion stripe */}
      <rect x="10" y="16" width="80" height="34" rx="2" fill={p.media} opacity="0.85" />
      {/* sparkle */}
      <g transform="translate(50, 33)" fill={p.cta}>
        <polygon points="0,-7 1.6,-1.6 7,0 1.6,1.6 0,7 -1.6,1.6 -7,0 -1.6,-1.6" />
        <circle cx="13" cy="-9" r="1.4" />
        <circle cx="-12" cy="10" r="1.2" />
      </g>
      {/* copy bars (sketch — actual zones come from LLM) */}
      <rect x="10" y="56" width="60" height="3" rx="1" fill={p.text} />
      <rect x="10" y="62" width="42" height="3" rx="1" fill={p.text} opacity="0.7" />
      {/* AI label chip */}
      <rect x="10" y="74" width="20" height="9" rx="2" fill={p.cta} />
      <text x="20" y="80.2" fontSize="5" fontWeight="800" textAnchor="middle" fill="#fff" fontFamily="-apple-system, system-ui, sans-serif">AI</text>
      {/* cta pill */}
      <rect x="68" y="74" width="22" height="9" rx="4.5" fill={p.cta} />
    </g>
  );
}

// Quote-first editorial: support media on the left, panel with quote
// card + CTA on the right.
function SpotlightSchematic({ p }: { p: Pal }) {
  return (
    <g>
      {/* support media (left third) */}
      <rect x="4" y="10" width="32" height="80" rx="3" fill={p.media} />
      {/* panel (right two-thirds) */}
      <rect x="40" y="10" width="56" height="80" rx="3" fill={p.panel} stroke={p.panelEdge} strokeWidth="0.5" />
      {/* eyebrow */}
      <rect x="46" y="18" width="20" height="2" rx="1" fill={p.text} opacity="0.5" />
      {/* headline */}
      <rect x="46" y="24" width="44" height="3" rx="1" fill={p.text} />
      <rect x="46" y="29" width="36" height="3" rx="1" fill={p.text} />
      {/* quote card */}
      <rect x="46" y="40" width="44" height="22" rx="2" fill={p.bg} stroke={p.panelEdge} strokeWidth="0.4" />
      <rect x="49" y="44" width="38" height="2" rx="1" fill={p.text} opacity="0.7" />
      <rect x="49" y="48" width="34" height="2" rx="1" fill={p.text} opacity="0.7" />
      <rect x="49" y="52" width="26" height="2" rx="1" fill={p.text} opacity="0.7" />
      {/* proof bar (stars) */}
      <rect x="46" y="66" width="24" height="2" rx="1" fill={p.text} opacity="0.5" />
      {/* cta pill */}
      <rect x="46" y="76" width="22" height="7" rx="3.5" fill={p.cta} />
    </g>
  );
}

// UGC split: media left half, copy + product card + CTA right half.
function SplitSchematic({ p }: { p: Pal }) {
  return (
    <g>
      {/* media left half */}
      <rect x="4" y="10" width="44" height="80" rx="3" fill={p.media} />
      {/* panel right half */}
      <rect x="52" y="10" width="44" height="80" rx="3" fill={p.panel} stroke={p.panelEdge} strokeWidth="0.5" />
      {/* headline */}
      <rect x="56" y="18" width="34" height="3" rx="1" fill={p.text} />
      <rect x="56" y="23" width="28" height="3" rx="1" fill={p.text} />
      {/* quote/caption */}
      <rect x="56" y="32" width="34" height="2" rx="1" fill={p.text} opacity="0.6" />
      <rect x="56" y="36" width="30" height="2" rx="1" fill={p.text} opacity="0.6" />
      {/* product card */}
      <rect x="56" y="46" width="34" height="20" rx="2" fill={p.bg} stroke={p.panelEdge} strokeWidth="0.4" />
      <rect x="58" y="48" width="14" height="16" rx="1" fill={p.media} opacity="0.7" />
      <rect x="74" y="50" width="14" height="2" rx="1" fill={p.text} />
      <rect x="74" y="54" width="10" height="2" rx="1" fill={p.text} opacity="0.6" />
      <rect x="74" y="58" width="8" height="3" rx="1" fill={p.cta} opacity="0.4" />
      {/* cta */}
      <rect x="56" y="76" width="22" height="7" rx="3.5" fill={p.cta} />
    </g>
  );
}

// Image-first testimonial overlay: full-bleed media with floating
// logo (top), headline (mid), quote (mid-low), CTA (bottom).
function TestimonialOverlaySchematic({ p }: { p: Pal }) {
  return (
    <g>
      {/* full-bleed media */}
      <rect x="4" y="10" width="92" height="80" rx="3" fill={p.media} />
      {/* logo top-left */}
      <rect x="9" y="15" width="14" height="5" rx="1" fill={p.overlay} />
      {/* headline middle */}
      <rect x="9" y="34" width="60" height="4" rx="1" fill={p.overlay} />
      <rect x="9" y="40" width="48" height="4" rx="1" fill={p.overlay} />
      {/* quote panel */}
      <rect x="9" y="54" width="72" height="20" rx="2" fill={p.overlay} stroke={p.overlayEdge} strokeWidth="0.4" />
      <rect x="12" y="58" width="64" height="2" rx="1" fill={p.text} opacity="0.7" />
      <rect x="12" y="62" width="60" height="2" rx="1" fill={p.text} opacity="0.7" />
      <rect x="12" y="66" width="40" height="2" rx="1" fill={p.text} opacity="0.7" />
      {/* cta bottom */}
      <rect x="9" y="80" width="22" height="6" rx="3" fill={p.cta} />
    </g>
  );
}

// Image-first product overlay: full-bleed media + floating product
// card (image + name + price) + CTA.
function ProductOverlaySchematic({ p }: { p: Pal }) {
  return (
    <g>
      {/* full-bleed media */}
      <rect x="4" y="10" width="92" height="80" rx="3" fill={p.media} />
      {/* logo top-left */}
      <rect x="9" y="15" width="14" height="5" rx="1" fill={p.overlay} />
      {/* headline middle */}
      <rect x="9" y="34" width="56" height="4" rx="1" fill={p.overlay} />
      <rect x="9" y="40" width="42" height="4" rx="1" fill={p.overlay} />
      {/* product card bottom-left */}
      <rect x="9" y="58" width="50" height="22" rx="2" fill={p.overlay} stroke={p.overlayEdge} strokeWidth="0.4" />
      <rect x="11" y="60" width="16" height="18" rx="1" fill={p.media} opacity="0.6" />
      <rect x="29" y="62" width="26" height="2" rx="1" fill={p.text} />
      <rect x="29" y="66" width="22" height="2" rx="1" fill={p.text} opacity="0.7" />
      <rect x="29" y="72" width="14" height="3" rx="1" fill={p.cta} opacity="0.5" />
      {/* cta bottom-right */}
      <rect x="69" y="80" width="22" height="6" rx="3" fill={p.cta} />
    </g>
  );
}

function CheckIcon() {
  return <Icon viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></Icon>;
}
