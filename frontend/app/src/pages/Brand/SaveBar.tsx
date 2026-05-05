// Phase 4a — sticky save bar at the bottom of the page.
//
// Scaffold only in 4a — Phase 4b wires the dirty-tracking state from
// the editor cards. Today: when no edits are dirty, shows the "All
// changes saved" indicator. Cancel + Save Changes both no-op for now.

import { Box, HStack, Button, Text, Icon } from '@chakra-ui/react';

type Props = {
  dirty:    boolean;
  saving:   boolean;
  onCancel: () => void;
  onSave:   () => void;
};

export function SaveBar({ dirty, saving, onCancel, onSave }: Props) {
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
    >
      <HStack justify="flex-end" spacing={3}>
        <Box flex={1}>
          {!dirty && !saving && (
            <HStack spacing={1.5}>
              <CheckIcon />
              <Text fontSize="xs" color="green.600" fontWeight="600">All changes saved</Text>
            </HStack>
          )}
          {saving && <Text fontSize="xs" color="brand.muted">Saving…</Text>}
          {dirty && !saving && <Text fontSize="xs" color="brand.muted">Unsaved changes</Text>}
        </Box>
        <Button variant="outline" size="sm" onClick={onCancel} isDisabled={!dirty || saving}>
          Cancel
        </Button>
        <Button variant="brand" size="sm" onClick={onSave} isDisabled={!dirty} isLoading={saving}>
          Save Changes
        </Button>
      </HStack>
    </Box>
  );
}

function CheckIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px" color="green.500"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></Icon>;
}
