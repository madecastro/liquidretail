// Step 3 — Settings.
//
// Three sub-fields the renderer needs:
//   1. Templates (multi-select) — which creative templates to fan out
//      across. The backend Phase 1 render service is still on the
//      backlog; for now this is a stub list with a few labeled tiles.
//   2. CTA — text + landing URL the rendered creative will link to.
//   3. URL params — querystring fragment appended to the CTA URL for
//      tracking (utm_source, utm_medium, …). Pre-filled from the
//      selected campaign's tracking config when available.
//
// Backend wiring (TODO): GET /api/templates and GET /api/campaigns/:id
// (for tracking-param defaults). Today this step's templates list is
// stubbed.

import { Box, VStack, HStack, Text, Input, Textarea, FormControl, FormLabel, Wrap, WrapItem, Card, CardBody, Tag, TagLabel, TagLeftIcon, Icon } from '@chakra-ui/react';
import type { WizardSelections } from './index';
import { StepShell } from './index';

type TemplateOption = {
  id:           string;
  label:        string;
  aspectRatio:  string;       // '1:1' | '9:16' | '4:5' | '1.91:1'
  description:  string;
};

// Hardcoded stub list — will become a /api/templates fetch.
const TEMPLATE_STUBS: TemplateOption[] = [
  { id: 'square-product',   label: 'Square Product',     aspectRatio: '1:1',    description: 'Centered SKU on brand-color background' },
  { id: 'story-vertical',   label: 'Story Vertical',     aspectRatio: '9:16',   description: 'Full-bleed product with overlay headline' },
  { id: 'feed-portrait',    label: 'Feed Portrait',      aspectRatio: '4:5',    description: 'Portrait crop with CTA strip' },
  { id: 'wide-banner',      label: 'Wide Banner',        aspectRatio: '1.91:1', description: 'Landscape banner with side-text layout' }
];

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step3Settings({ value, onChange }: Props) {
  const toggleTemplate = (id: string) => {
    const set = new Set(value.templateIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ templateIds: Array.from(set) });
  };

  return (
    <StepShell heading="Settings" helper="Templates fan out across selected products. CTA + tracking params apply to every rendered ad.">
      <VStack align="stretch" spacing={5}>
        {/* Templates */}
        <Box>
          <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" mb={2}>
            Templates ({value.templateIds.length} selected)
          </Text>
          <Wrap spacing={3}>
            {TEMPLATE_STUBS.map(t => {
              const selected = value.templateIds.includes(t.id);
              return (
                <WrapItem key={t.id}>
                  <Card
                    variant="outline"
                    onClick={() => toggleTemplate(t.id)}
                    cursor="pointer"
                    borderColor={selected ? 'rsViolet.400' : 'brand.border'}
                    bg={selected ? 'rsViolet.50' : 'brand.surface'}
                    transition="all 120ms"
                    _hover={{ borderColor: 'rsViolet.300' }}
                    w="220px"
                  >
                    <CardBody>
                      <HStack justify="space-between">
                        <Text fontSize="sm" fontWeight="700" color="brand.ink">{t.label}</Text>
                        <Tag size="sm" colorScheme="purple" variant="subtle">{t.aspectRatio}</Tag>
                      </HStack>
                      <Text fontSize="11px" color="brand.muted" mt={1}>{t.description}</Text>
                      {selected && (
                        <Tag mt={2} size="sm" colorScheme="green" variant="subtle">
                          <TagLeftIcon as={CheckIcon} />
                          <TagLabel>Selected</TagLabel>
                        </Tag>
                      )}
                    </CardBody>
                  </Card>
                </WrapItem>
              );
            })}
          </Wrap>
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

function CheckIcon() {
  return <Icon viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></Icon>;
}
