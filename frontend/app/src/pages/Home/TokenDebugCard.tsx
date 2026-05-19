// Token debug surface — collapsed-by-default card on /home.
//
// Operator-facing debug for IntegrationCredential state: fingerprint
// (first/last 4 chars of decrypted token), status, expiry, Meta-side
// scopes (via /debug_token), and linked platform IDs. Never renders
// the raw token — fingerprint is the security guardrail.
//
// Per-cred "Refresh" button busts the backend's 30s in-memory cache
// of /debug_token responses so operators can verify a fresh OAuth's
// scopes immediately.

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, CardBody, VStack, HStack, Text, Badge, Button, Spinner,
  Collapse, useDisclosure, SimpleGrid, Wrap, WrapItem
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type MetaProbe = {
  source?:    string;
  appId?:     string | null;
  userId?:    string | null;
  tokenType?: string | null;
  isValid?:   boolean;
  expiresAt?: string | null;
  dataAccessExpiresAt?: string | null;
  scopes?:    string[];
  metaError?: string | null;
};

type CredentialRow = {
  id:                  string;
  type:                'instagram' | 'meta-ads' | 'google-ads' | string;
  status:              string;
  tokenFingerprint:    string;
  tokenLength:         number;
  decryptError?:       string | null;
  platformData?:       Record<string, unknown> | null;
  lastUsedAt?:         string | null;
  lastCatalogSyncAt?:  string | null;
  lastPostsSyncAt?:    string | null;
  lastCampaignSyncAt?: string | null;
  createdAt?:          string | null;
  meta?:               MetaProbe | null;
};

type Resp = { credentials: CredentialRow[] };

