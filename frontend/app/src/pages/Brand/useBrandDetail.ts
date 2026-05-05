// Phase 4a — fetch the full Brand doc keyed by the active brand id
// from BrandContext. Re-fetches on brand:change.

import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';
import type { Brand } from './types';

type State = {
  brand:    Brand | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => Promise<void>;
};

export function useBrandDetail(): State {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;

  const [brand, setBrand]     = useState<Brand | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!brandId) { setBrand(null); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ brand: Brand }>(`/api/brand/${brandId}`);
      setBrand(res.brand);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load brand';
      setError(msg);
      setBrand(null);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener('brand:change', onChange);
    return () => window.removeEventListener('brand:change', onChange);
  }, [refresh]);

  return { brand, loading, error, refresh };
}
