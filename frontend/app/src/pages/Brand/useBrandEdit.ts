// Phase 4b — edit-mode state for the Brand page.
//
// Tracks a draft override of editable Brand fields. A field is "dirty"
// when the draft has a key whose value differs from the original
// (deep-equal). Save sends only dirty fields via PATCH /api/brand/:id;
// server's curated-field protection adds them to brand.curatedFields[]
// so future enrichment leaves them alone.
//
// Cancel discards the draft AND exits edit mode. Save exits edit mode
// only on success.

import { useState, useCallback, useMemo } from 'react';
import { apiJson } from '../../auth/apiFetch';
import type { Brand, BrandDemographic } from './types';

export type EditableField =
  | 'name' | 'websiteUrl' | 'tagline' | 'summary' | 'logoUrl'
  | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'fontColor'
  | 'fontFamily'
  | 'tone' | 'hashtags' | 'tags'
  | 'demographics';

const EDITABLE_FIELDS: EditableField[] = [
  'name', 'websiteUrl', 'tagline', 'summary', 'logoUrl',
  'primaryColor', 'secondaryColor', 'accentColor', 'fontColor',
  'fontFamily',
  'tone', 'hashtags', 'tags',
  'demographics'
];

type Draft = Partial<Pick<Brand,
  'name' | 'websiteUrl' | 'tagline' | 'summary' | 'logoUrl'
  | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'fontColor'
  | 'fontFamily' | 'tone' | 'hashtags' | 'tags' | 'demographics'
>>;

export type BrandEdit = {
  isEditing: boolean;
  saving:    boolean;
  error:     string | null;
  dirty:     boolean;
  dirtyFields: EditableField[];

  // Read the effective value for a field (draft if set, otherwise brand)
  valueOf: <K extends EditableField>(key: K) => Brand[K] | undefined;

  // Mutators
  enterEdit:  () => void;
  cancelEdit: () => void;
  setField:   <K extends EditableField>(key: K, value: Brand[K] | undefined) => void;
  save:       () => Promise<void>;

  // Convenience for array fields — immutable add/remove/replace operations
  addToArrayField:    (key: 'tone' | 'hashtags' | 'tags', value: string) => void;
  removeFromArrayField: (key: 'tone' | 'hashtags' | 'tags', value: string) => void;
  setDemographic:     (index: number, persona: BrandDemographic) => void;
  addDemographic:     () => void;
  removeDemographic:  (index: number) => void;
};

export function useBrandEdit(brand: Brand | null, onSaved: () => void): BrandEdit {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft]         = useState<Draft>({});
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const enterEdit = useCallback(() => {
    setIsEditing(true);
    setError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft({});
    setError(null);
  }, []);

  const setField = useCallback(
    <K extends EditableField>(key: K, value: Brand[K] | undefined) => {
      setDraft(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  // Effective value resolver
  const valueOf = useCallback(
    <K extends EditableField>(key: K): Brand[K] | undefined => {
      if (key in draft) return (draft as Record<string, unknown>)[key] as Brand[K];
      return brand ? (brand[key] as Brand[K]) : undefined;
    },
    [brand, draft]
  );

  // Dirty diff against the original brand
  const dirtyFields = useMemo<EditableField[]>(() => {
    if (!brand) return [];
    return EDITABLE_FIELDS.filter(k => {
      if (!(k in draft)) return false;
      return !deepEqual((draft as Record<string, unknown>)[k], brand[k]);
    });
  }, [brand, draft]);

  const dirty = dirtyFields.length > 0;

  const save = useCallback(async () => {
    if (!brand) return;
    if (!dirty) { setIsEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const k of dirtyFields) {
        payload[k] = (draft as Record<string, unknown>)[k];
      }
      await apiJson(`/api/brand/${brand._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setIsEditing(false);
      setDraft({});
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [brand, dirty, dirtyFields, draft, onSaved]);

  // ── array helpers ─────────────────────────────────────────────────

  const addToArrayField = useCallback(
    (key: 'tone' | 'hashtags' | 'tags', value: string) => {
      const v = value.trim();
      if (!v) return;
      const current = (valueOf(key) || []) as string[];
      if (current.includes(v)) return;
      setField(key, [...current, v]);
    },
    [valueOf, setField]
  );

  const removeFromArrayField = useCallback(
    (key: 'tone' | 'hashtags' | 'tags', value: string) => {
      const current = (valueOf(key) || []) as string[];
      setField(key, current.filter(item => item !== value));
    },
    [valueOf, setField]
  );

  const setDemographic = useCallback((index: number, persona: BrandDemographic) => {
    const current = (valueOf('demographics') || []) as BrandDemographic[];
    const next = current.slice();
    next[index] = persona;
    setField('demographics', next);
  }, [valueOf, setField]);

  const addDemographic = useCallback(() => {
    const current = (valueOf('demographics') || []) as BrandDemographic[];
    setField('demographics', [
      ...current,
      { name: 'New persona', description: '', interests: [], painPoints: [], toneHint: '' }
    ]);
  }, [valueOf, setField]);

  const removeDemographic = useCallback((index: number) => {
    const current = (valueOf('demographics') || []) as BrandDemographic[];
    setField('demographics', current.filter((_, i) => i !== index));
  }, [valueOf, setField]);

  return {
    isEditing, saving, error, dirty, dirtyFields,
    valueOf,
    enterEdit, cancelEdit, setField, save,
    addToArrayField, removeFromArrayField,
    setDemographic, addDemographic, removeDemographic
  };
}

// Tight deep-equal for the array/string/object shapes Brand uses.
// Avoids pulling in lodash for one comparison.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
  }
  return false;
}
