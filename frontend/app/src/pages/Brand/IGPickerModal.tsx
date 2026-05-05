// Phase 4 follow-up #4 — Instagram picker modal.
//
// Drives the post-OAuth selection flow that previously only existed
// on the legacy /brand.html. After IG OAuth completes, the credential
// is in 'pending' status with a captured token but no Page / IG
// Business Account / Catalog binding yet. This modal lets the
// operator pick from the union of options the token can access and
// flips status to 'active' on save.
//
// Three optional steps:
//   1. Page  — required; pick a Facebook Page to bind to this brand
//   2. IG Business Account — auto-derived from the chosen page's
//      `igBusinessAccount` link; pre-selected and locked
//   3. Catalog — optional; pick from owned product catalogs across
//      the operator's businesses, or leave blank
//
// Wires:
//   GET /api/integrations/instagram/:credId/options
//   PATCH /api/integrations/instagram/:credId/selection

import { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Box, VStack, HStack, Text, Heading, Button, Spinner, Badge, Radio, RadioGroup,
  Flex, useToast, Icon
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';

type Page = {
  id:                string;
  name:              string;
  igBusinessAccount: { id: string; username: string | null } | null;
};

type Catalog = {
  id:           string;
  name:         string;
  businessName: string;
  productCount: number | null;
};

type OptionsResponse = {
  options: { pages: Page[]; catalogs: Catalog[] };
  current: { pageId: string | null; igUserId: string | null; catalogId: string | null };
};

type Props = {
  isOpen:        boolean;
  onClose:       () => void;
  credentialId:  string | null;
  onCompleted:   () => void;
};

export function IGPickerModal({ isOpen, onClose, credentialId, onCompleted }: Props) {
  const toast = useToast();
  const [opts, setOpts]       = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [pageId, setPageId]       = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

  // Fetch options when the modal opens
  useEffect(() => {
    if (!isOpen || !credentialId) { setOpts(null); return; }
    setLoading(true);
    setError(null);
    setPageId(null);
    setCatalogId(null);
    void (async () => {
      try {
        const res = await apiJson<OptionsResponse>(`/api/integrations/instagram/${credentialId}/options`);
        setOpts(res);
        setPageId(res.current?.pageId || null);
        setCatalogId(res.current?.catalogId || null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load options');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, credentialId]);

  const selectedPage = opts?.options.pages.find(p => p.id === pageId) || null;
  const igUserId     = selectedPage?.igBusinessAccount?.id || null;

  const save = async () => {
    if (!credentialId || !pageId) return;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/api/integrations/instagram/${credentialId}/selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, igUserId, catalogId })
      });
      toast({
        title: 'Instagram linked',
        description: selectedPage?.igBusinessAccount?.username
          ? `Connected to @${selectedPage.igBusinessAccount.username}`
          : `Connected to ${selectedPage?.name}`,
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
            <IGIcon />
            <Box>
              <Heading size="md">Connect Instagram</Heading>
              <Text fontSize="xs" color="brand.muted" fontWeight="400">
                Pick a Facebook Page (and optionally a Catalog) to bind to this brand.
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
            <VStack align="stretch" spacing={6}>
              <Section title="1 · Facebook Page" required>
                {opts.options.pages.length === 0 ? (
                  <EmptyState text="No Facebook Pages accessible with this token. Re-authorize and grant the requested scopes." />
                ) : (
                  <RadioGroup value={pageId || ''} onChange={(v) => setPageId(v)}>
                    <VStack align="stretch" spacing={2}>
                      {opts.options.pages.map(p => (
                        <PageRow key={p.id} page={p} selected={p.id === pageId} />
                      ))}
                    </VStack>
                  </RadioGroup>
                )}
              </Section>

              <Section title="2 · Instagram Business Account" optional>
                {!selectedPage ? (
                  <EmptyState text="Pick a Page first." />
                ) : selectedPage.igBusinessAccount ? (
                  <HStack
                    bg="rsViolet.50"
                    borderWidth="1px"
                    borderColor="rsViolet.200"
                    borderRadius="md"
                    p={3}
                    spacing={3}
                  >
                    <CheckIcon />
                    <Box>
                      <Text fontSize="sm" fontWeight="700" color="brand.ink">
                        @{selectedPage.igBusinessAccount.username || '(no username)'}
                      </Text>
                      <Text fontSize="xs" color="brand.muted">
                        Auto-derived from the selected Page's linked IG business account.
                      </Text>
                    </Box>
                  </HStack>
                ) : (
                  <EmptyState text="The selected Page has no linked Instagram Business Account. Catalog and post syncs will skip this credential." />
                )}
              </Section>

              <Section title="3 · Product Catalog" optional>
                {opts.options.catalogs.length === 0 ? (
                  <EmptyState text="No product catalogs accessible. You can still connect Instagram and skip this step — catalog matching will run on the brand's other catalog sources." />
                ) : (
                  <RadioGroup value={catalogId || ''} onChange={(v) => setCatalogId(v || null)}>
                    <VStack align="stretch" spacing={2}>
                      <Box
                        borderWidth="1px"
                        borderColor={catalogId ? 'brand.border' : 'rsViolet.200'}
                        bg={catalogId ? 'brand.surface' : 'rsViolet.50'}
                        borderRadius="md"
                        p={3}
                      >
                        <Radio value="">
                          <Text fontSize="sm" fontWeight="600">Skip catalog</Text>
                          <Text fontSize="xs" color="brand.muted">No Meta product catalog binding</Text>
                        </Radio>
                      </Box>
                      {opts.options.catalogs.map(c => (
                        <CatalogRow key={c.id} catalog={c} selected={c.id === catalogId} />
                      ))}
                    </VStack>
                  </RadioGroup>
                )}
              </Section>
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={saving}>Cancel</Button>
          <Button variant="brand" onClick={save} isLoading={saving} isDisabled={!pageId}>
            Save & Activate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function Section({ title, required, optional, children }: { title: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <Box>
      <HStack mb={2}>
        <Heading size="xs">{title}</Heading>
        {required && <Badge fontSize="9px" colorScheme="red" variant="subtle">Required</Badge>}
        {optional && <Badge fontSize="9px" colorScheme="gray" variant="subtle">Optional</Badge>}
      </HStack>
      {children}
    </Box>
  );
}

function PageRow({ page, selected }: { page: Page; selected: boolean }) {
  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <Radio value={page.id}>
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="700">{page.name}</Text>
          {page.igBusinessAccount && (
            <Badge fontSize="9px" colorScheme="purple" variant="subtle">
              @{page.igBusinessAccount.username || page.igBusinessAccount.id}
            </Badge>
          )}
        </HStack>
        <Text fontSize="10px" color="brand.muted" fontFamily="mono">{page.id}</Text>
      </Radio>
    </Box>
  );
}

function CatalogRow({ catalog, selected }: { catalog: Catalog; selected: boolean }) {
  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <Radio value={catalog.id}>
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="700">{catalog.name || '(unnamed)'}</Text>
          {catalog.productCount != null && (
            <Badge fontSize="9px" colorScheme="blue" variant="subtle">{catalog.productCount.toLocaleString()} products</Badge>
          )}
        </HStack>
        <Text fontSize="10px" color="brand.muted">{catalog.businessName} · <Text as="span" fontFamily="mono">{catalog.id}</Text></Text>
      </Radio>
    </Box>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Box bg="gray.50" borderRadius="md" p={3}>
      <Text fontSize="xs" color="brand.muted" fontStyle="italic">{text}</Text>
    </Box>
  );
}

function IGIcon() {
  return (
    <Box
      w="32px" h="32px"
      borderRadius="md"
      bgImage="linear-gradient(135deg, #FEDA77, #F58529, #DD2A7B, #8134AF, #515BD4)"
      display="flex" alignItems="center" justifyContent="center"
      color="white" fontSize="xs" fontWeight="800"
    >
      IG
    </Box>
  );
}

function CheckIcon() {
  return <Icon viewBox="0 0 24 24" w="20px" h="20px" color="rsViolet.500"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></Icon>;
}
