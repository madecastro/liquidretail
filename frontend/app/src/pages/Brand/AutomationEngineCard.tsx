// Phase 4c — Automation Engine card.
//
// Three brand-level toggle rows. Each persists immediately on toggle
// via its own existing endpoint (not via the page's SaveBar / draft).
// Reasoning: these toggles are independent operational choices, not
// part of the brand-identity edit flow — same UX as the legacy page.
//
// auto-reply on matches → PATCH /api/integrations/instagram/comment-reply
// auto-create products  → PATCH /api/brand/:id/upload-settings
// auto-sync             → PATCH /api/integrations/instagram/sync-settings

import { useState } from 'react';
import {
  Card, CardBody, VStack, HStack, Text, Heading, Box, Switch, Button, Icon, useToast
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
import type { Brand } from './types';

type Props = {
  brand:     Brand;
  onChanged: () => void;       // refresh brand after a toggle persists
};

export function AutomationEngineCard({ brand, onChanged }: Props) {
  const toast    = useToast();
  const navigate = useNavigate();

  // Local optimistic state — flipped immediately on click; reverts if
  // the PATCH fails. Brand prop is the source-of-truth on initial
  // render and after refresh.
  const [autoReply,  setAutoReply]  = useState<boolean>(!!brand.commentReply?.enabled);
  const [autoCreate, setAutoCreate] = useState<boolean>(!!brand.uploadSettings?.autoCreateFromDetect);
  const [autoSync,   setAutoSync]   = useState<boolean>(!!brand.syncSettings?.autoSyncEnabled);
  const [busy, setBusy] = useState<string | null>(null);

  const flip = async (
    label: string,
    nextValue: boolean,
    revert: () => void,
    apply:  () => void,
    persist: () => Promise<void>
  ) => {
    setBusy(label);
    apply();
    try {
      await persist();
      onChanged();
    } catch (err: unknown) {
      revert();
      toast({
        title: `Could not update ${label}`,
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setBusy(null);
    }
    void nextValue;
  };

  const toggleAutoReply = () => {
    const next = !autoReply;
    flip('auto-reply', next,
      () => setAutoReply(!next),
      () => setAutoReply(next),
      async () => {
        await apiJson('/api/integrations/instagram/comment-reply', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next })
        });
      }
    );
  };

  const toggleAutoCreate = () => {
    const next = !autoCreate;
    flip('auto-create', next,
      () => setAutoCreate(!next),
      () => setAutoCreate(next),
      async () => {
        await apiJson(`/api/brand/${brand._id}/upload-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoCreateFromDetect: next })
        });
      }
    );
  };

  const toggleAutoSync = () => {
    const next = !autoSync;
    flip('auto-sync', next,
      () => setAutoSync(!next),
      () => setAutoSync(next),
      async () => {
        await apiJson('/api/integrations/instagram/sync-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoSyncEnabled: next })
        });
      }
    );
  };

  return (
    <Card variant="outline" h="100%">
      <CardBody>
        <HStack mb={4} spacing={2}>
          <BoltIcon />
          <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em">Automation Engine</Heading>
        </HStack>

        <VStack align="stretch" spacing={3}>
          <ToggleRow
            label="Auto-reply on matches"
            description="Reply to high-confidence UGC matches to encourage creator engagement."
            checked={autoReply}
            onChange={toggleAutoReply}
            busy={busy === 'auto-reply'}
          />
          <ToggleRow
            label="Auto-create products"
            description="Create draft catalog items from product detections in UGC."
            checked={autoCreate}
            onChange={toggleAutoCreate}
            busy={busy === 'auto-create'}
          />
          <ToggleRow
            label="Auto-sync"
            description="Sync products, posts, and analytics on a schedule."
            checked={autoSync}
            onChange={toggleAutoSync}
            busy={busy === 'auto-sync'}
          />
        </VStack>

        <Box mt={4} pt={4} borderTopWidth="1px" borderTopColor="brand.border">
          <Button
            variant="outline"
            size="sm"
            w="100%"
            onClick={() => navigate('/catalog')}
            rightIcon={<ArrowIcon />}
          >
            Open Catalog Browser
          </Button>
        </Box>
      </CardBody>
    </Card>
  );
}

function ToggleRow({
  label, description, checked, onChange, busy
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  busy: boolean;
}) {
  return (
    <HStack
      align="flex-start"
      spacing={3}
      p={3}
      borderRadius="md"
      borderWidth="1px"
      borderColor="brand.border"
      bg={checked ? 'rgba(16,185,129,0.04)' : 'brand.surface'}
    >
      <Switch
        isChecked={checked}
        onChange={onChange}
        isDisabled={busy}
        colorScheme="green"
        mt={0.5}
      />
      <Box flex={1} minW={0}>
        <Text fontSize="sm" fontWeight="700" color="brand.ink">{label}</Text>
        <Text fontSize="xs" color="brand.muted" lineHeight="1.4">{description}</Text>
      </Box>
    </HStack>
  );
}

function BoltIcon() {
  return <Icon viewBox="0 0 24 24" w="16px" h="16px" color="rsViolet.500"><path fill="currentColor" d="M7 2v11h3v9l7-12h-4l4-8z" /></Icon>;
}
function ArrowIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M14 4l-1.41 1.41L18.17 11H2v2h16.17l-5.58 5.59L14 20l8-8z" /></Icon>;
}
