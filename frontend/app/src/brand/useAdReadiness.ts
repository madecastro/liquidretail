// Polls GET /api/brand/:brandId/ad-readiness so the UI can disable
// "New campaign" / "Generate Ads" affordances until account setup
// (catalog + social ingest + detect) is complete.
//
// Strictest gate is enforced server-side; this hook is the cosmetic
// mirror — disable + tooltip rather than a 409 on click.
//
// While not-ready: poll every 5s (matches OnboardingStatusPanel) so
// buttons re-enable automatically when detect terminates.
// Once ready: stop polling (state can't regress for this brand).

import { useEffect, useRef, useState } from 'react';
import { apiJson } from '../auth/apiFetch';
import { useBrand } from './BrandContext';

export type AdReadinessBlocker = {
  code:    string;
  source:  'catalog' | 'social' | null;
  message: string;
};

export type AdReadiness = {
  ready:    boolean;
  reason:   string;
  blockers: AdReadinessBlocker[];
};

type State = AdReadiness & {
  loading: boolean;
  error:   string | null;
};

const POLL_MS = 5000;

export function useAdReadiness(): State {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;
  const [state, setState] = useState<State>({
    ready:    false,
    reason:   '',
    blockers: [],
    loading:  true,
    error:    null
  });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!brandId) {
      setState({ ready: false, reason: 'No active brand.', blockers: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await apiJson<AdReadiness>(`/api/brand/${brandId}/ad-readiness`);
        if (cancelled) return;
        setState({
          ready:    !!r.ready,
          reason:   r.reason || '',
          blockers: r.blockers || [],
          loading:  false,
          error:    null
        });
        // Stop polling once ready — readiness can't regress without
        // explicit operator action (new connection, new sync) and the
        // page already re-mounts on those flows.
        if (r.ready && timerRef.current != null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'readiness check failed';
        setState(s => ({ ...s, loading: false, error: msg }));
      }
    };

    void fetchOnce();
    timerRef.current = window.setInterval(() => { void fetchOnce(); }, POLL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [brandId]);

  return state;
}
