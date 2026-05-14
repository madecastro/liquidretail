// Detect Review page (top-level secondary nav, /detect).
//
// Lists CatalogProduct rows with source='detect-identified' for the
// active brand. The detect pipeline auto-creates these as drafts when
// identification certainty >= 0.80 (catalogProductDraftService); this
// page is the operator's queue for reviewing, editing, and graduating
// them into the main catalog.
//
// Save = PATCH /api/catalog/:id with field updates AND draft:false.
// The 'detect-identified' source persists — the pill stays in the
// catalog browser so operators can audit which rows came from detect
// vs Meta sync vs manual upload.

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Card, CardBody, VStack, HStack, Text, Heading, Button, Badge, Box,
  Spinner, Input, Image, useToast, IconButton, Switch, FormLabel, Tooltip
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type DetectRow = {
  id:           string;
  source:       string;
  draft:        boolean;
  title:        string;
  brand:        string | null;
  category:     string | null;
  price:        number | null;
  currency:     string | null;
  imageUrl:     string | null;
  productUrl:   string | null;
  matchCount:   number;
  detectedFromMediaId: string | null;
  firstSeenAt:  string | null;
};

type ListResponse = {
  products: DetectRow[];
  total:    number;
  hasMore:  boolean;
};

type EditState = {
  title:      string;
  brand:      string;
  category:   string;
  price:      string;     // string for the <input>
  currency:   string;
  imageUrl:   string;
  productUrl: string;
};

function toEditState(r: DetectRow): EditState {
  return {
    title:      r.title || '',
    brand:      r.brand || '',
    category:   r.category || '',
    price:      r.price != null ? String(r.price) : '',
    currency:   r.currency || '',
    imageUrl:   r.imageUrl || '',
    productUrl: r.productUrl || ''
  };
}

