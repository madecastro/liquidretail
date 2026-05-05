// Phase A-1 — data hooks for the Media Library.
//
// useMediaList:    paginated list scoped to the active brand
// useMediaDetail:  assembled detect result for a single media

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '../../auth/apiFetch';
import type { MediaListResponse, MediaListRow, DetectDetailResponse } from './types';

const PAGE_SIZE = 30;

export function useMediaList() {
  const [rows, setRows]       = useState<MediaListRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(async (nextOffset: number, replace: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<MediaListResponse>(
        `/api/media?limit=${PAGE_SIZE}&offset=${nextOffset}`
      );
      setRows(prev => replace ? res.media : [...prev, ...res.media]);
      setTotal(res.total);
      setOffset(nextOffset + res.media.length);
      setHasMore(res.hasMore);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load media';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => loadPage(0, true), [loadPage]);
  const loadMore = useCallback(() => {
    if (!loading && hasMore) void loadPage(offset, false);
  }, [loading, hasMore, offset, loadPage]);

  // Initial load + reload when active brand changes (apiFetch reads the
  // brand id from localStorage; we listen to the same global event the
  // BrandPicker fires on switch).
  useEffect(() => {
    void loadPage(0, true);
    const onBrandChange = () => void loadPage(0, true);
    window.addEventListener('brand:change', onBrandChange);
    return () => window.removeEventListener('brand:change', onBrandChange);
  }, [loadPage]);

  return { rows, total, loading, error, hasMore, refresh, loadMore };
}

export function useMediaDetail(mediaId: string | null) {
  const [data, setData]       = useState<DetectDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mediaId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<DetectDetailResponse>(`/api/media/${mediaId}/detect`);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load detect detail';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mediaId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

// Cascade-delete a Media. Returns true on success.
export async function deleteMedia(mediaId: string): Promise<boolean> {
  try {
    await apiJson(`/api/media/${mediaId}`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.warn('deleteMedia failed:', err);
    return false;
  }
}
