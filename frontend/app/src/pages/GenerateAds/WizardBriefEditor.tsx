// Editable Creative Brief panel for Step 4 (Review & Generate).
//
// Shows the active campaign's creativeBrief so operators can sanity-
// check + adjust the intent that will be fed to the Director on this
// run. Inline edits stamp Campaign.creativeBrief via PATCH; refresh
// re-derives from the campaign's targeting + creatives.
//
// Read-mode is compact (badges + 1-line previews) so it doesn't dwarf
// the Generate button. Edit mode expands to textareas + chip editors
// for the most-edited fields. Audience.segments / geo / interests are
// shown as read-only badges since they reflect platform targeting, not
// operator intent.

import { useEffect, useState, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Button, Badge, Wrap, WrapItem,
  Textarea, Input, IconButton, Spinner, Collapse, useToast, Divider
} from '@chakra-ui/react';
import { apiJson, apiFetch } from '../../auth/apiFetch';

type CreativeBrief = {
  goal?:         string;
  pitch?:        string;
  focus?:        string;
  cta_emphasis?: string;
  tone?:         string[];
  audience?: {
    description?: string;
    segments?:    string[];
    geo?:         string[];
    ageRange?:    string;
    interests?:   string[];
  };
  evidence?: {
    adCount?:     number;
    hasInsights?: boolean;
  };
  derivedFrom?:  'ingest' | 'manual';
  model?:        string;
  promptVersion?: string;
};

type Props = {
  campaignId: string;
};

