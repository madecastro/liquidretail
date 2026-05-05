// Phase A-1 — bottom action bar. Delete (cascade) + Continue to Ad
// Generation are wired; Request Rights and Add to Collection are
// scaffolded as disabled-with-tooltip CTAs since they belong to A-3.

import { HStack, Box, Text, Badge, Button, Tooltip } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { MediaListRow } from './types';
import { matchLevelTone } from './format';

type Props = {
  selected: MediaListRow | null;
  onDelete: () => void;
};

export function BottomBar({ selected, onDelete }: Props) {
  const navigate = useNavigate();
  if (!selected) return <Box h="64px" bg="brand.surface" borderTopWidth="1px" borderTopColor="brand.border" />;
  const tone = matchLevelTone(selected.matchLevel);

  return (
    <HStack
      h="64px"
      px={5}
      bg="brand.surface"
      borderTopWidth="1px"
      borderTopColor="brand.border"
      spacing={3}
    >
      <Text fontSize="sm" color="brand.muted">1 media selected</Text>
      <Badge
        variant="subtle"
        fontSize="10px"
        px={2}
        borderRadius="md"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {tone.label}
      </Badge>

      <Box flex={1} />

      <Button variant="outline" size="sm" colorScheme="red" onClick={onDelete}>Delete</Button>

      <Tooltip label="Rights workflow ships in Phase A-3" hasArrow>
        <Button variant="outline" size="sm" isDisabled>Request Rights</Button>
      </Tooltip>

      <Tooltip label="Collections ship in Phase A-3" hasArrow>
        <Button variant="outline" size="sm" isDisabled>Add to Collection</Button>
      </Tooltip>

      <Button
        variant="brand"
        size="sm"
        onClick={() => navigate(`/ads?mediaId=${selected.mediaId}`)}
      >
        Continue to Ad Generation →
      </Button>
    </HStack>
  );
}
