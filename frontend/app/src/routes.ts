// Single source of truth for the four-step pipeline.
//
// Sidebar, PipelineStepHeader, and the router definitions all read
// from STEPS so adding/renaming/reordering a step is a one-line
// change. Step status (pending/active/complete/warning) is derived
// at runtime — Phase 2 derives it from the current URL only; Phase 3+
// reads actual brand-setup / upload-readiness / detect-progress
// state to mark steps complete or needing attention.

export type StepKey = 'brand' | 'upload' | 'detect' | 'ad-generation';
export type StepStatus = 'pending' | 'active' | 'complete' | 'warning';

export type StepDef = {
  key:         StepKey;
  path:        string;
  label:       string;
  description: string;
};

export const STEPS: readonly StepDef[] = [
  { key: 'brand',         path: '/brand',  label: 'Brand',         description: 'Identity & rules' },
  { key: 'upload',        path: '/upload', label: 'Upload',        description: 'Products & UGC' },
  { key: 'detect',        path: '/detect', label: 'Detect',        description: 'AI review' },
  { key: 'ad-generation', path: '/ads',    label: 'Ad Generation', description: 'Variants' }
] as const;

// Phase 2 placeholder: returns "active" for the current route and
// "pending" for the rest. Phase 3 replaces with real-state derivation.
//
// Aliases: /media-library is a Phase A detect-rebuild precursor (sits
// out of band of the four-step nav), so we map it onto the 'detect'
// step for the pipeline-header active highlight.
const ALIAS_TO_STEP: Record<string, StepKey> = {
  '/media-library': 'detect'
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
