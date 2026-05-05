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
import { Flex, Box, Text, useToast } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { MediaHeader } from './MediaHeader';
import { FilterChips } from './FilterChips';
import { Canvas } from './Canvas';
import { AspectRatioStrip, type AspectVariant } from './AspectRatioStrip';
import { BottomBar } from './BottomBar';
import { RightSidebar } from './RightSidebar';
import { useMediaList, useMediaDetail, deleteMedia } from './hooks';
import type { LayerKey } from './types';

export function MediaLibraryPage() {
  const list   = useMediaList();
  const toast  = useToast();
  const [params, setParams] = useSearchParams();

  const selectedId = params.get('mediaId');

  // When the list resolves, default-select the first item if no URL pin.
  useEffect(() => {
    if (!selectedId && list.rows.length > 0) {
      const first = list.rows[0].mediaId;
      setParams({ mediaId: first }, { replace: true });
    }
  }, [list.rows, selectedId, setParams]);

  const selectedRow = useMemo(
    () => list.rows.find(r => r.mediaId === selectedId) || null,
    [list.rows, selectedId]
  );

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
  // Selecting a crop variant shows the cropped image and hides overlays
  // since their bbox math was computed against the source frame.
  const [activeVariant, setActiveVariant] = useState<AspectVariant>(
    { ratio: 'original', label: 'Original', imageUrl: null, score: null }
  );
  // Reset to Original whenever the selected media changes — otherwise
  // a 1:1 crop selection from the previous media bleeds over.
  useEffect(() => {
    setActiveVariant({ ratio: 'original', label: 'Original', imageUrl: null, score: null });
  }, [selectedId]);

  const handleSelect = (mediaId: string) => {
    setParams({ mediaId }, { replace: false });
  };

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
      <Flex flex={1} minH={0}>
        <Sidebar
          rows={list.rows}
          total={list.total}
          loading={list.loading}
          hasMore={list.hasMore}
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
                displayUrl={activeVariant.ratio === 'original' ? null : activeVariant.imageUrl}
                isCroppedView={activeVariant.ratio !== 'original'}
                cropAspect={activeVariant.ratio !== 'original' ? activeVariant.ratio : null}
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

      <BottomBar selected={selectedRow} onDelete={handleDelete} />
    </Flex>
  );
}
