// Phase A-1 / A-3 — bottom action bar.
// Delete (cascade) + Continue to Ad Generation are wired.
// Add to Collection ships in A-3 (this commit).
// Request Rights stays disabled — tracked under the dedicated rights-
// management screen backlog row.

import { HStack, Box, Text, Badge, Button, Tooltip } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { MediaListRow } from './types';
import { matchLevelTone } from './format';
import { AddToCollectionMenu } from './AddToCollectionMenu';
import type { Collection } from './collectionsApi';

type Props = {
  selected:           MediaListRow | null;
  onDelete:           () => void;
  collections:        Collection[];
  onCollectionsChanged: () => void;
};

export function BottomBar({ selected, onDelete, collections, onCollectionsChanged }: Props) {
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

      <Tooltip label="Rights workflow lives in the dedicated rights screen (separate ticket)" hasArrow>
        <Button variant="outline" size="sm" isDisabled>Request Rights</Button>
      </Tooltip>

      <AddToCollectionMenu
        mediaIds={[selected.mediaId]}
        collections={collections}
        onChanged={onCollectionsChanged}
      />

      <Button
        variant="brand"
        size="sm"
        onClick={() => navigate(`/generate-ads?mediaIds=${encodeURIComponent(selected.mediaId)}`)}
      >
        Generate Ads →
      </Button>
    </HStack>
  );
}
