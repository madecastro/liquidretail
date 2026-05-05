// Phase A-1 — filter chips above the canvas. Each chip toggles a
// specific overlay layer's visibility. Visual is a rounded button with
// a colored dot + label and a checkmark when active.

import { HStack, Box, Text, Button } from '@chakra-ui/react';
import { ALL_LAYER_KEYS, LAYER_LABELS, type LayerKey } from './types';

type Props = {
  active:   Set<LayerKey>;
  onToggle: (key: LayerKey) => void;
};

const LAYER_DOT: Record<LayerKey, string> = {
  products:     '#0B84D8',
  people:       '#7A35E8',
  text:         '#F57C00',
  'safe-zones': '#16B8D8',
  density:      '#DC2626',
  crops:        '#16A34A',
  palette:      '#FFD400'
};

export function FilterChips({ active, onToggle }: Props) {
  return (
    <HStack spacing={2} px={5} py={3} borderBottomWidth="1px" borderBottomColor="brand.border" bg="brand.surface">
      {ALL_LAYER_KEYS.map(key => {
        const isOn = active.has(key);
        return (
          <Button
            key={key}
            size="xs"
            variant="outline"
            borderRadius="lg"
            borderColor={isOn ? 'rsViolet.300' : 'brand.border'}
            bg={isOn ? 'rsViolet.50' : 'brand.surface'}
            color="brand.ink"
            fontWeight="600"
            onClick={() => onToggle(key)}
            _hover={{ bg: isOn ? 'rsViolet.50' : 'gray.50' }}
            px={3}
          >
            <HStack spacing={2}>
              <Box w="8px" h="8px" borderRadius="full" bg={LAYER_DOT[key]} />
              <Text fontSize="xs">{LAYER_LABELS[key]}</Text>
              {isOn && <CheckIcon />}
            </HStack>
          </Button>
        );
      })}
    </HStack>
  );
}

function CheckIcon() {
  return (
    <Box as="span" fontSize="10px" color="rsViolet.700" fontWeight="800">✓</Box>
  );
}
