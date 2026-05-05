// Phase A-1 — Media Library page entry point. Mounted at /media-library.
//
// Layout:
//   ┌─────────┬───────────────────────────────────┬──────────┐
//   │         │ MediaHeader (filename, source...) │          │
//   │ Sidebar │ FilterChips (layer toggles)       │   Right  │
//   │  (320)  │ Canvas (image + overlay layers)   │  Sidebar │
//   │         │ AspectRatioStrip (variants)       │   (380)  │
//   ├─────────┴───────────────────────────────────┴──────────┤
//   │ BottomBar (Delete · Continue to Ad Generation)         │
//   └─────────────────────────────────────────────────────────┘
//
// The page is full-bleed — it bypasses PipelineShell's max-width
// container by wrapping in a Flex that fills its grid slot. This
// matches the mockup which has dense panel data at full width.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Box, Text, useToast, Button, HStack, useDisclosure, Badge } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { MediaHeader } from './MediaHeader';
import { FilterChips } from './FilterChips';
import { Canvas } from './Canvas';
import { AspectRatioStrip, type AspectVariant } from './AspectRatioStrip';
import { BottomBar } from './BottomBar';
import { RightSidebar } from './RightSidebar';
import { useMediaList, useMediaDetail, deleteMedia } from './hooks';
import { useCollections } from './useCollections';
import { CollectionsManager } from './CollectionsManager';
import type { LayerKey } from './types';

