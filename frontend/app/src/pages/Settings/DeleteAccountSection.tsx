// Self-service account deletion.
//
// Mirrors the brand DangerZone pattern: pill-styled card with a
// destructive button → modal that loads the deletion preview from
// the backend, displays the impact (which advertisers cascade-delete
// vs. which memberships are revoked), then gates the final delete
// behind type-to-confirm-your-email.
//
// Sole-owner blockers (advertisers where the user is the sole owner
// AND other active members exist) short-circuit the flow with a
// helpful message — the user has to promote a new owner or remove
// the other members before they can self-delete.

import { useEffect, useState } from 'react';
import {
  Box, HStack, VStack, Text, Button, Icon,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Input, FormControl, FormLabel, useDisclosure, useToast, Spinner, Badge, Divider
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';

type Blocker = {
  advertiserId:       string;
  name:               string;
  slug:               string | null;
  otherActiveMembers: number;
};

type CascadeAdvertiser = {
  advertiserId: string;
  name:         string;
  slug:         string | null;
  brandCount:   number;
};

type RevokeMembership = {
  advertiserId: string;
  role:         string;
};

type Preview = {
  canDelete:           boolean;
  blockers:            Blocker[];
  advertisersToCascade: CascadeAdvertiser[];
  membershipsToRevoke:  RevokeMembership[];
};

export function DeleteAccountSection() {
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
              <Text fontSize="sm" fontWeight="700" color="brand.ink" mt={1}>Delete your account</Text>
              <Text fontSize="xs" color="brand.muted" mt={0.5}>
                Permanently removes your user record and revokes you from every workspace.
                Workspaces where you're the only member are deleted in full (every brand, media,
                catalog, integration, and rendered creative). This action cannot be undone.
              </Text>
            </Box>
          </HStack>
          <Button colorScheme="red" size="sm" onClick={dialog.onOpen} flexShrink={0}>
            Delete Account
          </Button>
        </HStack>
      </Box>

      <ConfirmDeleteAccountModal isOpen={dialog.isOpen} onClose={dialog.onClose} />
    </>
  );
}

function ConfirmDeleteAccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const auth = useAuth();
  const myEmail = auth.status === 'authenticated' ? auth.user.email : '';
  const [typed,   setTyped]   = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) {
      setTyped(''); setPreview(null); setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await apiJson<Preview>('/api/me/deletion-preview');
        setPreview(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  const matches = typed.trim().toLowerCase() === myEmail.trim().toLowerCase();
  const canSubmit = !!preview?.canDelete && matches && !busy;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await apiJson('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: myEmail })
      });
      toast({
        title: 'Account deleted',
        description: 'Your data has been removed. Signing you out now.',
        status: 'success',
        duration: 3500
      });
      // Brief pause so the toast renders before the redirect.
      setTimeout(() => auth.signOut(), 500);
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 5000
      });
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader color="red.700">Delete your account?</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody>
          {loading ? (
            <HStack py={4}><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Calculating impact…</Text></HStack>
          ) : error ? (
            <Box bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md" p={3}>
              <Text fontSize="sm" color="red.700">{error}</Text>
            </Box>
          ) : preview ? (
            <VStack align="stretch" spacing={4}>
              {!preview.canDelete && (
                <Box bg="orange.50" borderWidth="1px" borderColor="orange.200" borderRadius="md" p={3}>
                  <Text fontSize="sm" fontWeight="700" color="orange.700">
                    You're the sole owner of {preview.blockers.length} workspace{preview.blockers.length === 1 ? '' : 's'} with other members.
                  </Text>
                  <Text fontSize="xs" color="orange.700" mt={1}>
                    Promote another member to owner, or remove the other members, before deleting your account.
                  </Text>
                  <VStack align="stretch" spacing={1} mt={2}>
                    {preview.blockers.map(b => (
                      <HStack key={b.advertiserId} spacing={2}>
                        <Text fontSize="xs" fontWeight="700" color="brand.ink">{b.name}</Text>
                        <Badge fontSize="9px" colorScheme="orange" variant="subtle">
                          {b.otherActiveMembers} other member{b.otherActiveMembers === 1 ? '' : 's'}
                        </Badge>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}

              {preview.advertisersToCascade.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="700" color="red.700" textTransform="uppercase" letterSpacing="0.04em" mb={2}>
                    Will be permanently deleted
                  </Text>
                  <VStack align="stretch" spacing={1.5}>
                    {preview.advertisersToCascade.map(a => (
                      <HStack key={a.advertiserId} spacing={2} fontSize="sm">
                        <Text fontWeight="700" color="brand.ink">{a.name}</Text>
                        <Text color="brand.muted">·</Text>
                        <Text color="brand.muted" fontSize="xs">{a.brandCount} brand{a.brandCount === 1 ? '' : 's'} (with all media + artifacts)</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}

              {preview.membershipsToRevoke.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="700" color="brand.muted" textTransform="uppercase" letterSpacing="0.04em" mb={2}>
                    You'll be revoked from
                  </Text>
                  <VStack align="stretch" spacing={1}>
                    {preview.membershipsToRevoke.map(m => (
                      <HStack key={m.advertiserId} spacing={2} fontSize="sm">
                        <Text color="brand.ink">{m.advertiserId}</Text>
                        <Badge fontSize="9px" colorScheme="gray" variant="subtle">{m.role}</Badge>
                      </HStack>
                    ))}
                  </VStack>
                  <Text fontSize="10px" color="brand.muted" mt={1}>
                    These workspaces survive — only your access is removed.
                  </Text>
                </Box>
              )}

              {preview.advertisersToCascade.length === 0 && preview.membershipsToRevoke.length === 0 && (
                <Text fontSize="sm" color="brand.muted">
                  Your user record will be removed. You're not currently a member of any workspaces.
                </Text>
              )}

              {preview.canDelete && (
                <>
                  <Divider />
                  <FormControl>
                    <FormLabel fontSize="xs" color="brand.muted">
                      Type your email <Text as="span" fontWeight="700" fontFamily="mono">{myEmail}</Text> to confirm
                    </FormLabel>
                    <Input
                      autoFocus
                      value={typed}
                      onChange={e => setTyped(e.target.value)}
                      isDisabled={busy}
                      placeholder={myEmail}
                    />
                  </FormControl>
                </>
              )}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={2} onClick={onClose} isDisabled={busy}>Cancel</Button>
          <Button colorScheme="red" onClick={handleDelete} isDisabled={!canSubmit} isLoading={busy}>
            Delete account
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AlertIcon() {
  return <Icon viewBox="0 0 24 24" w="20px" h="20px"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></Icon>;
}
