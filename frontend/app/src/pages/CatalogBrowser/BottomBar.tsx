// Bottom action bar — Add to Campaign + Generate Ads.
// Mirrors MediaLibrary/BottomBar so both pages share the same
// "select an item → act on it from the bottom" pattern.

import { HStack, Box, Text, Badge, Button } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { CatalogDetail } from './types';
import { sourceTone } from './format';
import { AddToCampaignMenu } from '../MediaLibrary/AddToCampaignMenu';

type Props = {
  product:      CatalogDetail | null;
  totalMatches: number;
};

export function BottomBar({ product, totalMatches }: Props) {
  const navigate = useNavigate();
  if (!product) {
    return (
      <Box
        h="64px"
        bg="brand.surface"
        borderTopWidth="1px"
        borderTopColor="brand.border"
      />
    );
  }
  const tone = sourceTone(product.source);

  return (
    <HStack
      h="64px"
      px={5}
      bg="brand.surface"
      borderTopWidth="1px"
      borderTopColor="brand.border"
      spacing={3}
    >
      <Text fontSize="sm" color="brand.muted">1 product selected</Text>
      <Badge
        variant="subtle"
        fontSize="10px"
        px={2}
        borderRadius="md"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {tone.label}
      </Badge>
      {totalMatches > 0 && (
        <Badge fontSize="10px" variant="subtle" colorScheme="purple">
          {totalMatches} match{totalMatches === 1 ? '' : 'es'}
        </Badge>
      )}

      <Box flex={1} />

      <AddToCampaignMenu productIds={[product.id]} />

      <Button
        variant="brand"
        size="sm"
        onClick={() => navigate(`/generate-ads?productIds=${encodeURIComponent(product.id)}`)}
      >
        Generate Ads →
      </Button>
    </HStack>
  );
}
