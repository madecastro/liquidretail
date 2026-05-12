import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, FormControl, FormLabel, FormHelperText, Input,
  Button, VStack, Text, useToast
} from '@chakra-ui/react';
import { apiJson } from '../auth/apiFetch';
import type { BrandSummary } from '../brand/types';

type CreateResponse = {
  brand: {
    id:           string;
    name:         string;
    slug:         string;
    websiteUrl:   string | null;
    primaryColor: string | null;
    source:       string;
  };
};

type Props = {
  isOpen:    boolean;
  onClose:   () => void;
  // Receive the full new brand object so the caller can promote it to
  // active without waiting for a brand-list refresh to land (which
  // would otherwise leave setActiveBrand looking up the new id in a
  // stale `brands` array — silent failure, localStorage.brand_id
  // never flips, every subsequent request scopes to the OLD brand).
  onCreated: (brand: BrandSummary) => void;
};

export function NewBrandModal({ isOpen, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [url, setUrl]   = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const normalized  = url.trim() ? normalizeUrl(url) : '';
  const canSubmit   = trimmedName.length > 0 && normalized !== null && !urlError && !submitting;

  const onUrlBlur = () => {
    const v = url.trim();
    if (!v) { setUrlError(null); return; }
    if (!normalizeUrl(v)) setUrlError("That doesn't look like a valid URL — e.g. yourbrand.com");
    else setUrlError(null);
  };

  const reset = () => {
    setName(''); setUrl(''); setUrlError(null); setSubmitting(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiJson<CreateResponse>('/api/brand', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: trimmedName, websiteUrl: normalized || null })
      });
      toast({
        title:       'Brand created',
        description: 'Enrichment running in the background — connect integrations next to populate the catalog.',
        status:      'success',
        duration:    3500
      });
      reset();
      // Pad the response into a BrandSummary so callers can use it
      // immediately (the /api/brand POST response is a slim shape;
      // missing fields default to safe nulls/empty arrays).
      onCreated({
        id:                res.brand.id,
        name:              res.brand.name,
        slug:              res.brand.slug,
        logoUrl:           null,
        websiteUrl:        res.brand.websiteUrl,
        primaryColor:      res.brand.primaryColor,
        source:            res.brand.source,
        enrichmentSources: [],
        curatedFields:     ['name'],
        createdAt:         new Date().toISOString()
      });
    } catch (e) {
      toast({
        title:       'Could not create brand',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    6000
      });
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New brand</ModalHeader>
        <ModalCloseButton isDisabled={submitting} />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Brand name</FormLabel>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Hot Crispy Oil"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && canSubmit) void submit(); }}
              />
            </FormControl>
            <FormControl isInvalid={!!urlError}>
              <FormLabel fontSize="sm">Website URL <Text as="span" color="brand.muted" fontWeight="normal">(optional)</Text></FormLabel>
              <Input
                value={url}
                onChange={e => { setUrl(e.target.value); if (urlError) setUrlError(null); }}
                onBlur={onUrlBlur}
                placeholder="yourbrand.com"
                onKeyDown={e => { if (e.key === 'Enter' && canSubmit) void submit(); }}
              />
              <FormHelperText fontSize="xs" color={urlError ? 'red.500' : 'brand.muted'}>
                {urlError || 'Provide a URL to kick off background enrichment (colors, voice, personas).'}
              </FormHelperText>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={handleClose} isDisabled={submitting}>Cancel</Button>
          <Button colorScheme="purple" onClick={submit} isLoading={submitting} isDisabled={!canSubmit}>
            Create brand
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    if (u.hostname === 'localhost') return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
