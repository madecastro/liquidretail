import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiJson } from '../auth/apiFetch';
import { useAuth } from '../auth/AuthContext';
import type { Membership, MeResponse } from '../auth/types';
import type { BrandSummary } from './types';

// Brand + advertiser context. Loads brands for the active advertiser
// and exposes the active brand selection. Also surfaces memberships
// for the workspace switcher (visible only when a user belongs to >1
// advertiser).
//
// Active brand persists in localStorage.brand_id (read by apiFetch).
// Switching brands fires a global 'brand:change' event so any
// listeners — including legacy vanilla pages still in the DOM during
// cohabitation — can react.

type BrandState = {
  loading:           boolean;
  error:             string | null;
  brands:            BrandSummary[];
  activeBrand:       BrandSummary | null;
  activeAdvertiserId: string | null;
  memberships:       Membership[];
  setActiveBrand:    (id: string) => void;
  setActiveAdvertiser: (advertiserId: string) => void;
  refreshBrands:     () => Promise<void>;
};

const BrandContext = createContext<BrandState | null>(null);

export function BrandProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [brands, setBrands]                   = useState<BrandSummary[]>([]);
  const [memberships, setMemberships]         = useState<Membership[]>([]);
  const [activeAdvertiserId, setAdvertiserId] = useState<string | null>(
    () => localStorage.getItem('advertiser_id')
  );
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(
    () => localStorage.getItem('brand_id')
  );

  // Wire up. When auth flips authenticated, fetch /api/me + /api/brand.
  // When auth flips unauthenticated, clear local state.
  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setBrands([]);
      setMemberships([]);
      return;
    }
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  async function hydrate() {
    setLoading(true);
    setError(null);
    try {
      const me = await apiJson<MeResponse>('/api/me');
      setMemberships(me.memberships || []);
      // /api/me's advertiserId reflects whatever requireAuth resolved
      // for this request. If localStorage has none, sync to the server's pick.
      if (me.advertiserId && !localStorage.getItem('advertiser_id')) {
        localStorage.setItem('advertiser_id', me.advertiserId);
        setAdvertiserId(me.advertiserId);
      }
      await loadBrands();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load profile';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadBrands() {
    const data = await apiJson<{ brands: BrandSummary[] }>('/api/brand');
    setBrands(data.brands || []);
    // If the persisted active brand isn't in the list (deleted, or a
    // workspace switch invalidated it), pick the first available.
    const persistedId = localStorage.getItem('brand_id');
    const persistedStillValid = data.brands.some(b => b.id === persistedId);
    if (!persistedStillValid && data.brands.length > 0) {
      const first = data.brands[0];
      localStorage.setItem('brand_id', first.id);
      localStorage.setItem('brand_name', first.name);
      setActiveBrandIdState(first.id);
    }
  }

  const setActiveBrand = useCallback((id: string) => {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;
    localStorage.setItem('brand_id', brand.id);
    localStorage.setItem('brand_name', brand.name);
    setActiveBrandIdState(brand.id);
    // Notify legacy pages (still in the DOM during cohabitation).
    window.dispatchEvent(new Event('brand:change'));
  }, [brands]);

  const setActiveAdvertiser = useCallback((advertiserId: string) => {
    localStorage.setItem('advertiser_id', advertiserId);
    setAdvertiserId(advertiserId);
    // Brand list belongs to the advertiser — switching workspace
    // means the active brand probably isn't valid anymore.
    localStorage.removeItem('brand_id');
    localStorage.removeItem('brand_name');
    setActiveBrandIdState(null);
    // Reload to drop in-memory state. Heavier than re-fetching but
    // matches the legacy workspace-switch UX users already know.
    window.location.reload();
  }, []);

  const refreshBrands = useCallback(async () => {
    if (auth.status !== 'authenticated') return;
    await loadBrands();
  }, [auth.status]);

  const activeBrand = useMemo(
    () => brands.find(b => b.id === activeBrandId) ?? null,
    [brands, activeBrandId]
  );

  const value: BrandState = {
    loading,
    error,
    brands,
    activeBrand,
    activeAdvertiserId,
    memberships,
    setActiveBrand,
    setActiveAdvertiser,
    refreshBrands
  };

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandState {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used inside <BrandProvider>');
  return ctx;
}
