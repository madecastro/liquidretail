// Phase 4a — Audience Personas (display only).
// Lists each demographic persona with a colored icon tile + name +
// description. Avatar generation (#24 backlog) and inline edit ship in
// Phase 4b. The icon palette cycles deterministically so personas keep
// stable visual identity across renders.

import { Card, CardBody, VStack, HStack, Box, Text, Heading, Button, Icon } from '@chakra-ui/react';
import type { Brand, BrandDemographic } from './types';

const PERSONA_TONES = [
  { bg: 'rgba(122,53,232,0.10)',  fg: '#6B21A8' },   // violet
  { bg: 'rgba(245,124,0,0.10)',   fg: '#B45309' },   // orange
  { bg: 'rgba(16,184,216,0.10)',  fg: '#0E7490' },   // cyan
  { bg: 'rgba(16,185,129,0.10)',  fg: '#047857' },   // green
  { bg: 'rgba(217,0,141,0.10)',   fg: '#9D174D' },   // magenta
  { bg: 'rgba(255,212,0,0.14)',   fg: '#92400E' }    // yellow
];

export function AudiencePersonasCard({ brand }: { brand: Brand }) {
  const personas = (brand.demographics || []).slice(0, 6);
  return (
    <Card variant="outline" h="100%">
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em">Audience Personas</Heading>
          <Button size="xs" variant="outline" isDisabled title="Persona editor lands in Phase 4b">Edit Personas</Button>
        </HStack>

        {personas.length === 0 ? (
          <Text fontSize="xs" color="brand.muted" fontStyle="italic">
            Personas populate during enrichment. Refresh AI to retry, or edit manually in Phase 4b.
          </Text>
        ) : (
          <VStack align="stretch" spacing={3}>
            {personas.map((p, i) => (
              <PersonaRow
                key={p.name || i}
                persona={p}
                tone={PERSONA_TONES[i % PERSONA_TONES.length]}
              />
            ))}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}

function PersonaRow({
  persona, tone
}: {
  persona: BrandDemographic;
  tone: { bg: string; fg: string };
}) {
  return (
    <HStack align="flex-start" spacing={3}>
      <Box
        w="40px" h="40px"
        flexShrink={0}
        borderRadius="md"
        bg={tone.bg}
        display="flex"
        alignItems="center"
        justifyContent="center"
        color={tone.fg}
      >
        <PersonaIcon />
      </Box>
      <Box flex={1} minW={0}>
        <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>
          {persona.name || '(unnamed persona)'}
        </Text>
        {persona.description && (
          <Text fontSize="xs" color="brand.muted" lineHeight="1.5" noOfLines={2}>
            {persona.description}
          </Text>
        )}
      </Box>
    </HStack>
  );
}

function PersonaIcon() {
  return (
    <Icon viewBox="0 0 24 24" w="20px" h="20px">
      <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Icon>
  );
}
