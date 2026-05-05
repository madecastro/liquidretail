// Phase A-1 — left rail: paginated media list. Each row is selectable;
// the active selection lifts to the parent so the canvas + right panel
// re-render against it.

import { Box, Flex, Text, Image, VStack, HStack, Badge, Button, Spinner, Icon } from '@chakra-ui/react';
import type { MediaListRow } from './types';
import { timeAgo, deriveTitle, matchLevelTone } from './format';

type Props = {
  rows:        MediaListRow[];
  total:       number;
  loading:     boolean;
  hasMore:     boolean;
  selectedId:  string | null;
  onSelect:    (mediaId: string) => void;
  onLoadMore:  () => void;
};

export function Sidebar({ rows, total, loading, hasMore, selectedId, onSelect, onLoadMore }: Props) {
  return (
    <Flex
      direction="column"
      w="320px"
      flexShrink={0}
      bg="brand.surface"
      borderRightWidth="1px"
      borderRightColor="brand.border"
      h="100%"
      minH={0}
    >
      <Flex
        px={5}
        py={4}
        borderBottomWidth="1px"
        borderBottomColor="brand.border"
        align="baseline"
        justify="space-between"
      >
        <Box>
          <Text fontSize="md" fontWeight="800" color="brand.ink">Uploaded Media</Text>
          <Text fontSize="xs" color="brand.muted">{total} item{total === 1 ? '' : 's'}</Text>
        </Box>
      </Flex>

      <Box flex={1} overflowY="auto" px={3} py={3}>
        {loading && rows.length === 0 ? (
          <Flex align="center" justify="center" py={10}><Spinner color="brand.muted" /></Flex>
        ) : rows.length === 0 ? (
          <Box px={3} py={10} textAlign="center">
            <Text fontSize="sm" color="brand.muted">No media yet for this brand.</Text>
            <Text fontSize="xs" color="brand.muted" mt={2}>Upload an image or sync from Instagram to get started.</Text>
          </Box>
        ) : (
          <VStack align="stretch" spacing={2}>
            {rows.map(r => (
              <SidebarRow
                key={r.mediaId}
                row={r}
                isActive={r.mediaId === selectedId}
                onClick={() => onSelect(r.mediaId)}
              />
            ))}
            {hasMore && (
              <Button onClick={onLoadMore} isLoading={loading} variant="ghost" size="sm" mt={2}>
                Load more
              </Button>
            )}
          </VStack>
        )}
      </Box>
    </Flex>
  );
}

function SidebarRow({ row, isActive, onClick }: { row: MediaListRow; isActive: boolean; onClick: () => void }) {
  const title = deriveTitle(row);
  const matchTone = matchLevelTone(row.matchLevel);
  const isVideo = row.fileType === 'video';

  return (
    <Box
      onClick={onClick}
      cursor="pointer"
      borderRadius="lg"
      borderWidth="1px"
      borderColor={isActive ? 'rsViolet.300' : 'brand.border'}
      bg={isActive ? 'rsViolet.50' : 'brand.surface'}
      p={2}
      transition="border-color 120ms, background 120ms"
      _hover={{ borderColor: isActive ? 'rsViolet.300' : 'gray.300' }}
    >
      <HStack spacing={3} align="stretch">
        <Box
          w="56px" h="56px"
          flexShrink={0}
          borderRadius="md"
          overflow="hidden"
          bg="gray.100"
          position="relative"
        >
          {row.fileUrl && (
            <Image
              src={row.fileUrl}
              alt={title}
              w="100%" h="100%"
              objectFit="cover"
              loading="lazy"
            />
          )}
          {isVideo && (
            <Flex
              position="absolute" inset={0}
              bg="blackAlpha.500"
              align="center" justify="center"
              color="white"
              fontSize="lg"
              borderRadius="md"
            >
              <PlayIcon />
            </Flex>
          )}
        </Box>

        <Box flex={1} minW={0}>
          <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{title}</Text>
          {row.creatorHandle && (
            <Text fontSize="xs" color="brand.muted" noOfLines={1}>{row.creatorHandle}</Text>
          )}
          <HStack mt={1} spacing={2}>
            <Badge
              variant="subtle"
              fontSize="9px"
              px={1.5}
              borderRadius="md"
              style={{ background: matchTone.bg, color: matchTone.fg }}
            >
              {matchTone.label}
            </Badge>
            <Text fontSize="10px" color="brand.muted">{timeAgo(row.createdAt)}</Text>
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}

function PlayIcon() {
  return (
    <Icon viewBox="0 0 24 24" w={5} h={5}><path fill="currentColor" d="M8 5v14l11-7z" /></Icon>
  );
}
