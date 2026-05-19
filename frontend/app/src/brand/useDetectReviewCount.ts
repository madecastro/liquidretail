// Lightweight poll of how many detect-identified drafts are waiting
// for operator review. Drives the red count badge on the Detect Review
// nav item — operators returning to the app should see the queue's
// size at a glance without clicking in.
//
// Polls every 30s while the page is foreground. Stops on tab hide
// (visibilitychange) to avoid burning Render quota when no one's
// looking. Resumes on focus.

import { useEffect, useRef, useState } from 'react';
import { apiJson } from '../auth/apiFetch';
import { useBrand } from './BrandContext';

const POLL_MS = 30000;

export function useDetectReviewCount(): number {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;
  const [count, setCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!brandId) { setCount(0); return; }
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await apiJson<{ total: number }>(
          `/api/catalog?brandId=${encodeURIComponent(brandId)}&source=detect-identified&draft=1&showVariants=1&limit=1`
        );
        if (!cancelled) setCount(res.total || 0);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    void tick();
    timerRef.current = window.setInterval(() => { void tick(); }, POLL_MS);

    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current != null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        if (timerRef.current == null) {
          void tick();
          timerRef.current = window.setInterval(() => { void tick(); }, POLL_MS);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [brandId]);

  return count;
}
