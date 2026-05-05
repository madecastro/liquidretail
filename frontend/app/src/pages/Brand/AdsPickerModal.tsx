// Phase 4 follow-up #4 — Meta Ads picker modal.
//
// Single-step picker: pick one ad account to bind to this brand.
// Backend lists every ad account the captured token can access,
// pre-selects the current binding (if any), and validates the
// chosen id against the token-accessible set on save.
//
// Wires:
//   GET /api/integrations/meta-ads/:credId/options
//   PATCH /api/integrations/meta-ads/:credId/selection

import { useEffect, useState, useMemo } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Box, VStack, HStack, Text, Heading, Button, Spinner, Badge, Radio, RadioGroup,
  Flex, useToast, Input
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';

type AdAccount = {
  id:               string;
  accountIdNumeric: string | null;
  name:             string;
  currency:         string | null;
  timezone:         string | null;
  accountStatus:    number | null;
  business:         { id: string; name: string | null } | null;
};

type OptionsResponse = {
  options: { adAccounts: AdAccount[] };
  current: { adAccountId: string | null };
};

type Props = {
  isOpen:        boolean;
  onClose:       () => void;
  credentialId:  string | null;
  onCompleted:   () => void;
};

export function AdsPickerModal({ isOpen, onClose, credentialId, onCompleted }: Props) {
  const toast = useToast();
  const [opts, setOpts]       = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [adAccountId, setAdAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!isOpen || !credentialId) { setOpts(null); return; }
    setLoading(true);
    setError(null);
    setAdAccountId(null);
    setFilter('');
    void (async () => {
      try {
        const res = await apiJson<OptionsResponse>(`/api/integrations/meta-ads/${credentialId}/options`);
        setOpts(res);
        setAdAccountId(res.current?.adAccountId || null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load ad accounts');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, credentialId]);

  const filtered = useMemo(() => {
    const accs = opts?.options.adAccounts || [];
    const q = filter.trim().toLowerCase();
    if (!q) return accs;
    return accs.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.business?.name || '').toLowerCase().includes(q) ||
      (a.accountIdNumeric || '').includes(q)
    );
  }, [opts, filter]);

  const selected = opts?.options.adAccounts.find(a => a.id === adAccountId) || null;

  const save = async () => {
    if (!credentialId || !adAccountId) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/api/integrations/meta-ads/${credentialId}/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId })
      });
      toast({
        title: 'Meta Ads linked',
        description: selected?.name ? `Connected to ${selected.name}` : `Connected to ${adAccountId}`,
        status: 'success',
        duration: 3000
      });
      onCompleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <AdsIcon />
            <Box>
              <Heading size="md">Connect Meta Ads</Heading>
              <Text fontSize="xs" color="brand.muted" fontWeight="400">
                Pick the ad account this brand should sync campaigns from.
              </Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
          {loading ? (
            <Flex py={8} align="center" justify="center"><Spinner /></Flex>
          ) : error ? (
            <Box bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md" p={3}>
              <Text fontSize="sm" color="red.700">{error}</Text>
            </Box>
          ) : opts ? (
            <VStack align="stretch" spacing={4}>
              {opts.options.adAccounts.length > 6 && (
                <Input
                  size="sm"
                  placeholder="Filter by name, business, or numeric ID…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
              )}

              {filtered.length === 0 ? (
                <Box bg="gray.50" borderRadius="md" p={3}>
                  <Text fontSize="xs" color="brand.muted" fontStyle="italic">
                    {opts.options.adAccounts.length === 0
                      ? 'No ad accounts accessible with this token. Re-authorize and grant the requested scopes.'
                      : 'No accounts match the filter.'}
                  </Text>
                </Box>
              ) : (
                <RadioGroup value={adAccountId || ''} onChange={v => setAdAccountId(v)}>
                  <VStack align="stretch" spacing={2}>
                    {filtered.map(a => <AdAccountRow key={a.id} account={a} selected={a.id === adAccountId} />)}
                  </VStack>
                </RadioGroup>
              )}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={saving}>Cancel</Button>
          <Button variant="brand" onClick={save} isLoading={saving} isDisabled={!adAccountId}>
            Save & Activate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AdAccountRow({ account, selected }: { account: AdAccount; selected: boolean }) {
  const statusLabel = account.accountStatus === 1 ? 'Active'
                    : account.accountStatus === 2 ? 'Disabled'
                    : account.accountStatus === 3 ? 'Unsettled'
                    : account.accountStatus === 7 ? 'Pending review'
                    : account.accountStatus === 9 ? 'In grace period'
                    : account.accountStatus === 100 ? 'Pending closure'
                    : null;
  const statusColor = account.accountStatus === 1 ? 'green' : 'gray';

  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <Radio value={account.id}>
        <HStack spacing={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="700">{account.name || '(unnamed account)'}</Text>
          {statusLabel && <Badge fontSize="9px" colorScheme={statusColor} variant="subtle">{statusLabel}</Badge>}
          {account.currency && <Badge fontSize="9px" colorScheme="gray" variant="outline">{account.currency}</Badge>}
        </HStack>
        <HStack spacing={2} mt={0.5}>
          {account.business?.name && <Text fontSize="10px" color="brand.muted">{account.business.name}</Text>}
          {account.accountIdNumeric && <Text fontSize="10px" color="brand.muted" fontFamily="mono">· act_{account.accountIdNumeric}</Text>}
          {account.timezone && <Text fontSize="10px" color="brand.muted">· {account.timezone}</Text>}
        </HStack>
      </Radio>
    </Box>
  );
}

function AdsIcon() {
  return (
    <Box
      w="32px" h="32px"
      borderRadius="md"
      bg="#0866FF"
      display="flex" alignItems="center" justifyContent="center"
      color="white" fontSize="xs" fontWeight="800"
    >
      Ads
    </Box>
  );
}
