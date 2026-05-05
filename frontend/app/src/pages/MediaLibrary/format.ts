// Phase A-1 — small presentation helpers shared across Media Library
// components. Kept colocated so the page is self-contained.

import type { MatchLevel, DetectOutcome } from './types';

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60)        return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)        return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)        return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)        return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)       return `${mo}mo ago`;
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

export function deriveTitle(row: { caption: string | null; fileName?: string | null; primarySubjectLabel: string | null; externalId: string }): string {
  // Caption first 50 chars → primarySubjectLabel → fileName w/o ext → externalId tail
  const cap = (row.caption || '').trim();
  if (cap) {
    const oneLine = cap.split(/\s*\n\s*/)[0];
    return oneLine.length > 50 ? oneLine.slice(0, 50) + '…' : oneLine;
  }
  if (row.primarySubjectLabel) return row.primarySubjectLabel;
  if (row.fileName) {
    const base = row.fileName.replace(/\.[^.]+$/, '');
    return base.length > 50 ? base.slice(0, 50) + '…' : base;
  }
  return row.externalId.slice(-12);
}

export const SOURCE_PILL_LABEL: Record<string, string> = {
  instagram:     'Instagram',
  tiktok:        'TikTok',
  meta:          'Facebook',
  manual_upload: 'Manual upload',
  youtube:       'YouTube',
  other:         'Other'
};

export function matchLevelTone(level: MatchLevel): { label: string; bg: string; fg: string } {
  switch (level) {
    case 'high':   return { label: 'High match',   bg: 'rgba(16,185,129,0.10)', fg: '#059669' };
    case 'medium': return { label: 'Medium match', bg: 'rgba(217,119,6,0.10)',  fg: '#D97706' };
    case 'low':    return { label: 'Low match',    bg: 'rgba(220,38,38,0.10)',  fg: '#DC2626' };
    default:       return { label: 'No match',     bg: 'rgba(100,116,139,0.10)',fg: '#64748B' };
  }
}

export function detectOutcomeTone(outcome: DetectOutcome): { label: string; bg: string; fg: string } | null {
  if (!outcome) return null;
  switch (outcome) {
    case 'own_product':  return { label: 'Own product',  bg: 'rgba(16,185,129,0.12)', fg: '#047857' };
    case 'competitor':   return { label: 'Competitor',   bg: 'rgba(220,38,38,0.12)',  fg: '#B91C1C' };
    case 'mixed':        return { label: 'Mixed',        bg: 'rgba(217,119,6,0.12)',  fg: '#B45309' };
    case 'category':     return { label: 'Category',     bg: 'rgba(11,132,216,0.12)', fg: '#0B6FB8' };
    case 'no_products':  return { label: 'No products',  bg: 'rgba(100,116,139,0.12)',fg: '#475569' };
    default:             return null;
  }
}

// Map a numeric judge winnerScore (0..1) to a UI quality bucket.
export function qualityBucket(score: number | null | undefined): { label: 'High' | 'Medium' | 'Low'; tone: string } {
  const s = typeof score === 'number' ? score : 0;
  if (s >= 0.80) return { label: 'High',   tone: '#059669' };
  if (s >= 0.60) return { label: 'Medium', tone: '#D97706' };
  return            { label: 'Low',    tone: '#DC2626' };
}

// Build a Cloudinary `c_crop` transform URL on the fly from the source
// image + a pixel-coord bbox. Smart-crop output stores coordinates
// only; the legacy detect view computed transform URLs the same way.
// Returns null when sourceUrl isn't a Cloudinary upload URL we can
// transform, so the caller can fall back to "not yet generated".
export function buildCloudinaryCropUrl(
  sourceUrl: string | null | undefined,
  bbox: { x1: number; y1: number; x2: number; y2: number } | null | undefined
): string | null {
  if (!sourceUrl || !bbox) return null;
  if (!sourceUrl.includes('/upload/')) return null;
  const w = Math.max(1, Math.round(bbox.x2 - bbox.x1));
  const h = Math.max(1, Math.round(bbox.y2 - bbox.y1));
  const x = Math.max(0, Math.round(bbox.x1));
  const y = Math.max(0, Math.round(bbox.y1));
  return sourceUrl.replace('/upload/', `/upload/c_crop,w_${w},h_${h},x_${x},y_${y}/`);
}

// Density grid → CSS color for a single cell. White at 0, red at 1.
export function densityCellColor(v: number): string {
  const x = Math.max(0, Math.min(1, v));
  // Cool→warm gradient: 0=transparent, 0.5=yellow, 1=red. Alpha scales with value.
  const r = Math.round(255 * (x < 0.5 ? x * 2 : 1));
  const g = Math.round(255 * (x < 0.5 ? 0.85 : (1 - x) * 2 * 0.85));
  const b = 0;
  const a = 0.35 + 0.45 * x;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}