export function DetectReviewPage() {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;
  const toast = useToast();

  const [rows, setRows]           = useState<DetectRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [draftsOnly, setDraftsOnly] = useState(true);
  const [edits, setEdits]         = useState<Record<string, EditState>>({});
  const [savingId, setSavingId]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        brandId,
        source: 'detect-identified',
        limit:  '100'
      });
      if (draftsOnly) params.set('draft', '1');
      const res = await apiJson<ListResponse>(`/api/catalog?${params}`);
      setRows(res.products || []);
      // Reset edit buffers to match the freshly-loaded rows.
      const next: Record<string, EditState> = {};
      for (const r of res.products || []) next[r.id] = toEditState(r);
      setEdits(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load detect-identified products');
    } finally {
      setLoading(false);
    }
  }, [brandId, draftsOnly]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totalDrafts = useMemo(() => rows.filter(r => r.draft).length, [rows]);

  function patchEdit(id: string, patch: Partial<EditState>) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(row: DetectRow, opts: { graduate: boolean }) {
    setSavingId(row.id);
    try {
      const e = edits[row.id];
      const body: Record<string, unknown> = {
        title:      e.title.trim(),
        brand:      e.brand.trim() || null,
        category:   e.category.trim() || null,
        price:      e.price.trim() === '' ? null : Number(e.price),
        currency:   e.currency.trim().toUpperCase() || null,
        imageUrl:   e.imageUrl.trim() || null,
        productUrl: e.productUrl.trim() || null
      };
      if (opts.graduate) body.draft = false;
      const res = await apiJson<{ product: DetectRow }>(`/api/catalog/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
      // Replace the row in-place; if we just graduated and drafts-only
      // is on, drop it from the list.
      setRows(prev => {
        if (opts.graduate && draftsOnly) return prev.filter(r => r.id !== row.id);
        return prev.map(r => r.id === row.id ? res.product : r);
      });
      toast({
        title:       opts.graduate ? 'Saved to catalog' : 'Edits saved',
        description: opts.graduate ? `${res.product.title} now lives in your Product Catalog.` : undefined,
        status:      'success',
        duration:    3000
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Save failed', description: msg, status: 'error', duration: 6000 });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Catalog"
        title="Detect Review"
        description="Products identified by the AI detect pipeline that aren't in your synced catalog yet. Review, edit, and save — saved items flow into the Product Catalog with a Detect-identified pill."
      />

      <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
        <HStack spacing={3}>
          <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
            {draftsOnly ? `Pending review (${totalDrafts})` : `All detect-identified (${rows.length})`}
          </Heading>
          {totalDrafts > 0 && draftsOnly && (
            <Badge colorScheme="orange" variant="subtle" fontSize="10px">{totalDrafts} draft{totalDrafts === 1 ? '' : 's'}</Badge>
          )}
        </HStack>
        <HStack spacing={3}>
          <FormLabel htmlFor="drafts-only" m={0} fontSize="xs" color="brand.muted">
            Drafts only
          </FormLabel>
          <Switch
            id="drafts-only"
            isChecked={draftsOnly}
            onChange={(e) => setDraftsOnly(e.target.checked)}
            colorScheme="purple"
          />
          <Button as={RouterLink} to="/catalog" variant="outline" size="sm">
            Open Product Catalog →
          </Button>
        </HStack>
      </HStack>

      {loading ? (
        <Card variant="outline"><CardBody>
          <HStack py={6} justify="center"><Spinner /><Text fontSize="sm" color="brand.muted">Loading…</Text></HStack>
        </CardBody></Card>
      ) : error ? (
        <Card variant="outline"><CardBody>
          <Text color="red.600" fontSize="sm">{error}</Text>
        </CardBody></Card>
      ) : rows.length === 0 ? (
        <Card variant="outline"><CardBody>
          <VStack align="stretch" spacing={3} py={8} textAlign="center">
            <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
              {draftsOnly ? 'No drafts to review' : 'No detect-identified products yet'}
            </Text>
            <Text color="brand.ink" fontWeight="600" fontSize="lg">
              {draftsOnly ? 'You\'re all caught up.' : 'Run detect on some media to surface candidate products.'}
            </Text>
            <Text color="brand.muted" fontSize="sm" maxW="520px" mx="auto">
              When the AI identifies a product in your media with high confidence, it lands here as a draft so you can review the title, brand, price and image before adding it to the catalog.
            </Text>
          </VStack>
        </CardBody></Card>
      ) : (
        <VStack align="stretch" spacing={3}>
          {rows.map(r => (
            <DetectRowCard
              key={r.id}
              row={r}
              edit={edits[r.id]}
              onChange={(patch) => patchEdit(r.id, patch)}
              onSave={(graduate) => save(r, { graduate })}
              saving={savingId === r.id}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}

function DetectRowCard({ row, edit, onChange, onSave, saving }: {
  row:      DetectRow;
  edit:     EditState | undefined;
  onChange: (patch: Partial<EditState>) => void;
  onSave:   (graduate: boolean) => void;
  saving:   boolean;
}) {
  if (!edit) return null;
  return (
    <Card variant="outline" borderColor={row.draft ? 'orange.300' : 'brand.border'}>
      <CardBody>
        <HStack align="flex-start" spacing={4}>
          <Box w="120px" h="120px" bg="gray.100" borderRadius="md" overflow="hidden" flexShrink={0}>
            {edit.imageUrl ? (
              <Image src={edit.imageUrl} alt={edit.title} w="100%" h="100%" objectFit="cover" fallback={<Box w="100%" h="100%" bg="gray.100" />} />
            ) : (
              <Box w="100%" h="100%" display="flex" alignItems="center" justifyContent="center">
                <Text fontSize="xs" color="brand.muted">no image</Text>
              </Box>
            )}
          </Box>

          <Box flex={1} minW={0}>
            <HStack spacing={2} mb={2}>
              <Badge colorScheme="orange" fontSize="9px">Detect-identified</Badge>
              {row.draft && <Badge colorScheme="orange" variant="outline" fontSize="9px">Draft</Badge>}
              {row.matchCount > 0 && (
                <Badge colorScheme="purple" variant="subtle" fontSize="9px">{row.matchCount} match{row.matchCount === 1 ? '' : 'es'}</Badge>
              )}
              {row.detectedFromMediaId && (
                <Tooltip label="View the source post that surfaced this product" hasArrow>
                  <IconButton
                    as={RouterLink}
                    to={`/media-library?mediaId=${row.detectedFromMediaId}`}
                    size="xs"
                    variant="ghost"
                    aria-label="Open source media"
                    icon={<Text fontSize="14px">🔗</Text>}
                  />
                </Tooltip>
              )}
            </HStack>

            <VStack align="stretch" spacing={2}>
              <Field label="Title">
                <Input size="sm" value={edit.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Product title" />
              </Field>
              <HStack spacing={2}>
                <Field label="Brand"><Input size="sm" value={edit.brand} onChange={(e) => onChange({ brand: e.target.value })} placeholder="Brand" /></Field>
                <Field label="Category"><Input size="sm" value={edit.category} onChange={(e) => onChange({ category: e.target.value })} placeholder="Category" /></Field>
              </HStack>
              <HStack spacing={2}>
                <Field label="Price"><Input size="sm" type="number" step="0.01" value={edit.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="0.00" /></Field>
                <Field label="Currency"><Input size="sm" value={edit.currency} onChange={(e) => onChange({ currency: e.target.value })} placeholder="USD" maxLength={3} /></Field>
              </HStack>
              <Field label="Image URL"><Input size="sm" value={edit.imageUrl} onChange={(e) => onChange({ imageUrl: e.target.value })} placeholder="https://…" /></Field>
              <Field label="Product URL"><Input size="sm" value={edit.productUrl} onChange={(e) => onChange({ productUrl: e.target.value })} placeholder="https://…" /></Field>
            </VStack>

            <HStack spacing={2} mt={3} justify="flex-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSave(false)}
                isDisabled={saving}
                isLoading={saving}
              >
                Save edits
              </Button>
              {row.draft && (
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => onSave(true)}
                  isDisabled={saving || !edit.title.trim()}
                  isLoading={saving}
                  loadingText="Saving…"
                >
                  Save & add to catalog
                </Button>
              )}
            </HStack>
          </Box>
        </HStack>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box flex={1} minW={0}>
      <Text fontSize="9px" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={0.5}>{label}</Text>
      {children}
    </Box>
  );
}
