// Floating activity bar — pinned to the top of the app shell while
// background work is in flight for the active brand. Polls the
// onboarding-status endpoint's liveActivity field (most-recent
// in-flight DetectRun stage / brand-enrichment / queue tail) and
// renders a thin sliver with a spinner + friendly stage label.
//
// Self-hides when nothing's running and self-throttles polling
// frequency: 3s while active, 15s while idle (to catch new work
// without spamming the server when the brand is at rest).

import { useEffect, useRef, useState } from 'react';
import { Box, HStack, Text, Spinner, Icon } from '@chakra-ui/react';
import { CheckCircle2 } from 'lucide-react';
import { apiJson } from '../auth/apiFetch';
import { useBrand } from '../brand/BrandContext';

type LiveActivity = {
  active: boolean;
  stage:  string | null;
  sub:    string | null;
};

const POLL_ACTIVE_MS = 3000;
const POLL_IDLE_MS   = 15000;
// After activity wraps, hold a brief "all caught up" flash so the
// state change is visible to the user before the bar hides.
const COMPLETED_FLASH_MS = 4000;

export function ActivityBar() {
  const { activeBrand } = useBrand();
  const brandId = activeBrand?.id || null;

  const [activity, setActivity] = useState<LiveActivity | null>(null);
  const [completedFlash, setCompletedFlash] = useState(false);
  const wasActiveRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await apiJson<{ liveActivity: LiveActivity }>(`/api/brand/${brandId}/onboarding-status`);
        if (cancelled) return;
        const next = res.liveActivity || { active: false, stage: null, sub: null };
        setActivity(next);

        // active → idle transition: flash "All caught up" briefly.
        if (wasActiveRef.current && !next.active) {
          setCompletedFlash(true);
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => setCompletedFlash(false), COMPLETED_FLASH_MS);
        }
        wasActiveRef.current = next.active;

        const interval = next.active ? POLL_ACTIVE_MS : POLL_IDLE_MS;
        pollTimer = setTimeout(tick, interval);
      } catch {
        // Soft-fail. Try again on the idle cadence so we don't spam
        // a broken endpoint.
        if (!cancelled) pollTimer = setTimeout(tick, POLL_IDLE_MS);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [brandId]);

  // Render nothing when there's no signal AND no flash is pending.
  if (!activity) return null;
  if (!activity.active && !completedFlash) return null;

  if (activity.active) {
    return (
      <Box
        position="sticky" top={0} zIndex={50}
        bg="rsViolet.500"
        color="white"
        borderBottomWidth="1px"
        borderBottomColor="rsViolet.600"
        px={4}
        py={2}
      >
        <HStack spacing={3} maxW="1280px" mx="auto">
          <Spinner size="sm" thickness="2px" speed="0.8s" emptyColor="whiteAlpha.300" color="white" />
          <Text fontSize="sm" fontWeight="600" noOfLines={1}>{activity.stage}</Text>
          {activity.sub && (
            <Text fontSize="xs" color="whiteAlpha.800" noOfLines={1}>· {activity.sub}</Text>
          )}
        </HStack>
      </Box>
    );
  }

  // Completed flash.
  return (
    <Box
      position="sticky" top={0} zIndex={50}
      bg="green.500"
      color="white"
      borderBottomWidth="1px"
      borderBottomColor="green.600"
      px={4}
      py={2}
    >
      <HStack spacing={3} maxW="1280px" mx="auto">
        <Icon as={CheckCircle2} boxSize={4} />
        <Text fontSize="sm" fontWeight="600">All caught up</Text>
      </HStack>
    </Box>
  );
}
