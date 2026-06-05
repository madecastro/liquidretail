// Phase 4 follow-up #3 — Catalog Browser presentation helpers.

import type { CatalogSource } from './types';

// Pick a renderable thumbnail URL for a Media entry. Videos served from
// Cloudinary need a frame-extract transform (so_0/ → first frame +
// .jpg extension swap) so an <img> tag can display them. Non-Cloudinary
// videos fall back to fileUrl — the <img> may break but that's the
// best we can do without server-side thumbnailing for those sources.
// For images, the URL is returned as-is.
export function mediaThumbUrl(fileUrl: string | null | undefined, fileType?: 'image' | 'video' | string | null): string {
  if (!fileUrl) return '';
  if (fileType !== 'video') return fileUrl;
  if (fileUrl.includes('/video/upload/')) {
    return fileUrl
      .replace('/video/upload/', '/video/upload/so_0/')
      .replace(/\.(mp4|mov|webm|m4v|mkv|avi)(\?.*)?$/i, '.jpg$2');
  }
  return fileUrl;
}

export const SOURCE_LABEL: Record<string, string> = {
  'ig-catalog':         'Meta Catalog',
  'manual-upload':      'Manual',
  'detect-identified':  'Detect-identified'
};

export function sourceTone(source: CatalogSource): { bg: string; fg: string; label: string } {
  const label = SOURCE_LABEL[source] || source;
  switch (source) {
    case 'ig-catalog':        return { bg: 'rgba(11,132,216,0.10)',  fg: '#0B6FB8', label };
    case 'manual-upload':     return { bg: 'rgba(122,53,232,0.10)',  fg: '#6B21A8', label };
    case 'detect-identified': return { bg: 'rgba(217,119,6,0.10)',   fg: '#B45309', label };
    default:                  return { bg: 'rgba(100,116,139,0.10)', fg: '#475569', label };
  }
}

export function formatPrice(value: number | null | undefined, currency: string | null | undefined): string {
  if (value == null) return '—';
  const c = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${c} ${value.toFixed(2)}`;
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function compactNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
