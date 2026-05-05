// Phase A-3 — Collections manager modal. Lists/edits/deletes the
// active brand's collections. Also provides a "view" action that
// returns the selected collection up to the parent so the sidebar
// can filter to just that collection's media.

import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Button, VStack, HStack, Text, Badge, IconButton, Input, useToast, Box, Divider
} from '@chakra-ui/react';
import { renameCollection, deleteCollection } from './collectionsApi';
import type { Collection } from './collectionsApi';

type Props = {
  isOpen:    boolean;
  onClose:   () => void;
  collections: Collection[];
  activeFilterId: string | null;        // currently filtered collection (if any)
  onSelectFilter: (id: string | null) => void;
  onChanged:    () => void;
};

export function CollectionsManager({
  isOpen, onClose, collections, activeFilterId, onSelectFilter, onChanged
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Collections</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {collections.length === 0 ? (
            <Box py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted">No collections yet.</Text>
              <Text fontSize="xs" color="brand.muted" mt={2}>
                Use the "Add to Collection" menu in the bottom action bar to create your first one.
              </Text>
            </Box>
          ) : (
            <VStack align="stretch" spacing={2} divider={<Divider />}>
              {collections.map(c => (
                <CollectionRow
                  key={c.id}
                  collection={c}
                  isActiveFilter={c.id === activeFilterId}
                  onSelectFilter={() => {
                    onSelectFilter(c.id === activeFilterId ? null : c.id);
                  }}
                  onChanged={onChanged}
                />
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => { onSelectFilter(null); onClose(); }} variant="ghost" mr={2}>
            Clear filter
          </Button>
          <Button onClick={onClose} variant="brand">Done</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function CollectionRow({
  collection: c, isActiveFilter, onSelectFilter, onChanged
}: {
  collection: Collection;
  isActiveFilter: boolean;
  onSelectFilter: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    if (name.trim() === c.name) { setEditing(false); return; }
    setBusy(true);
    try {
      await renameCollection(c.id, name.trim());
      toast({ title: `Renamed to "${name.trim()}"`, status: 'success', duration: 2000 });
      setEditing(false);
      onChanged();
    } catch (err: unknown) {
      toast({
        title: 'Rename failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(`Delete collection "${c.name}"? Media inside will not be deleted.`);
    if (!ok) return;
    setBusy(true);
    try {
      await deleteCollection(c.id);
      toast({ title: `Collection deleted`, status: 'success', duration: 2000 });
      onChanged();
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <HStack
      justify="space-between"
      py={2}
      px={2}
      borderRadius="md"
      bg={isActiveFilter ? 'rsViolet.50' : 'transparent'}
    >
      <Box flex={1} minW={0}>
        {editing ? (
          <Input
            autoFocus
            size="sm"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') { setName(c.name); setEditing(false); }
            }}
            isDisabled={busy}
          />
        ) : (
          <HStack spacing={2}>
            <Text
              fontSize="sm"
              fontWeight="700"
              color="brand.ink"
              cursor="pointer"
              onClick={() => setEditing(true)}
            >
              {c.name}
            </Text>
            <Badge variant="subtle" fontSize="9px" colorScheme="gray">{c.mediaCount}</Badge>
            {isActiveFilter && (
              <Badge variant="subtle" fontSize="9px" colorScheme="purple">filtering</Badge>
            )}
          </HStack>
        )}
      </Box>
      <HStack spacing={1}>
        <Button size="xs" variant="outline" onClick={onSelectFilter} isDisabled={busy}>
          {isActiveFilter ? 'Clear filter' : 'Filter list'}
        </Button>
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Delete collection"
          onClick={remove}
          isDisabled={busy}
          colorScheme="red"
          icon={<TrashIcon />}
        />
      </HStack>
    </HStack>
  );
}

function TrashIcon() {
  return (
    <Box as="svg" viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></Box>
  );
}