export function TokenDebugCard() {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: false });
  const [rows, setRows]       = useState<CredentialRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = useCallback(async (refreshAll: boolean = false) => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ brandId });
      if (refreshAll) q.set('refresh', '1');
      const res = await apiJson<Resp>(`/api/integrations/token-debug?${q}`);
      setRows(res.credentials || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  // Lazy-load: only fetch when the operator expands the card. Avoids
  // an extra Graph round-trip per page load for the 95% of sessions
  // that never need the debug surface.
  useEffect(() => {
    if (isOpen && !rows && !loading) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function refreshOne(credId: string) {
    setRefreshingId(credId);
    try {
      const q = new URLSearchParams({ brandId: brandId || '', refresh: '1' });
      const res = await apiJson<Resp>(`/api/integrations/token-debug?${q}`);
      const fresh = res.credentials.find(c => c.id === credId);
      if (fresh) {
        setRows(prev => prev?.map(r => r.id === credId ? fresh : r) || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <Card variant="outline" borderStyle="dashed" borderColor="brand.muted">
      <CardBody py={3}>
        <HStack justify="space-between" align="center">
          <HStack spacing={2}>
            <Badge variant="subtle" colorScheme="gray" fontSize="9px">DEBUG</Badge>
            <Text fontSize="sm" fontWeight="700" color="brand.ink">Token status</Text>
            <Text fontSize="11px" color="brand.muted">
              {rows ? `${rows.length} credential${rows.length === 1 ? '' : 's'}` : ''}
            </Text>
          </HStack>
          <HStack spacing={2}>
            {isOpen && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => void load(true)}
                isDisabled={loading}
              >
                Refresh all
              </Button>
            )}
            <Button size="xs" variant="outline" onClick={onToggle}>
              {isOpen ? 'Hide' : 'Show'}
            </Button>
          </HStack>
        </HStack>

        <Collapse in={isOpen} animateOpacity>
          <Box pt={4}>
            {loading && !rows ? (
              <HStack py={4} justify="center" spacing={2}>
                <Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading credentials…</Text>
              </HStack>
            ) : error ? (
              <Text color="red.600" fontSize="sm">Failed to load: {error}</Text>
            ) : !rows || rows.length === 0 ? (
              <Text fontSize="sm" color="brand.muted" py={2}>
                No credentials on file for this brand. Connect Instagram or Meta Ads from the brand page.
              </Text>
            ) : (
              <VStack align="stretch" spacing={3}>
                {rows.map(r => (
                  <CredRow
                    key={r.id}
                    row={r}
                    refreshing={refreshingId === r.id}
                    onRefresh={() => refreshOne(r.id)}
                  />
                ))}
              </VStack>
            )}
          </Box>
        </Collapse>
      </CardBody>
    </Card>
  );
}

function CredRow({ row, refreshing, onRefresh }: {
  row:        CredentialRow;
  refreshing: boolean;
  onRefresh:  () => void;
}) {
  const typeLabel = row.type === 'instagram' ? 'Instagram'
                   : row.type === 'meta-ads' ? 'Meta Ads'
                   : row.type === 'google-ads' ? 'Google Ads'
                   : row.type;
  const isMeta = row.type === 'instagram' || row.type === 'meta-ads';
  const expiresMs = row.meta?.expiresAt ? new Date(row.meta.expiresAt).getTime() : null;
  const daysUntilExpiry = expiresMs != null
    ? Math.ceil((expiresMs - Date.now()) / 86400000)
    : null;
  const expiryTone =
    daysUntilExpiry == null     ? 'gray'
    : daysUntilExpiry < 0        ? 'red'
    : daysUntilExpiry <= 7       ? 'orange'
    : daysUntilExpiry <= 30      ? 'yellow'
    :                              'green';

  const pd = row.platformData || {};
  const linkedIds: Array<[string, string]> = [];
  if (pd.adAccountId)       linkedIds.push(['ad account', String(pd.adAccountId)]);
  if (pd.adAccountName)     linkedIds.push(['ad account name', String(pd.adAccountName)]);
  if (pd.currency)          linkedIds.push(['currency', String(pd.currency)]);
  // IG cred fields live on the top-level cred doc (pageId/igUserId/catalogId)
  // not in platformData — fall back to those on the row for instagram type.
  const cdRecord = row as unknown as Record<string, unknown>;
  if (typeof cdRecord.pageId      === 'string') linkedIds.push(['page',     cdRecord.pageId as string]);
  if (typeof cdRecord.igUserId    === 'string') linkedIds.push(['ig user',  cdRecord.igUserId as string]);
  if (typeof cdRecord.catalogId   === 'string') linkedIds.push(['catalog',  cdRecord.catalogId as string]);

  return (
    <Box borderWidth="1px" borderColor="brand.border" borderRadius="md" p={3}>
      <HStack justify="space-between" align="flex-start" mb={2}>
        <HStack spacing={2} wrap="wrap">
          <Badge colorScheme="purple" variant="subtle">{typeLabel}</Badge>
          <Badge colorScheme={row.status === 'active' ? 'green' : 'gray'} variant="solid" fontSize="9px">
            {row.status}
          </Badge>
          {row.decryptError && (
            <Badge colorScheme="red" variant="solid" fontSize="9px">decrypt-failed</Badge>
          )}
          {row.meta?.isValid === false && (
            <Badge colorScheme="red" variant="solid" fontSize="9px">META INVALID</Badge>
          )}
          {expiresMs != null && (
            <Badge colorScheme={expiryTone} variant="subtle" fontSize="9px">
              {daysUntilExpiry != null && daysUntilExpiry < 0
                ? `expired ${-daysUntilExpiry}d ago`
                : daysUntilExpiry != null
                  ? `expires in ${daysUntilExpiry}d`
                  : '—'}
            </Badge>
          )}
        </HStack>
        <Button
          size="xs"
          variant="ghost"
          onClick={onRefresh}
          isLoading={refreshing}
          isDisabled={!isMeta || refreshing}
          loadingText="…"
        >
          Refresh
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
        <Detail label="Token fingerprint">
          <Text fontFamily="mono" fontSize="11px">{row.tokenFingerprint}</Text>
          <Text fontSize="9px" color="brand.muted">{row.tokenLength} chars</Text>
        </Detail>
        {row.meta?.expiresAt && (
          <Detail label="Expires">
            <Text fontSize="11px">{new Date(row.meta.expiresAt).toLocaleString()}</Text>
          </Detail>
        )}
        {row.meta?.appId && (
          <Detail label="Meta app id">
            <Text fontFamily="mono" fontSize="11px">{row.meta.appId}</Text>
          </Detail>
        )}
        {row.meta?.userId && (
          <Detail label="Meta user id">
            <Text fontFamily="mono" fontSize="11px">{row.meta.userId}</Text>
          </Detail>
        )}
        {row.createdAt && (
          <Detail label="Created">
            <Text fontSize="11px">{new Date(row.createdAt).toLocaleString()}</Text>
          </Detail>
        )}
        {row.lastUsedAt && (
          <Detail label="Last used">
            <Text fontSize="11px">{new Date(row.lastUsedAt).toLocaleString()}</Text>
          </Detail>
        )}
        {row.lastCatalogSyncAt && (
          <Detail label="Last catalog sync">
            <Text fontSize="11px">{new Date(row.lastCatalogSyncAt).toLocaleString()}</Text>
          </Detail>
        )}
        {row.lastPostsSyncAt && (
          <Detail label="Last posts sync">
            <Text fontSize="11px">{new Date(row.lastPostsSyncAt).toLocaleString()}</Text>
          </Detail>
        )}
      </SimpleGrid>

      {linkedIds.length > 0 && (
        <Box mt={3}>
          <Text fontSize="9px" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={1}>
            Linked IDs
          </Text>
          <Wrap spacing={1}>
            {linkedIds.map(([k, v]) => (
              <WrapItem key={k}>
                <Badge variant="outline" fontSize="9px" textTransform="none">
                  <Text as="span" color="brand.muted">{k}: </Text>
                  <Text as="span" fontFamily="mono">{v}</Text>
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      )}

      {row.meta?.scopes && row.meta.scopes.length > 0 && (
        <Box mt={3}>
          <Text fontSize="9px" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={1}>
            Scopes ({row.meta.scopes.length}) — live from Meta /debug_token
          </Text>
          <Wrap spacing={1}>
            {row.meta.scopes.map(s => (
              <WrapItem key={s}>
                <Badge variant="subtle" colorScheme="green" fontSize="9px" textTransform="none">{s}</Badge>
              </WrapItem>
            ))}
          </Wrap>
        </Box>
      )}

      {row.meta?.metaError && (
        <Box mt={3} bg="red.50" borderWidth="1px" borderColor="red.300" borderRadius="md" p={2}>
          <Text fontSize="11px" color="red.700" fontWeight="700">Meta /debug_token error</Text>
          <Text fontSize="11px" color="red.700">{row.meta.metaError}</Text>
        </Box>
      )}

      {row.decryptError && (
        <Box mt={3} bg="red.50" borderWidth="1px" borderColor="red.300" borderRadius="md" p={2}>
          <Text fontSize="11px" color="red.700" fontWeight="700">Token decrypt failed</Text>
          <Text fontSize="11px" color="red.700">{row.decryptError}</Text>
        </Box>
      )}
    </Box>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="9px" fontWeight="800" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" mb={0.5}>
        {label}
      </Text>
      {children}
    </Box>
  );
}
