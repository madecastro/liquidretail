// Phase 4a — sticky save bar.
// Phase 4b — wired to useBrandEdit. Cancel discards the draft; Save
// Changes PATCHes only dirty fields and exits edit mode on success.
// Surface only when isEditing OR dirty so the bar is invisible during
// pure read-mode browsing.

import { Box, HStack, Button, Text, Icon } from '@chakra-ui/react';

type Props = {
  isEditing: boolean;
  dirty:     boolean;
  saving:    boolean;
  error:     string | null;
  onCancel:  () => void;
  onSave:    () => void;
};

export function SaveBar({ isEditing, dirty, saving, error, onCancel, onSave }: Props) {
  // Hide entirely when not editing AND no dirty state — keeps the
  // page clean for read-only viewing.
  if (!isEditing && !dirty && !saving) return null;

  return (
    <Box
      position="sticky"
      bottom={0}
      bg="brand.surface"
      borderTopWidth="1px"
      borderTopColor="brand.border"
      px={5}
      py={3}
      mt={4}
      zIndex={1}
      boxShadow="0 -4px 12px rgba(0,0,0,0.04)"
    >
      <HStack justify="flex-end" spacing={3}>
        <Box flex={1}>
          {error ? (
            <Text fontSize="xs" color="red.600" fontWeight="600">{error}</Text>
          ) : saving ? (
            <Text fontSize="xs" color="brand.muted">Saving…</Text>
          ) : dirty ? (
            <HStack spacing={1.5}>
              <DotIcon />
              <Text fontSize="xs" color="orange.600" fontWeight="600">Unsaved changes</Text>
            </HStack>
          ) : (
            <HStack spacing={1.5}>
              <CheckIcon />
              <Text fontSize="xs" color="green.600" fontWeight="600">All changes saved</Text>
            </HStack>
          )}
        </Box>
        <Button variant="outline" size="sm" onClick={onCancel} isDisabled={saving}>
          Cancel
        </Button>
        <Button variant="brand" size="sm" onClick={onSave} isDisabled={!dirty || saving} isLoading={saving}>
          Save Changes
        </Button>
      </HStack>
    </Box>
  );
}

function CheckIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px" color="green.500"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></Icon>;
}
function DotIcon() {
  return <Icon viewBox="0 0 24 24" w="10px" h="10px" color="orange.500"><circle fill="currentColor" cx="12" cy="12" r="6" /></Icon>;
}