export function MediaLibraryPage() {
  const list        = useMediaList();
  const collections = useCollections();
  const manager     = useDisclosure();
  const toast       = useToast();
  const [params, setParams] = useSearchParams();

  const selectedId   = params.get('mediaId');
  const collectionId = params.get('collectionId');

  const activeCollection = useMemo(
    () => collections.collections.find(c => c.id === collectionId) || null,
    [collections.collections, collectionId]
  );

  // Filter the rendered media list to a collection's members when one
  // is active. This is a client-side filter against the already-loaded
  // page; for collections that span beyond the loaded window we'd hit
  // GET /api/collections/:id/media instead — out of scope for A-3.
  const filteredRows = useMemo(() => {
    if (!activeCollection) return list.rows;
    const memberSet = new Set(activeCollection.mediaIds.map(String));
    return list.rows.filter(r => memberSet.has(String(r.mediaId)));
  }, [list.rows, activeCollection]);

  // When the list resolves, default-select the first item if no URL pin.
  useEffect(() => {
    if (!selectedId && filteredRows.length > 0) {
      const first = filteredRows[0].mediaId;
      const next: Record<string, string> = { mediaId: first };
      if (collectionId) next.collectionId = collectionId;
      setParams(next, { replace: true });
    }
  }, [filteredRows, selectedId, collectionId, setParams]);

  const selectedRow = useMemo(
    () => list.rows.find(r => r.mediaId === selectedId) || null,
    [list.rows, selectedId]
  );

  // Helper that preserves the collectionId pin when selection changes.
  const setSelected = (mediaId: string | null) => {
    const next: Record<string, string> = {};
    if (mediaId)      next.mediaId      = mediaId;
    if (collectionId) next.collectionId = collectionId;
    setParams(next, { replace: false });
  };

  const setCollectionFilter = (id: string | null) => {
    const next: Record<string, string> = {};
    if (id) next.collectionId = id;
    // Drop the current selection — likely outside the new filter
    setParams(next, { replace: false });
  };

  const detail = useMediaDetail(selectedId);

  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    () => new Set<LayerKey>(['products', 'people', 'text', 'safe-zones', 'density'])
  );
  const toggleLayer = (key: LayerKey) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Active aspect-ratio variant — drives what the canvas displays.
  // Defaults to 'original' (full source frame, overlays visible).
  // Selecting a smart-crop projects source-frame overlays into the
  // cropped frame; selecting an extended-crop hides source-frame
  // overlays since the image is Gemini-generated, not a crop.
  const [activeVariant, setActiveVariant] = useState<AspectVariant>(
    { ratio: 'original', label: 'Original', imageUrl: null, score: null, kind: 'original', cropBbox: null }
  );
  // Reset to Original whenever the selected media changes — otherwise
  // a 1:1 crop selection from the previous media bleeds over.
  useEffect(() => {
    setActiveVariant({ ratio: 'original', label: 'Original', imageUrl: null, score: null, kind: 'original', cropBbox: null });
  }, [selectedId]);

  const handleSelect = (mediaId: string) => setSelected(mediaId);

  const handleDelete = async () => {
    if (!selectedRow) return;
    const ok = window.confirm(`Delete "${selectedRow.fileName || selectedRow.externalId}"? This removes the media + all detect artifacts. The action cannot be undone.`);
    if (!ok) return;
    const success = await deleteMedia(selectedRow.mediaId);
    if (success) {
      toast({ title: 'Media deleted', status: 'success', duration: 2500 });
      // Drop selection + refresh list. The default-select effect picks
      // the new first item.
      setParams({}, { replace: true });
      void list.refresh();
    } else {
      toast({ title: 'Delete failed', status: 'error', duration: 4000 });
    }
  };

  return (
    <Flex direction="column" h="calc(100vh - 64px)" mx="-32px" mt={-10} bg="brand.surface" overflow="hidden">
      <CollectionFilterBar
        activeName={activeCollection?.name || null}
        memberCount={activeCollection?.mediaCount || 0}
        onClear={() => setCollectionFilter(null)}
        onOpenManager={manager.onOpen}
      />
      <Flex flex={1} minH={0}>
        <Sidebar
          rows={filteredRows}
          total={activeCollection ? filteredRows.length : list.total}
          loading={list.loading}
          hasMore={!activeCollection && list.hasMore}
          selectedId={selectedId}
          onSelect={handleSelect}
          onLoadMore={list.loadMore}
        />

        <Flex direction="column" flex={1} minW={0} minH={0}>
          {selectedRow ? (
            <>
              <MediaHeader
                row={selectedRow}
                likes={detail.data?.result?.platformStats?.likes ?? null}
                comments={detail.data?.result?.platformStats?.comments ?? null}
              />
              <FilterChips active={activeLayers} onToggle={toggleLayer} />
              <Canvas
                fileUrl={selectedRow.fileUrl}
                detect={detail.data?.result || null}
                loading={detail.loading}
                activeLayers={activeLayers}
                variant={activeVariant}
              />
              <AspectRatioStrip
                fileUrl={selectedRow.fileUrl}
                detect={detail.data?.result || null}
                value={activeVariant.ratio}
                onChange={setActiveVariant}
              />
            </>
          ) : (
            <Flex flex={1} align="center" justify="center" bg="gray.50">
              <Box maxW="320px" textAlign="center">
                <Text fontSize="md" fontWeight="700" color="brand.ink">No media selected</Text>
                <Text fontSize="sm" color="brand.muted" mt={1}>
                  Pick an item from the left to inspect detection results.
                </Text>
              </Box>
            </Flex>
          )}
        </Flex>

        <RightSidebar row={selectedRow} detect={detail.data?.result || null} />
      </Flex>

      <BottomBar
        selected={selectedRow}
        onDelete={handleDelete}
        collections={collections.collections}
        onCollectionsChanged={collections.refresh}
      />

      <CollectionsManager
        isOpen={manager.isOpen}
        onClose={manager.onClose}
        collections={collections.collections}
        activeFilterId={collectionId}
        onSelectFilter={(id) => { setCollectionFilter(id); }}
        onChanged={collections.refresh}
      />
    </Flex>
  );
}

function CollectionFilterBar({
  activeName, memberCount, onClear, onOpenManager
}: {
  activeName: string | null;
  memberCount: number;
  onClear: () => void;
  onOpenManager: () => void;
}) {
  return (
    <HStack
      h="40px"
      px={5}
      bg="brand.surface"
      borderBottomWidth="1px"
      borderBottomColor="brand.border"
      spacing={3}
    >
      {activeName ? (
        <>
          <Text fontSize="xs" color="brand.muted">Filtered by collection</Text>
          <Badge variant="subtle" colorScheme="purple" fontSize="10px" px={2} py={0.5} borderRadius="md">
            {activeName}
          </Badge>
          <Text fontSize="xs" color="brand.muted">{memberCount} item{memberCount === 1 ? '' : 's'}</Text>
          <Button onClick={onClear} variant="ghost" size="xs">Clear</Button>
        </>
      ) : (
        <Text fontSize="xs" color="brand.muted">Showing all media for the active brand</Text>
      )}
      <Box flex={1} />
      <Button onClick={onOpenManager} variant="ghost" size="xs">Manage collections</Button>
    </HStack>
  );
}
