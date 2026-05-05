// Phase 4a — Visual Identity (read-only).
// Shows logo + four color swatches + font family. Edit affordances
// (logo upload, color picker, font picker) ship in Phase 4b.

import { Card, CardBody, HStack, VStack, Text, Box, Image, Heading, Input, Button, SimpleGrid } from '@chakra-ui/react';
import type { Brand } from './types';

export function VisualIdentityCard({ brand }: { brand: Brand }) {
  const swatches: Array<{ label: string; hex: string | null | undefined; key: string }> = [
    { label: 'Primary',   hex: brand.primaryColor,   key: 'primary' },
    { label: 'Secondary', hex: brand.secondaryColor, key: 'secondary' },
    { label: 'Accent',    hex: brand.accentColor,    key: 'accent' },
    { label: 'Text',      hex: brand.fontColor,      key: 'text' }
  ];

  return (
    <Card variant="outline" h="100%">
      <CardBody>
        <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" mb={4}>Visual Identity</Heading>

        <VStack align="stretch" spacing={4}>
          {/* Logo + URL */}
          <Box>
            <Text fontSize="xs" color="brand.muted" mb={1.5}>Logo</Text>
            <HStack align="center" spacing={3}>
              <Box
                w="56px" h="56px"
                borderRadius="md"
                bg={brand.primaryColor || 'gray.100'}
                border="1px solid"
                borderColor="brand.border"
                display="flex" alignItems="center" justifyContent="center"
                overflow="hidden"
                flexShrink={0}
              >
                {brand.logoUrl
                  ? <Image src={brand.logoUrl} alt={brand.name} maxW="100%" maxH="100%" objectFit="contain" />
                  : <Text color="white" fontSize="lg" fontWeight="800" opacity={0.6}>{brand.name?.charAt(0).toUpperCase() || '?'}</Text>}
              </Box>
              <Input
                size="sm"
                value={brand.logoUrl || ''}
                isReadOnly
                fontFamily="mono"
                fontSize="11px"
                placeholder="(no logo)"
              />
            </HStack>
          </Box>

          {/* Color swatches */}
          <SimpleGrid columns={4} spacing={2}>
            {swatches.map(s => <Swatch key={s.key} label={s.label} hex={s.hex} />)}
          </SimpleGrid>

          {/* Font family */}
          <Box>
            <Text fontSize="xs" color="brand.muted" mb={1.5}>Font Family</Text>
            <HStack spacing={2}>
              <Input
                size="sm"
                value={brand.fontFamily || ''}
                isReadOnly
                placeholder="(none)"
                fontFamily={brand.fontFamily || undefined}
              />
              <Button size="sm" variant="outline" isDisabled title="Edit ships in Phase 4b">
                Change
              </Button>
            </HStack>
            {brand.fontSource && (
              <Text fontSize="9px" color="brand.muted" mt={1}>source: {brand.fontSource}</Text>
            )}
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}

function Swatch({ label, hex }: { label: string; hex: string | null | undefined }) {
  const valid = typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex);
  return (
    <VStack spacing={1.5} align="center">
      <Box
        w="100%"
        h="40px"
        borderRadius="md"
        border="1px solid"
        borderColor="brand.border"
        bg={valid ? hex : 'gray.100'}
      />
      <Text fontSize="10px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">{label}</Text>
      <Text fontSize="10px" color="brand.ink" fontFamily="mono">{valid ? hex.toUpperCase() : '—'}</Text>
    </VStack>
  );
}
