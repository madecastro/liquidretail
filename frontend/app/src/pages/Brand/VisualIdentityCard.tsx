// Phase 4a — Visual Identity (read-only).
// Phase 4b — adds inline edit: logo URL becomes editable, color
// swatches expose a hex input + native color picker, font family
// becomes a free-text input. Save flows through useBrandEdit.

import { Card, CardBody, HStack, VStack, Text, Box, Image, Heading, Input, SimpleGrid, IconButton, Icon } from '@chakra-ui/react';
import type { Brand } from './types';
import type { BrandEdit } from './useBrandEdit';

export function VisualIdentityCard({ brand, edit }: { brand: Brand; edit: BrandEdit }) {
  const isEditing = edit.isEditing;

  const logoUrl   = (edit.valueOf('logoUrl')        as string | null) ?? '';
  const primary   = (edit.valueOf('primaryColor')   as string | null) ?? '';
  const secondary = (edit.valueOf('secondaryColor') as string | null) ?? '';
  const accent    = (edit.valueOf('accentColor')    as string | null) ?? '';
  const fontColor = (edit.valueOf('fontColor')      as string | null) ?? '';
  const fontFam   = (edit.valueOf('fontFamily')     as string | null) ?? '';

  const swatches = [
    { label: 'Primary',   hex: primary,   set: (v: string) => edit.setField('primaryColor',   v || null) },
    { label: 'Secondary', hex: secondary, set: (v: string) => edit.setField('secondaryColor', v || null) },
    { label: 'Accent',    hex: accent,    set: (v: string) => edit.setField('accentColor',    v || null) },
    { label: 'Text',      hex: fontColor, set: (v: string) => edit.setField('fontColor',      v || null) }
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
                bg={primary || 'gray.100'}
                border="1px solid"
                borderColor="brand.border"
                display="flex" alignItems="center" justifyContent="center"
                overflow="hidden"
                flexShrink={0}
              >
                {logoUrl
                  ? <Image src={logoUrl} alt={brand.name} maxW="100%" maxH="100%" objectFit="contain" />
                  : <Text color="white" fontSize="lg" fontWeight="800" opacity={0.6}>{brand.name?.charAt(0).toUpperCase() || '?'}</Text>}
              </Box>
              <Input
                size="sm"
                value={logoUrl}
                onChange={e => edit.setField('logoUrl', e.target.value || null)}
                isReadOnly={!isEditing}
                fontFamily="mono"
                fontSize="11px"
                placeholder={isEditing ? 'https://cdn.../logo.png' : '(no logo)'}
              />
            </HStack>
          </Box>

          {/* Color swatches */}
          <SimpleGrid columns={4} spacing={2}>
            {swatches.map(s => (
              <Swatch
                key={s.label}
                label={s.label}
                hex={s.hex}
                isEditing={isEditing}
                onChange={s.set}
              />
            ))}
          </SimpleGrid>

          {/* Font family */}
          <Box>
            <Text fontSize="xs" color="brand.muted" mb={1.5}>Font Family</Text>
            <Input
              size="sm"
              value={fontFam}
              onChange={e => edit.setField('fontFamily', e.target.value || null)}
              isReadOnly={!isEditing}
              placeholder={isEditing ? 'e.g. Oswald, Inter, Playfair Display' : '(none)'}
              fontFamily={fontFam || undefined}
            />
            {brand.fontSource && !isEditing && (
              <Text fontSize="9px" color="brand.muted" mt={1}>source: {brand.fontSource}</Text>
            )}
            {isEditing && (
              <Text fontSize="9px" color="brand.muted" mt={1}>
                Saving sets fontSource to "curated" — protects from re-enrichment.
              </Text>
            )}
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}

function Swatch({
  label, hex, isEditing, onChange
}: {
  label: string;
  hex: string;
  isEditing: boolean;
  onChange: (value: string) => void;
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex);
  const bgValue = valid ? hex : 'gray.100';
  return (
    <VStack spacing={1.5} align="center">
      <Box position="relative" w="100%" h="40px" borderRadius="md" border="1px solid" borderColor="brand.border" bg={bgValue} overflow="hidden">
        {isEditing && (
          <>
            <input
              type="color"
              value={valid ? hex : '#ffffff'}
              onChange={e => onChange(e.target.value.toUpperCase())}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', opacity: 0 }}
              aria-label={`${label} color picker`}
            />
            <PaintIcon />
          </>
        )}
      </Box>
      <Text fontSize="10px" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em">{label}</Text>
      {isEditing ? (
        <HStack spacing={1}>
          <Input
            size="xs"
            value={hex}
            onChange={e => {
              const next = e.target.value.toUpperCase();
              if (next === '' || /^#[0-9a-fA-F]{0,6}$/.test(next)) onChange(next);
            }}
            placeholder="#FFFFFF"
            fontFamily="mono"
            fontSize="10px"
            textAlign="center"
            maxLength={7}
          />
          {hex && (
            <IconButton
              size="xs"
              aria-label={`Clear ${label}`}
              variant="ghost"
              minW="20px"
              h="20px"
              onClick={() => onChange('')}
              icon={<Box as="span" fontSize="11px" lineHeight={1}>×</Box>}
            />
          )}
        </HStack>
      ) : (
        <Text fontSize="10px" color="brand.ink" fontFamily="mono">{valid ? hex.toUpperCase() : '—'}</Text>
      )}
    </VStack>
  );
}

function PaintIcon() {
  return (
    <Box position="absolute" top={1} right={1} pointerEvents="none">
      <Icon viewBox="0 0 24 24" w="12px" h="12px" color="whiteAlpha.700">
        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </Icon>
    </Box>
  );
}
