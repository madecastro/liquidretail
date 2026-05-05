// Phase A-3 — Add to Collection dropdown for the bottom action bar.
// Lists the active brand's collections + an inline "Create new
// collection…" affordance. Adding to a collection echoes a toast +
// optimistically refreshes the collection list so the count updates.

import { useState } from 'react';
import {
  Button, Menu, MenuButton, MenuList, MenuItem, MenuDivider,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Input, FormControl, FormLabel, useToast, useDisclosure, Text, HStack, Badge
} from '@chakra-ui/react';
import { addMediaToCollection, createCollection } from './collectionsApi';
import { useBrand } from '../../brand/BrandContext';
import type { Collection } from './collectionsApi';

type Props = {
  mediaIds:        string[];                    // selected media (single or multi)
  collections:     Collection[];
  onChanged:       () => void;                  // refresh collection list after mutate
  isDisabled?:     boolean;
};

export function AddToCollectionMenu({ mediaIds, collections, onChanged, isDisabled }: Props) {
  const toast = useToast();
  const create = useDisclosure();
  const { activeBrand } = useBrand();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAdd = async (col: Collection) => {
    if (!mediaIds.length) return;
    setBusyId(col.id);
    try {
      await addMediaToCollection(col.id, mediaIds);
      toast({
        title: `Added to "${col.name}"`,
        description: mediaIds.length === 1 ? '1 media added' : `${mediaIds.length} media added`,
        status: 'success',
        duration: 2500
      });
      onChanged();
    } catch (err: unknown) {
      toast({
        title: 'Add failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Menu placement="top">
        <MenuButton as={Button} variant="outline" size="sm" isDisabled={isDisabled || !mediaIds.length}>
          Add to Collection
        </MenuButton>
        <MenuList maxH="340px" overflowY="auto" minW="240px">
          {collections.length === 0 ? (
            <MenuItem isDisabled fontSize="sm" color="brand.muted">No collections yet</MenuItem>
          ) : (
            collections.map(c => (
              <MenuItem
                key={c.id}
                onClick={() => handleAdd(c)}
                isDisabled={busyId !== null}
                fontSize="sm"
              >
                <HStack justify="space-between" w="100%">
                  <Text>{c.name}</Text>
                  <Badge variant="subtle" fontSize="9px" colorScheme="gray">{c.mediaCount}</Badge>
                </HStack>
              </MenuItem>
            ))
          )}
          <MenuDivider />
          <MenuItem onClick={create.onOpen} fontSize="sm" color="rsViolet.700" fontWeight="700">
            + Create new collection…
          </MenuItem>
        </MenuList>
      </Menu>

      <CreateCollectionModal
        isOpen={create.isOpen}
        onClose={create.onClose}
        brandId={activeBrand?.id || null}
        seedMediaIds={mediaIds}
        onCreated={() => { create.onClose(); onChanged(); }}
      />
    </>
  );
}

function CreateCollectionModal({
  isOpen, onClose, brandId, seedMediaIds, onCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  brandId: string | null;
  seedMediaIds: string[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleCreate = async () => {
    if (!brandId)       return toast({ title: 'No active brand',  status: 'error', duration: 3000 });
    if (!name.trim())   return toast({ title: 'Name is required', status: 'error', duration: 3000 });
    setBusy(true);
    try {
      await createCollection(brandId, name.trim(), seedMediaIds);
      toast({ title: `Collection "${name.trim()}" created`, status: 'success', duration: 2500 });
      setName('');
      onCreated();
    } catch (err: unknown) {
      toast({
        title: 'Create failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" initialFocusRef={undefined}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New Collection</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel fontSize="sm">Name</FormLabel>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Spring Launch · Approved UGC"
              maxLength={80}
            />
            {seedMediaIds.length > 0 && (
              <Text fontSize="xs" color="brand.muted" mt={2}>
                Will start with {seedMediaIds.length} media item{seedMediaIds.length === 1 ? '' : 's'}.
              </Text>
            )}
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={busy}>Cancel</Button>
          <Button variant="brand" onClick={handleCreate} isLoading={busy}>Create</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
