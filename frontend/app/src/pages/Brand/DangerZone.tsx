// Phase 4a — danger zone for destructive brand operations.
// Wires DELETE /api/brand/:id which cascades through cascadeDeleteBrand
// (media + artifacts + catalog products + categories + integration
// credentials + campaigns + cloudinary).
//
// Type-to-confirm matches the legacy brand.html UX so power users
// can't fat-finger the delete.

import { useState } from 'react';
import {
  Box, HStack, VStack, Text, Button, Icon,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Input, FormControl, FormLabel, useDisclosure, useToast
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';
import type { Brand } from './types';

export function DangerZone({ brand }: { brand: Brand }) {
  const dialog = useDisclosure();

  return (
    <>
      <Box
        borderWidth="1px"
        borderColor="red.200"
        bg="red.50"
        borderRadius="lg"
        p={4}
      >
        <HStack justify="space-between" align="flex-start">
          <HStack spacing={3} align="flex-start">
            <Box color="red.500" mt={0.5}><AlertIcon /></Box>
            <Box>
              <Text fontSize="xs" fontWeight="800" color="red.700" textTransform="uppercase" letterSpacing="0.06em">
                Danger Zone
              </Text>
              <Text fontSize="sm" fontWeight="700" color="brand.ink" mt={1}>Delete this brand</Text>
              <Text fontSize="xs" color="brand.muted" mt={0.5}>
                Permanently removes this brand and all related data including products, campaigns, media, and integrations. This action cannot be undone.
              </Text>
            </Box>
          </HStack>
          <Button colorScheme="red" size="sm" onClick={dialog.onOpen} flexShrink={0}>
            Delete Brand
          </Button>
        </HStack>
      </Box>

      <ConfirmDeleteModal
        isOpen={dialog.isOpen}
        onClose={dialog.onClose}
        brand={brand}
      />
    </>
  );
}

function ConfirmDeleteModal({ isOpen, onClose, brand }: { isOpen: boolean; onClose: () => void; brand: Brand }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy]   = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { refreshBrands } = useBrand();
  const matches = typed.trim() === brand.name.trim();

  const handleDelete = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      // Backend has its own type-to-confirm gate (DELETE /api/brand/:id
      // requires { confirmName } in the body matching brand.name exactly).
      // Pass through the typed string the user just confirmed against.
      await apiJson(`/api/brand/${brand._id}`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirmName: brand.name })
      });
      // BrandContext refreshes its brand list and picks a new active
      // brand if the deleted one was active. Brand-id selection
      // happens in the picker.
      localStorage.removeItem('brand_id');
      localStorage.removeItem('brand_name');
      window.dispatchEvent(new Event('brand:change'));
      await refreshBrands();
      toast({
        title: `Brand "${brand.name}" deleted`,
        description: 'All related data was removed.',
        status: 'success',
        duration: 3500
      });
      onClose();
      navigate('/brand');
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 5000
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="red.700">Delete brand?</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text fontSize="sm">
              This permanently deletes <Text as="span" fontWeight="700">{brand.name}</Text> and every related Media, CatalogProduct, Category, Campaign, and IntegrationCredential. Cloudinary assets are queued for cleanup. <Text as="span" fontWeight="700">This cannot be undone.</Text>
            </Text>
            <FormControl>
              <FormLabel fontSize="xs" color="brand.muted">
                Type <Text as="span" fontWeight="700" fontFamily="mono">{brand.name}</Text> to confirm
              </FormLabel>
              <Input
                autoFocus
                value={typed}
                onChange={e => setTyped(e.target.value)}
                isDisabled={busy}
                placeholder={brand.name}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={busy}>Cancel</Button>
          <Button colorScheme="red" onClick={handleDelete} isDisabled={!matches} isLoading={busy}>
            Delete brand
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AlertIcon() {
  return <Icon viewBox="0 0 24 24" w="20px" h="20px"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></Icon>;
}
