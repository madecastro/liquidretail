// Single source of truth for the primary navigation.
//
// Sidebar reads from STEPS so adding/renaming/reordering a nav item is
// a one-line change. Step status (pending/active/complete/warning) is
// derived at runtime from the current URL (Phase 2); later phases will
// read actual brand-setup / campaign / render state.
//
// Reorg note: Upload + Detect were retired from the primary nav and
// fold into the Generate Ads wizard (campaign → products → settings →
// generate). The deep-link routes (/upload, /detect, /media-library,
// /catalog) still resolve so internal links keep working.

export type StepKey = 'brand' | 'campaigns' | 'ads';
export type StepStatus = 'pending' | 'active' | 'complete' | 'warning';

export type StepDef = {
  key:         StepKey;
  path:        string;
  label:       string;
  description: string;
};

export const STEPS: readonly StepDef[] = [
  { key: 'brand',     path: '/brand',     label: 'Brand',     description: 'Identity & rules' },
  { key: 'campaigns', path: '/campaigns', label: 'Campaigns', description: 'Sync & generate' },
  { key: 'ads',       path: '/ads',       label: 'Ads',       description: 'Rendered creatives' }
] as const;

// Out-of-band routes that should still highlight one of the primary
// nav items when the user lands on them (deep links + the wizard).
const ALIAS_TO_STEP: Record<string, StepKey> = {
  '/generate-ads':  'campaigns',
  '/upload':        'campaigns',
  '/detect':        'campaigns',
  '/media-library': 'campaigns',
  '/catalog':       'campaigns'
};

export function statusFromPath(currentPath: string): Record<StepKey, StepStatus> {
  let active: StepKey | undefined = STEPS.find(s => currentPath.startsWith(s.path))?.key;
  if (!active) {
    for (const [alias, step] of Object.entries(ALIAS_TO_STEP)) {
      if (currentPath.startsWith(alias)) { active = step; break; }
    }
  }
  const out = {} as Record<StepKey, StepStatus>;
  for (const s of STEPS) out[s.key] = s.key === active ? 'active' : 'pending';
  return out;
}
