// Phase A-1 — top metadata strip above the canvas.
// Filename · source pill · creator handle · engagement counts · time ago.

import { HStack, Badge, Text, IconButton, Icon, Box, Link } from '@chakra-ui/react';
import type { MediaListRow } from './types';
import { SOURCE_PILL_LABEL, timeAgo, compactNumber, detectOutcomeTone } from './format';

type Props = {
  row: MediaListRow;
  // platformStats not currently in the list payload — caller can fill
  // these from the detect detail when wiring the next pass. Optional
  // for now so A-1 ships without that round-trip.
  likes?:    number | null;
  comments?: number | null;
};

export function MediaHeader({ row, likes, comments }: Props) {
  const title = row.fileName || row.externalId;
  const sourceLabel = SOURCE_PILL_LABEL[row.source] || row.source;
  const outcome = detectOutcomeTone(row.detectOutcome);
  const isIgSourced = row.source === 'instagram';

  return (
    <HStack spacing={3} align="center" px={5} py={3} borderBottomWidth="1px" borderBottomColor="brand.border" bg="brand.surface">
      <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1} maxW="320px">{title}</Text>

      <Badge variant="subtle" fontSize="10px" px={2} py={0.5} borderRadius="md">{sourceLabel}</Badge>

      {row.creatorHandle && (
        <Text fontSize="xs" color="brand.muted">{row.creatorHandle}</Text>
      )}

      {isIgSourced && (
        <HStack spacing={3} ml={2}>
          <HStack spacing={1}>
            <HeartIcon /><Text fontSize="xs" color="brand.muted">{compactNumber(likes ?? null)}</Text>
          </HStack>
          <HStack spacing={1}>
            <CommentIcon /><Text fontSize="xs" color="brand.muted">{compactNumber(comments ?? null)}</Text>
          </HStack>
        </HStack>
      )}

      {(row.postedAt || row.createdAt) && (
        <Text fontSize="xs" color="brand.muted">{timeAgo(row.postedAt || row.createdAt)}</Text>
      )}

      {outcome && (
        <Badge
          variant="subtle"
          fontSize="10px"
          px={2}
          py={0.5}
          borderRadius="md"
          style={{ background: outcome.bg, color: outcome.fg }}
        >
          {outcome.label}
        </Badge>
      )}

      <Box flex={1} />

      {row.permalink && (
        <Link href={row.permalink} isExternal fontSize="xs" color="brand.muted">View original</Link>
      )}

      <IconButton aria-label="More" variant="ghost" size="sm" icon={<KebabIcon />} />
    </HStack>
  );
}

function HeartIcon() {
  return (
    <Icon viewBox="0 0 24 24" w={3.5} h={3.5} color="brand.muted">
      <path fill="currentColor" d="M12 21s-7-4.5-9.5-9.5C.7 7.7 3 4 6.5 4c2 0 3.6 1 5.5 3 1.9-2 3.5-3 5.5-3 3.5 0 5.8 3.7 4 7.5C19 16.5 12 21 12 21z" />
    </Icon>
  );
}

function CommentIcon() {
  return (
    <Icon viewBox="0 0 24 24" w={3.5} h={3.5} color="brand.muted">
      <path fill="currentColor" d="M21 6h-2V4H3v12h2v4l4-4h12V6zm-2 8H8.2L7 15.2V14H5V6h14v8z" />
    </Icon>
  );
}

function KebabIcon() {
  return (
    <Icon viewBox="0 0 24 24" w={4} h={4}>
      <path fill="currentColor" d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
    </Icon>
  );
}
