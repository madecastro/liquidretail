// Phase 4 follow-up #3 — left rail: paginated catalog with thumb,
// title, price, source pill, draft pill, match count, and a small
// filter row at top (search + source select + drafts toggle).

import { Box, Flex, Text, Image, VStack, HStack, Badge, Button, Spinner, Input, Select, IconButton, Icon, Checkbox } from '@chakra-ui/react';
import type { CatalogListRow } from './types';
import { sourceTone, formatPrice, timeAgo } from './format';

type Filters = {
  q?:           string;
  source?:      string;
  category?:    string;
  inStock?:     boolean;
  hasReviews?:  boolean;
  showVariants?: boolean;
};

type Props = {
  rows:         CatalogListRow[];
  total:        number;
  totalDrafts:  number;
  loading:      boolean;
  hasMore:      boolean;
  selectedId:   string | null;
  filters:      Filters;
  categories:   string[];
  onSelect:     (productId: string) => void;
  onLoadMore:   () => void;
  onFilters:    (next: Filters) => void;
};

export function Sidebar({
  rows, total, totalDrafts, loading, hasMore, selectedId, filters, categories,
  onSelect, onLoadMore, onFilters
}: Props) {
  return (
    <Flex
      direction="column"
      w="340px"
      flexShrink={0}
      bg="brand.surface"
      borderRightWidth="1px"
      borderRightColor="brand.border"
      h="100%"
      minH={0}
    >
      <Box px={4} py={3} borderBottomWidth="1px" borderBottomColor="brand.border">
        <HStack justify="space-between" mb={2}>
          <Text fontSize="md" fontWeight="800" color="brand.ink">Catalog</Text>
          <HStack spacing={1}>
            <Text fontSize="xs" color="brand.muted">{total}</Text>
            {totalDrafts > 0 && (
              <Badge variant="subtle" colorScheme="orange" fontSize="9px">{totalDrafts} draft{totalDrafts === 1 ? '' : 's'}</Badge>
            )}
          </HStack>
        </HStack>

        <VStack spacing={2} align="stretch">
          <HStack spacing={1}>
            <Box position="relative" flex={1}>
              <Input
                size="sm"
                placeholder="Search title or description…"
                value={filters.q || ''}
                onChange={e => onFilters({ ...filters, q: e.target.value || undefined })}
              />
              {filters.q && (
                <IconButton
                  aria-label="Clear search"
                  size="xs"
                  variant="ghost"
                  position="absolute"
                  right={1}
                  top="50%"
                  transform="translateY(-50%)"
                  onClick={() => onFilters({ ...filters, q: undefined })}
                  icon={<Box as="span" fontSize="11px">×</Box>}
                />
              )}
            </Box>
          </HStack>
          <HStack spacing={2}>
            <Select
              size="xs"
              value={filters.source || ''}
              onChange={e => onFilters({ ...filters, source: e.target.value || undefined })}
            >
              <option value="">All sources</option>
              <option value="ig-catalog">Meta Catalog</option>
              <option value="manual-upload">Manual</option>
              <option value="detect-identified">Detect-identified</option>
              <option value="draft">Drafts only</option>
            </Select>
            {categories.length > 0 && (
              <Select
                size="xs"
                value={filters.category || ''}
                onChange={e => onFilters({ ...filters, category: e.target.value || undefined })}
              >
                <option value="">All categories</option>
                {categories.slice(0, 50).map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
          </HStack>
          <Checkbox
            size="sm"
            isChecked={!!filters.showVariants}
            onChange={e => onFilters({ ...filters, showVariants: e.target.checked || undefined })}
          >
            <Text fontSize="xs" color="brand.muted">Show all variants</Text>
          </Checkbox>
        </VStack>
      </Box>

      <Box flex={1} overflowY="auto" px={3} py={3}>
        {loading && rows.length === 0 ? (
          <Flex align="center" justify="center" py={10}><Spinner color="brand.muted" /></Flex>
        ) : rows.length === 0 ? (
          <Box px={3} py={10} textAlign="center">
            <Text fontSize="sm" color="brand.muted">No catalog products match.</Text>
            <Text fontSize="xs" color="brand.muted" mt={2}>Try clearing the filters or syncing a Meta Catalog.</Text>
          </Box>
        ) : (
          <VStack align="stretch" spacing={2}>
            {rows.map(r => (
              <SidebarRow
                key={r.id}
                row={r}
                isActive={r.id === selectedId}
                onClick={() => onSelect(r.id)}
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

function SidebarRow({ row, isActive, onClick }: { row: CatalogListRow; isActive: boolean; onClick: () => void }) {
  const tone = sourceTone(row.source);
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
        <Box w="56px" h="56px" flexShrink={0} borderRadius="md" overflow="hidden" bg="gray.100">
          {row.imageUrl && <Image src={row.imageUrl} alt={row.title} w="100%" h="100%" objectFit="cover" loading="lazy" />}
        </Box>
        <Box flex={1} minW={0}>
          <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{row.title}</Text>
          <HStack spacing={2} mt={0.5}>
            <Text fontSize="xs" color="brand.muted">{formatPrice(row.price, row.currency)}</Text>
            {typeof row.rating === 'number' && (
              <HStack spacing={0.5}>
                <StarIcon />
                <Text fontSize="xs" color="brand.muted">{row.rating.toFixed(1)}</Text>
              </HStack>
            )}
          </HStack>
          <HStack mt={1} spacing={1.5} wrap="wrap">
            <Badge fontSize="9px" variant="subtle" px={1.5} borderRadius="md" style={{ background: tone.bg, color: tone.fg }}>
              {tone.label}
            </Badge>
            {row.draft && <Badge fontSize="9px" variant="subtle" colorScheme="orange">Draft</Badge>}
            {row.variantCount > 0 && (
              <Badge fontSize="9px" variant="subtle" colorScheme="blue">+{row.variantCount} variant{row.variantCount === 1 ? '' : 's'}</Badge>
            )}
            {!row.isPrimaryVariant && (
              <Badge fontSize="9px" variant="subtle" colorScheme="gray">Variant</Badge>
            )}
            {row.matchCount > 0 && <Badge fontSize="9px" variant="subtle" colorScheme="purple">{row.matchCount} match{row.matchCount === 1 ? '' : 'es'}</Badge>}
            <Text fontSize="9px" color="brand.muted">{timeAgo(row.lastSyncedAt)}</Text>
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}

function StarIcon() { return <Icon viewBox="0 0 24 24" w="10px" h="10px" color="#F59E0B"><path fill="currentColor" d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5l-6.3 4.5L8 13.9 2 9.4h7.6z" /></Icon>; }
