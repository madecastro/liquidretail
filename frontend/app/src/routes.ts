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

export type StepKey = 'home' | 'product-ads' | 'campaigns';
export type StepStatus = 'pending' | 'active' | 'complete' | 'warning';

export type StepDef = {
  key:         StepKey;
  path:        string;
  label:       string;
  description: string;
};

export const STEPS: readonly StepDef[] = [
  { key: 'home',        path: '/home',        label: 'Home',        description: 'Workspace overview' },
  { key: 'product-ads', path: '/product-ads', label: 'Product Ads', description: 'Generate & manage at scale' },
  { key: 'campaigns',   path: '/campaigns',   label: 'Campaigns',   description: 'Sync & generate' }
] as const;

// Secondary destinations — utility pages that aren't part of the
// primary nav but the operator reaches often. Rendered below the
// primary STEPS in the sidebar with simpler styling.
export type SecondaryNavItem = {
  path:  string;
  label: string;
};

export const SECONDARY_NAV: readonly SecondaryNavItem[] = [
  { path: '/catalog',       label: 'Product Catalog' },
  { path: '/detect',        label: 'Detect Review' },
  { path: '/media-library', label: 'Media Library' },
  { path: '/team',          label: 'Team' },
  { path: '/settings',      label: 'Settings' },
  { path: '/brand',         label: 'Brand' }
] as const;

// Out-of-band routes that should still highlight one of the primary
// nav items when the user lands on them (deep links + the wizard).
const ALIAS_TO_STEP: Record<string, StepKey> = {
  '/generate-ads':  'campaigns',
  '/upload':        'campaigns',
  // /ads is the secondary post-generate run-status view — keep the
  // sidebar highlighting "Product Ads" so operators don't lose context
  // when the wizard redirects them.
  '/ads':           'product-ads'
  // /detect is now a top-level secondary nav entry (Detect Review),
  // no longer aliased to a primary step.
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
