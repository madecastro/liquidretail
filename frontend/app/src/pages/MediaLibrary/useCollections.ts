// Phase A-3 — collections list state, scoped to the active brand.
//
// Reload triggers:
//   - active brand changes (window 'brand:change')
//   - mutations from this page (refresh() returned in the API)

import { useEffect, useState, useCallback } from 'react';
import { useBrand } from '../../brand/BrandContext';
import { listCollections, type Collection } from './collectionsApi';

type State = {
  collections: Collection[];
  loading:     boolean;
  error:       string | null;
  refresh:     () => Promise<void>;
};

export function useCollections(): State {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!brandId) { setCollections([]); return; }
    setLoading(true);
    setError(null);
    try {
      const next = await listCollections(brandId);
      setCollections(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load collections';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Cross-page brand switches refire the load.
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener('brand:change', onChange);
    return () => window.removeEventListener('brand:change', onChange);
  }, [refresh]);

  return { collections, loading, error, refresh };
}
