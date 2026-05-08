// Post-onboarding status panel — shown on the Brand page so the user
// can watch background jobs land after finishing /onboarding/connect.
//
// Polls GET /api/brand/:id/onboarding-status every 5s while anything
// is still in flight; stops once everything that was triggered has
// reached a terminal state. Self-collapses + auto-dismisses once all
// pipelines are quiet so it doesn't permanently occupy real estate
// on the brand page after the dust settles.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardBody, HStack, Text, Heading, Badge, Progress,
  Spinner, IconButton, Icon, SimpleGrid
} from '@chakra-ui/react';
import { CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';
import { apiJson } from '../../auth/apiFetch';

type RunBucket = { queued: number; processing: number; completed: number; failed: number };

type Status = {
  enrichment: {
    stage:           string;
    hasLogo:         boolean;
    hasColors:       boolean;
    hasTone:         boolean;
    hasPersonas:     boolean;
    hasSummary:      boolean;
    hasReviews:      boolean;
  };
  catalog:        { connected: boolean; lastSyncedAt: string | null; productCount: number };
  productDetect:  RunBucket;
  social:         { connected: boolean; postCount: number };
  mediaDetect:    RunBucket;
  campaigns:      { meta: number; google: number; reachSocial: number; total: number };
};

const POLL_MS = 5000;

export function OnboardingStatusPanel({ brandId }: { brandId: string }) {
  const [status, setStatus]   = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiJson<Status>(`/api/brand/${brandId}/onboarding-status`);
      setStatus(res);
    } catch {
      // Soft-fail — the panel just doesn't update. Brand page itself
      // will surface auth/permission errors elsewhere.
    }
  }, [brandId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Poll while anything is still in flight. Once everything's quiet,
  // stop polling — operator can refresh the page to re-arm.
  const inFlight = useMemo(() => isAnythingInFlight(status), [status]);
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [inFlight, refresh]);

  if (!status || dismissed) return null;
  // Once nothing's in flight AND there's something positive to show,
  // surface the panel as a "done" state with a dismiss button. If
  // truly nothing has happened (no products, no posts, no campaigns,
  // no enrichment), there's nothing to surface.
  const hasAnyActivity =
    status.catalog.productCount > 0 ||
    status.social.postCount > 0 ||
    status.campaigns.total > 0 ||
    status.enrichment.hasTone;
  if (!inFlight && !hasAnyActivity) return null;

  return (
    <Card>
      <CardBody>
        <HStack justify="space-between" align="flex-start" mb={4}>
          <Box>
            <HStack spacing={2} mb={1}>
              <Heading size="sm" color="brand.ink">Setup status</Heading>
              {inFlight ? (
                <Badge colorScheme="purple" variant="subtle">
                  <HStack spacing={1.5}>
                    <Spinner size="2xs" />
                    <Text>Working</Text>
                  </HStack>
                </Badge>
              ) : (
                <Badge colorScheme="green" variant="subtle">
                  <HStack spacing={1.5}>
                    <Icon as={CheckCircle2} boxSize={3} />
                    <Text>All caught up</Text>
                  </HStack>
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" color="brand.muted">
              Background jobs kicked off during onboarding. Polls every 5s while in flight.
            </Text>
          </Box>
          <IconButton
            aria-label="Dismiss"
            icon={<Icon as={X} boxSize={3.5} />}
            size="xs"
            variant="ghost"
            onClick={() => setDismissed(true)}
          />
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
          <Tile
            title="Brand enrichment"
            inFlight={status.enrichment.stage !== 'done' && !status.enrichment.hasTone}
            done={!!status.enrichment.hasTone}
            detail={enrichmentDetail(status.enrichment)}
          />
          <Tile
            title="Catalog"
            inFlight={false}   // sync is bursty — productDetect captures the in-flight signal
            done={status.catalog.productCount > 0}
            detail={status.catalog.productCount > 0
              ? `${status.catalog.productCount} product${status.catalog.productCount === 1 ? '' : 's'} synced`
              : (status.catalog.connected ? 'Connected — waiting on first sync' : 'Not connected')}
          />
          <Tile
            title="Catalog detect"
            inFlight={status.productDetect.queued + status.productDetect.processing > 0}
            done={status.productDetect.completed > 0 && status.productDetect.queued + status.productDetect.processing === 0}
            detail={runBucketLabel(status.productDetect)}
            progress={runBucketProgress(status.productDetect)}
            failed={status.productDetect.failed > 0}
          />
          <Tile
            title="Social"
            inFlight={false}
            done={status.social.postCount > 0}
            detail={status.social.postCount > 0
              ? `${status.social.postCount} post${status.social.postCount === 1 ? '' : 's'} ingested`
              : (status.social.connected ? 'Connected — waiting on first sync' : 'Not connected')}
          />
          <Tile
            title="Posts detect"
            inFlight={status.mediaDetect.queued + status.mediaDetect.processing > 0}
            done={status.mediaDetect.completed > 0 && status.mediaDetect.queued + status.mediaDetect.processing === 0}
            detail={runBucketLabel(status.mediaDetect)}
            progress={runBucketProgress(status.mediaDetect)}
            failed={status.mediaDetect.failed > 0}
          />
          <Tile
            title="Campaigns"
            inFlight={false}
            done={status.campaigns.total > 0}
            detail={status.campaigns.total > 0
              ? `${status.campaigns.total} synced (${status.campaigns.meta} Meta · ${status.campaigns.google} Google · ${status.campaigns.reachSocial} in-app)`
              : 'No campaigns yet'}
          />
        </SimpleGrid>
      </CardBody>
    </Card>
  );
}

function Tile({
  title, inFlight, done, detail, progress, failed
}: {
  title:    string;
  inFlight: boolean;
  done:     boolean;
  detail:   string;
  progress?: number;       // 0..100, when applicable
  failed?:  boolean;
}) {
  return (
    <Box borderWidth="1px" borderColor="brand.border" borderRadius="md" p={3}>
      <HStack spacing={2} mb={1.5}>
        <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
          {title}
        </Text>
        {inFlight && <Icon as={Loader2} boxSize={3} color="rsViolet.500" sx={{ animation: 'spin 1s linear infinite' }} />}
        {!inFlight && done && <Icon as={CheckCircle2} boxSize={3.5} color="green.500" />}
        {failed && <Icon as={AlertCircle} boxSize={3.5} color="orange.500" />}
      </HStack>
      <Text fontSize="sm" color="brand.ink" fontWeight="600" noOfLines={2}>{detail}</Text>
      {progress != null && progress > 0 && progress < 100 && (
        <Progress value={progress} size="xs" colorScheme="purple" mt={2} borderRadius="md" />
      )}
    </Box>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function enrichmentDetail(e: Status['enrichment']): string {
  if (e.hasTone && e.hasPersonas && e.hasSummary) return 'Voice, personas, and summary ready';
  if (e.hasTone) return 'Voice ready, personas + summary pending';
  if (e.hasLogo || e.hasColors) return 'Logo + colors ready, voice pending';
  return 'Pulling logo, colors, voice, and personas…';
}

function runBucketLabel(b: RunBucket): string {
  const total = b.queued + b.processing + b.completed + b.failed;
  if (total === 0) return 'No runs yet';
  const parts: string[] = [];
  if (b.completed > 0)  parts.push(`${b.completed} done`);
  if (b.processing > 0) parts.push(`${b.processing} running`);
  if (b.queued > 0)     parts.push(`${b.queued} queued`);
  if (b.failed > 0)     parts.push(`${b.failed} failed`);
  return parts.join(' · ');
}

function runBucketProgress(b: RunBucket): number {
  const total = b.queued + b.processing + b.completed + b.failed;
  if (total === 0) return 0;
  return Math.round((b.completed / total) * 100);
}

function isAnythingInFlight(s: Status | null): boolean {
  if (!s) return false;
  if (s.productDetect.queued + s.productDetect.processing > 0) return true;
  if (s.mediaDetect.queued + s.mediaDetect.processing > 0) return true;
  // Enrichment "in flight" = we expect tone but it hasn't landed.
  if (!s.enrichment.hasTone && s.enrichment.stage !== 'done') return true;
  return false;
}