export function WizardBriefEditor({ campaignId }: Props) {
  const toast = useToast();
  const [brief, setBrief]               = useState<CreativeBrief | null>(null);
  const [briefDerivedAt, setBriefDerivedAt] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [isEditing, setIsEditing]       = useState(false);
  const [draft, setDraft]               = useState<CreativeBrief>({});
  const [expanded, setExpanded]         = useState(false);

  const load = useCallback(async () => {
    if (!campaignId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await apiJson<{ campaign?: { creativeBrief?: CreativeBrief | null; briefDerivedAt?: string | null } }>(
        `/api/campaigns/${encodeURIComponent(campaignId)}`
      );
      const c = res.campaign;
      setBrief(c?.creativeBrief ?? null);
      setBriefDerivedAt(c?.briefDerivedAt ?? null);
    } catch {
      setBrief(null);
      setBriefDerivedAt(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = () => {
    setDraft(brief ? structuredClone(brief) : {});
    setIsEditing(true);
    setExpanded(true);
  };
  const cancelEdit = () => {
    setDraft({});
    setIsEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/brief`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brief: draft })
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Brief saved', status: 'success', duration: 3000 });
      setIsEditing(false);
      await load();
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await apiJson<{ ok?: boolean; skipped?: boolean; reason?: string }>(
        `/api/campaigns/${encodeURIComponent(campaignId)}/derive-brief?force=true`,
        { method: 'POST' }
      );
      if (r.skipped) {
        toast({ title: 'Skipped', description: r.reason || 'no change', status: 'info', duration: 4000 });
      } else {
        toast({ title: 'Brief re-derived', status: 'success', duration: 3000 });
      }
      await load();
    } catch (e) {
      toast({ title: 'Refresh failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Box borderWidth="1px" borderColor="brand.border" borderRadius="lg" px={4} py={3}>
        <HStack><Spinner size="xs" /><Text fontSize="sm" color="brand.muted">Loading creative brief…</Text></HStack>
      </Box>
    );
  }

  const hasBrief = !!brief && Object.keys(brief).length > 0;
  const derivedAt = briefDerivedAt ? new Date(briefDerivedAt) : null;

  return (
    <Box borderWidth="1px" borderColor="brand.border" borderRadius="lg" px={4} py={3} bg="white">
      <HStack justify="space-between" align="flex-start" wrap="wrap" gap={2}>
        <HStack spacing={2}>
          <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" fontWeight="700">
            Creative Brief
          </Text>
          <Badge variant="subtle" colorScheme="purple" fontSize="9px" px={1.5} py={0.5}>AI inferred</Badge>
          {brief?.derivedFrom === 'manual' && (
            <Badge variant="subtle" colorScheme="green" fontSize="9px" px={1.5} py={0.5}>Edited</Badge>
          )}
          {derivedAt && (
            <Text fontSize="10px" color="brand.muted">{derivedAt.toLocaleDateString()}</Text>
          )}
        </HStack>
        <HStack spacing={2}>
          {!isEditing && (
            <>
              <Button size="xs" variant="outline" onClick={refresh} isLoading={refreshing}>
                {hasBrief ? 'Refresh' : 'Derive now'}
              </Button>
              {hasBrief && (
                <Button size="xs" variant="brand" onClick={startEdit}>
                  Edit
                </Button>
              )}
            </>
          )}
          {isEditing && (
            <>
              <Button size="xs" variant="ghost" onClick={cancelEdit} isDisabled={saving}>Cancel</Button>
              <Button size="xs" variant="brand" onClick={save} isLoading={saving}>Save</Button>
            </>
          )}
          {hasBrief && !isEditing && (
            <IconButton
              aria-label="Toggle details"
              size="xs"
              variant="ghost"
              onClick={() => setExpanded(v => !v)}
              icon={<Box as="span" transform={expanded ? 'rotate(180deg)' : undefined} transition="transform 120ms">▾</Box>}
            />
          )}
        </HStack>
      </HStack>

      {!hasBrief && !isEditing && (
        <Text fontSize="sm" color="brand.muted" mt={2}>
          No brief derived yet. Click "Derive now" to extract one from this campaign's creatives + targeting.
        </Text>
      )}

      {hasBrief && !isEditing && (
        <>
          <HStack mt={2} spacing={1.5} flexWrap="wrap">
            {brief?.focus && <Badge colorScheme="purple" variant="subtle" fontSize="11px" textTransform="capitalize">{brief.focus.replace(/_/g, ' ')}</Badge>}
            {brief?.cta_emphasis && <Badge colorScheme="green" variant="subtle" fontSize="11px" textTransform="capitalize">CTA: {brief.cta_emphasis.replace(/_/g, ' ')}</Badge>}
            {Array.isArray(brief?.tone) && brief.tone.slice(0, 3).map((t, i) => (
              <Badge key={i} colorScheme="orange" variant="subtle" fontSize="11px">{t}</Badge>
            ))}
          </HStack>
          {brief?.goal && (
            <Text fontSize="sm" color="brand.ink" mt={2} noOfLines={expanded ? undefined : 1}>
              <Text as="span" color="brand.muted" fontWeight="700" mr={2}>Goal:</Text>{brief.goal}
            </Text>
          )}
          <Collapse in={expanded} animateOpacity>
            <VStack align="stretch" spacing={3} mt={3}>
              {brief?.pitch && (
                <Box>
                  <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" fontWeight="700" mb={1}>Pitch</Text>
                  <Text fontSize="sm" color="brand.ink" fontStyle="italic">{brief.pitch}</Text>
                </Box>
              )}
              {brief?.audience?.description && (
                <Box>
                  <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" fontWeight="700" mb={1}>Audience</Text>
                  <Text fontSize="sm" color="brand.ink">{brief.audience.description}</Text>
                  <HStack mt={1.5} spacing={1.5} flexWrap="wrap">
                    {brief.audience.ageRange && <Badge variant="outline" fontSize="10px">Age {brief.audience.ageRange}</Badge>}
                    {(brief.audience.geo || []).slice(0, 4).map((g, i) => (
                      <Badge key={i} variant="outline" fontSize="10px">{g}</Badge>
                    ))}
                    {(brief.audience.segments || []).slice(0, 4).map((s, i) => (
                      <Badge key={i} variant="subtle" colorScheme="blue" fontSize="10px">{s}</Badge>
                    ))}
                  </HStack>
                </Box>
              )}
            </VStack>
          </Collapse>
        </>
      )}

      {isEditing && (
        <VStack align="stretch" spacing={3} mt={3}>
          <Field label="Goal">
            <Textarea
              size="sm"
              value={draft.goal || ''}
              onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
              placeholder="What is this campaign trying to do?"
              rows={2}
            />
          </Field>
          <Field label="Pitch">
            <Textarea
              size="sm"
              value={draft.pitch || ''}
              onChange={(e) => setDraft({ ...draft, pitch: e.target.value })}
              placeholder="The argument the campaign makes to the audience."
              rows={3}
            />
          </Field>
          <HStack spacing={3} align="flex-start">
            <Field label="Focus" flex={1}>
              <Input
                size="sm"
                value={draft.focus || ''}
                onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
                placeholder="price | scarcity | lifestyle | social_proof | …"
              />
            </Field>
            <Field label="CTA emphasis" flex={1}>
              <Input
                size="sm"
                value={draft.cta_emphasis || ''}
                onChange={(e) => setDraft({ ...draft, cta_emphasis: e.target.value })}
                placeholder="urgent | aspirational | low_friction | …"
              />
            </Field>
          </HStack>
          <Field label="Tone">
            <ChipEditor
              items={draft.tone || []}
              placeholder="add a tone word"
              onAdd={v => setDraft({ ...draft, tone: [...(draft.tone || []), v] })}
              onRemove={v => setDraft({ ...draft, tone: (draft.tone || []).filter(x => x !== v) })}
            />
          </Field>
          <Divider />
          <Text fontSize="11px" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em">Audience</Text>
          <Field label="Description">
            <Textarea
              size="sm"
              value={draft.audience?.description || ''}
              onChange={(e) => setDraft({ ...draft, audience: { ...(draft.audience || {}), description: e.target.value } })}
              placeholder="Portrait of who this campaign is for."
              rows={2}
            />
          </Field>
          <HStack spacing={3} align="flex-start">
            <Field label="Age range" flex={1}>
              <Input
                size="sm"
                value={draft.audience?.ageRange || ''}
                onChange={(e) => setDraft({ ...draft, audience: { ...(draft.audience || {}), ageRange: e.target.value } })}
                placeholder="25–45"
              />
            </Field>
          </HStack>
          <Field label="Segments">
            <ChipEditor
              items={draft.audience?.segments || []}
              placeholder="add a segment"
              onAdd={v => setDraft({ ...draft, audience: { ...(draft.audience || {}), segments: [...(draft.audience?.segments || []), v] } })}
              onRemove={v => setDraft({ ...draft, audience: { ...(draft.audience || {}), segments: (draft.audience?.segments || []).filter(x => x !== v) } })}
            />
          </Field>
        </VStack>
      )}
    </Box>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <Box flex={flex}>
      <Text fontSize="xs" color="brand.muted" mb={1}>{label}</Text>
      {children}
    </Box>
  );
}

function ChipEditor({
  items, placeholder, onAdd, onRemove
}: {
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState('');
  const commit = () => {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };
  return (
    <VStack align="stretch" spacing={2}>
      <Wrap spacing={2}>
        {items.map((item, i) => (
          <WrapItem key={i}>
            <Badge
              variant="subtle"
              colorScheme="purple"
              fontSize="11px"
              px={2}
              py={1}
              borderRadius="md"
              textTransform="none"
              fontWeight="600"
              display="inline-flex"
              alignItems="center"
              gap={1}
            >
              {item}
              <IconButton
                aria-label={`Remove ${item}`}
                size="xs"
                variant="ghost"
                minW="14px"
                h="14px"
                onClick={() => onRemove(item)}
                icon={<Box as="span" fontSize="10px" lineHeight={1}>×</Box>}
              />
            </Badge>
          </WrapItem>
        ))}
      </Wrap>
      <HStack spacing={2}>
        <Input
          size="sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === ',')     { e.preventDefault(); commit(); }
          }}
          placeholder={placeholder}
        />
        <Button size="sm" variant="outline" onClick={commit} isDisabled={!input.trim()}>Add</Button>
      </HStack>
    </VStack>
  );
}
