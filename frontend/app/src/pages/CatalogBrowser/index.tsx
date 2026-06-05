// Phase 4 follow-up #3 — Catalog Browser page entry.
//
// Mounted at /catalog. Same layout pattern as Media Library:
//   ┌─────────┬─────────────────────────────┬──────────┐
//   │         │ Header (title, source, ...) │          │
//   │ Sidebar │ Image gallery (primary +    │   Right  │
//   │  (340)  │   alt views + match crops)  │  Sidebar │
//   │         │                             │   (420)  │
//   └─────────┴─────────────────────────────┴──────────┘
// Right sidebar tabs: Summary · Reviews · Specs · Sellers · Matches.

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Box, Text } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { CatalogHeader } from './Header';
import { ImageGallery } from './ImageGallery';
import { RightSidebar } from './RightSidebar';
import { BottomBar } from './BottomBar';
import { CatalogErrorBoundary } from './ErrorBoundary';
import { useCatalogList, useCatalogDetail, useCatalogMatches } from './hooks';

export function CatalogBrowserPage() {
  const list = useCatalogList();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('productId');

  // Default-select the first row when none pinned via URL
  useEffect(() => {
    if (!selectedId && list.rows.length > 0) {
      setParams({ productId: list.rows[0].id }, { replace: true });
    }
  }, [list.rows, selectedId, setParams]);

  const selectedRow = useMemo(
    () => list.rows.find(r => r.id === selectedId) || null,
    [list.rows, selectedId]
  );

  const detail  = useCatalogDetail(selectedId);
  const matches = useCatalogMatches(selectedId);

  const handleSelect = (productId: string) => {
    setParams({ productId }, { replace: false });
  };

  return (
    <CatalogErrorBoundary>
    <Flex direction="column" h="calc(100vh - 64px)" mx="-32px" mt={-10} bg="brand.surface" overflow="hidden">
      <Flex flex={1} minH={0}>
        <Sidebar
          rows={list.rows}
          total={list.total}
          totalDrafts={list.totalDrafts}
          loading={list.loading}
          hasMore={list.hasMore}
          selectedId={selectedId}
          filters={list.filters}
          categories={list.categories}
          onSelect={handleSelect}
          onLoadMore={list.loadMore}
          onFilters={list.setFilters}
        />

        <Flex direction="column" flex={1} minW={0} minH={0}>
          {detail.data?.product ? (
            <>
              <CatalogHeader
                product={detail.data.product}
                totalMatches={matches.data?.total || 0}
              />
              <ImageGallery
                product={detail.data.product}
                heroCrops={detail.data.heroCrops || null}
              />
            </>
          ) : selectedId ? (
            <Flex flex={1} align="center" justify="center" bg="gray.50">
              <Box maxW="320px" textAlign="center">
                <Text fontSize="md" fontWeight="700" color="brand.ink">
                  {detail.loading ? 'Loading product…' : 'Could not load product'}
                </Text>
                {detail.error && <Text fontSize="sm" color="red.500" mt={1}>{detail.error}</Text>}
              </Box>
            </Flex>
          ) : (
            <Flex flex={1} align="center" justify="center" bg="gray.50">
              <Box maxW="320px" textAlign="center">
                <Text fontSize="md" fontWeight="700" color="brand.ink">
                  {selectedRow ? 'Loading…' : 'No product selected'}
                </Text>
                <Text fontSize="sm" color="brand.muted" mt={1}>
                  Pick a product from the left to inspect details, reviews, specs, sellers, and matches.
                </Text>
              </Box>
            </Flex>
          )}
        </Flex>

        <RightSidebar
          product={detail.data?.product || null}
          sourceMedia={detail.data?.sourceMedia || null}
          matches={matches.data?.matches || []}
        />
      </Flex>

      <BottomBar
        product={detail.data?.product || null}
        totalMatches={matches.data?.total || 0}
      />
    </Flex>
    </CatalogErrorBoundary>
  );
}
