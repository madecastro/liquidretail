// Phase 4 follow-up #3 — data hooks for Catalog Browser.

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';
import type { CatalogListResponse, CatalogListRow, CatalogDetailResponse, CatalogMatchesResponse } from './types';

const PAGE_SIZE = 30;

type ListFilters = {
  q?:           string;
  source?:      string;        // 'ig-catalog' | 'manual-upload' | 'detect-identified' | 'draft'
  category?:    string;
  inStock?:     boolean;
  hasReviews?:  boolean;
  showVariants?: boolean;      // include non-primary Meta item-group variants
};

export function useCatalogList(initialFilters: ListFilters = {}) {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;

  const [rows, setRows]       = useState<CatalogListRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalDrafts, setTotalDrafts] = useState(0);
  const [filters, setFilters] = useState<ListFilters>(initialFilters);

  const buildQuery = useCallback((nextOffset: number) => {
    if (!brandId) return null;
    const p = new URLSearchParams({
      brandId,
      limit:  String(PAGE_SIZE),
      offset: String(nextOffset)
    });
    if (filters.q)        p.set('q', filters.q);
    if (filters.source)   p.set('source', filters.source);
    if (filters.category) p.set('category', filters.category);
    if (filters.inStock)      p.set('inStock', '1');
    if (filters.hasReviews)   p.set('hasReviews', '1');
    if (filters.showVariants) p.set('showVariants', '1');
    // Default to excluding drafts (draft=0) so the catalog browser
    // doesn't mix unapproved detect-identified rows in with the
    // synced catalog. The "Drafts only" source option flips this:
    // it sends source=draft which the backend treats as draft=true
    // across all sources, so we omit the draft filter here.
    if (filters.source !== 'draft') p.set('draft', '0');
    return p.toString();
  }, [brandId, filters]);

  const loadPage = useCallback(async (nextOffset: number, replace: boolean) => {
    const qs = buildQuery(nextOffset);
    if (!qs) { setRows([]); setTotal(0); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<CatalogListResponse>(`/api/catalog?${qs}`);
      setRows(prev => replace ? res.products : [...prev, ...res.products]);
      setTotal(res.total);
      setOffset(nextOffset + res.products.length);
      setHasMore(res.hasMore);
      setCategories(res.categories || []);
      setTotalDrafts(res.totalDrafts || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load catalog';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const refresh  = useCallback(() => loadPage(0, true), [loadPage]);
  const loadMore = useCallback(() => {
    if (!loading && hasMore) void loadPage(offset, false);
  }, [loading, hasMore, offset, loadPage]);

  useEffect(() => {
    void loadPage(0, true);
    const onChange = () => void loadPage(0, true);
    window.addEventListener('brand:change', onChange);
    return () => window.removeEventListener('brand:change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, JSON.stringify(filters)]);

  return { rows, total, loading, error, hasMore, refresh, loadMore, categories, totalDrafts, filters, setFilters };
}

export function useCatalogDetail(productId: string | null) {
  const [data, setData]       = useState<CatalogDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!productId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<CatalogDetailResponse>(`/api/catalog/${productId}`);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load product';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export function useCatalogMatches(productId: string | null) {
  const [data, setData]       = useState<CatalogMatchesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!productId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<CatalogMatchesResponse>(`/api/catalog/${productId}/matches`);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load matches';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
