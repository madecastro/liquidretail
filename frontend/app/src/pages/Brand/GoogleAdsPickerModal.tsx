// Google Ads picker modal — sibling to AdsPickerModal.
//
// Single-step picker: pick one Google Ads customer (account) to bind
// to this brand. Backend lists every accessible customer (skipping MCC
// manager accounts from display), pre-selects the current binding (if
// any), and validates the chosen id against the token-accessible set
// on save.
//
// Wires:
//   GET   /api/integrations/google-ads/:credId/options
//   PATCH /api/integrations/google-ads/:credId/selection

import { useEffect, useState, useMemo } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Box, VStack, HStack, Text, Heading, Button, Spinner, Badge, Radio, RadioGroup,
  Flex, useToast, Input
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';

type Customer = {
  customerId:      string;
  descriptiveName: string | null;
  currencyCode:    string | null;
  timeZone:        string | null;
  manager:         boolean;
};

type OptionsResponse = {
  options: { customers: Customer[] };
  current: { customerId: string | null };
};

type Props = {
  isOpen:        boolean;
  onClose:       () => void;
  credentialId:  string | null;
  onCompleted:   () => void;
};

export function GoogleAdsPickerModal({ isOpen, onClose, credentialId, onCompleted }: Props) {
  const toast = useToast();
  const [opts, setOpts]               = useState<OptionsResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [customerId, setCustomerId]   = useState<string | null>(null);
  const [filter, setFilter]           = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!isOpen || !credentialId) { setOpts(null); return; }
    setLoading(true);
    setError(null);
    setCustomerId(null);
    setFilter('');
    void (async () => {
      try {
        const res = await apiJson<OptionsResponse>(`/api/integrations/google-ads/${credentialId}/options`);
        setOpts(res);
        setCustomerId(res.current?.customerId || null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load Google Ads accounts');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, credentialId]);

  const filtered = useMemo(() => {
    const all = opts?.options.customers || [];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(c =>
      (c.descriptiveName || '').toLowerCase().includes(q) ||
      c.customerId.includes(q)
    );
  }, [opts, filter]);

  const selected = opts?.options.customers.find(c => c.customerId === customerId) || null;

  const save = async () => {
    if (!credentialId || !customerId) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/api/integrations/google-ads/${credentialId}/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      toast({
        title:       'Google Ads linked',
        description: selected?.descriptiveName ? `Connected to ${selected.descriptiveName}` : `Connected to ${customerId}`,
        status:      'success',
        duration:    3000
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
            <GoogleAdsIcon />
            <Box>
              <Heading size="md">Connect Google Ads</Heading>
              <Text fontSize="xs" color="brand.muted" fontWeight="400">
                Pick the Google Ads account this brand should sync campaigns from.
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
              {opts.options.customers.length > 6 && (
                <Input
                  size="sm"
                  placeholder="Filter by name or customer id…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
              )}

              {filtered.length === 0 ? (
                <Box bg="gray.50" borderRadius="md" p={3}>
                  <Text fontSize="xs" color="brand.muted" fontStyle="italic">
                    {opts.options.customers.length === 0
                      ? 'No Google Ads accounts accessible with this token. Re-authorize and grant the Google Ads scope.'
                      : 'No accounts match the filter.'}
                  </Text>
                </Box>
              ) : (
                <RadioGroup value={customerId || ''} onChange={v => setCustomerId(v)}>
                  <VStack align="stretch" spacing={2}>
                    {filtered.map(c => <CustomerRow key={c.customerId} customer={c} selected={c.customerId === customerId} />)}
                  </VStack>
                </RadioGroup>
              )}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={saving}>Cancel</Button>
          <Button variant="brand" onClick={save} isLoading={saving} isDisabled={!customerId}>
            Save & Activate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function CustomerRow({ customer, selected }: { customer: Customer; selected: boolean }) {
  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <Radio value={customer.customerId}>
        <HStack spacing={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="700">
            {customer.descriptiveName || '(unnamed account)'}
          </Text>
          {customer.manager && (
            <Badge fontSize="9px" colorScheme="orange" variant="subtle">Manager (MCC)</Badge>
          )}
          {customer.currencyCode && (
            <Badge fontSize="9px" colorScheme="gray" variant="outline">{customer.currencyCode}</Badge>
          )}
        </HStack>
        <HStack spacing={2} mt={0.5}>
          <Text fontSize="10px" color="brand.muted" fontFamily="mono">{customer.customerId}</Text>
          {customer.timeZone && <Text fontSize="10px" color="brand.muted">· {customer.timeZone}</Text>}
        </HStack>
      </Radio>
    </Box>
  );
}

function GoogleAdsIcon() {
  return (
    <Box
      w="32px" h="32px"
      borderRadius="md"
      bgImage="linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335)"
      display="flex" alignItems="center" justifyContent="center"
      color="white" fontSize="9px" fontWeight="800"
    >
      Ads
    </Box>
  );
}
