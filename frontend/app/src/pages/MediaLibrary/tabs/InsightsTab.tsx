// Insights tab — post analytics + inbound comments for the
// currently-selected Media. Refresh button hits POST
// /api/media/:id/refresh-insights which re-pulls both from the IG
// Graph API in one round trip and persists onto Media.platformStats
// + the Comment collection.
//
// Empty until the operator clicks Refresh — IG comments aren't
// part of the standard post sync, and analytics on aged posts
// drift quickly enough that an explicit refresh is worth the click.

import { useEffect, useState, useCallback } from 'react';
import {
  Box, VStack, HStack, Text, Heading, Button, SimpleGrid, Card, CardBody,
  Spinner, Badge, useToast, Avatar, Divider
} from '@chakra-ui/react';
import { apiJson } from '../../../auth/apiFetch';
import type { MediaListRow, DetectResult } from '../types';

type Props = { row: MediaListRow | null; detect: DetectResult | null };

type CommentRow = {
  id:             string;
  externalId:     string;
  text:           string;
  authorUsername: string | null;
  likeCount:      number;
  postedAt:       string | null;
  fetchedAt:      string | null;
};

type CommentsResponse = {
  comments: CommentRow[];
  total:    number;
  limit:    number;
  offset:   number;
};

type RefreshResponse = {
  ok:            boolean;
  stats:         Record<string, number | string | null> | null;
  statsError:    string | null;
  comments:      { fetched: number; upserted: number; totalStored: number } | null;
  commentsError: string | null;
};

export function InsightsTab({ row, detect }: Props) {
  const toast = useToast();
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [total, setTotal]       = useState(0);
  const [stats, setStats]       = useState<Record<string, number | string | null> | null>(null);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Seed stats from the detect endpoint's platformStats so persisted
  // post analytics show on first render — Refresh button still pulls
  // fresh numbers from IG when the operator wants them.
  const persistedStats = detect?.platformStats || null;

  const loadComments = useCallback(async (mediaId: string) => {
    setLoading(true);
    try {
      const res = await apiJson<CommentsResponse>(`/api/media/${mediaId}/comments?limit=200`);
      setComments(res.comments);
      setTotal(res.total);
    } catch (e) {
      toast({ title: 'Could not load comments', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Reset state when the selected media changes; load existing
  // comments from Mongo (no IG round-trip yet). Stats reset to null
  // here and the JSX falls back to persistedStats from the detect
  // payload until the operator clicks Refresh.
  useEffect(() => {
    setStats(null);
    setComments(null);
    setTotal(0);
    if (row?.mediaId) void loadComments(row.mediaId);
  }, [row?.mediaId, loadComments]);

  const refresh = async () => {
    if (!row?.mediaId) return;
    setRefreshing(true);
    try {
      const res = await apiJson<RefreshResponse>(`/api/media/${row.mediaId}/refresh-insights`, { method: 'POST' });
      if (res.stats) setStats(res.stats);
      const okBits: string[] = [];
      const errBits: string[] = [];
      if (res.stats)         okBits.push('stats refreshed');
      if (res.comments)      okBits.push(`${res.comments.upserted} comment${res.comments.upserted === 1 ? '' : 's'} synced`);
      if (res.statsError)    errBits.push(`stats: ${res.statsError}`);
      if (res.commentsError) errBits.push(`comments: ${res.commentsError}`);

      toast({
        title:       errBits.length === 0 ? 'Insights refreshed' : okBits.length > 0 ? 'Refreshed (with warnings)' : 'Refresh failed',
        description: [okBits.join(' · '), errBits.join(' · ')].filter(Boolean).join('\n'),
        status:      errBits.length > 0 && okBits.length === 0 ? 'error' : okBits.length > 0 ? 'success' : 'warning',
        duration:    5000
      });

      await loadComments(row.mediaId);
    } catch (e) {
      toast({ title: 'Refresh failed', description: e instanceof Error ? e.message : String(e), status: 'error', duration: 5000 });
    } finally {
      setRefreshing(false);
    }
  };

  if (!row) {
    return <Text fontSize="xs" color="brand.muted">Pick a media row to see its insights.</Text>;
  }

  return (
    <VStack align="stretch" spacing={4}>
      <HStack justify="space-between">
        <Heading size="xs" textTransform="uppercase" letterSpacing="0.06em" color="brand.ink">
          Post analytics
        </Heading>
        <Button size="xs" variant="outline" onClick={refresh} isLoading={refreshing} loadingText="Refreshing…">
          Refresh
        </Button>
      </HStack>

      <StatsGrid stats={stats || persistedStats} />

      <Divider />

      <HStack justify="space-between">
        <Heading size="xs" textTransform="uppercase" letterSpacing="0.06em" color="brand.ink">
          Comments {total > 0 && <Badge ml={2} colorScheme="purple" variant="subtle">{total}</Badge>}
        </Heading>
      </HStack>

      {loading && (
        <HStack py={4} justify="center"><Spinner size="sm" /><Text fontSize="xs" color="brand.muted">Loading comments…</Text></HStack>
      )}

      {!loading && (!comments || comments.length === 0) && (
        <Card variant="outline">
          <CardBody py={4}>
            <Text fontSize="xs" color="brand.muted" textAlign="center">
              No comments stored yet. Click <b>Refresh</b> to pull comments + analytics from Instagram.
            </Text>
          </CardBody>
        </Card>
      )}

      {!loading && comments && comments.length > 0 && (
        <VStack align="stretch" spacing={2}>
          {comments.map(c => <CommentRow key={c.id} c={c} />)}
        </VStack>
      )}
    </VStack>
  );
}

function StatsGrid({ stats }: { stats: Record<string, number | string | null> | null }) {
  const items: Array<[string, string]> = [
    ['Likes',      'likes'],
    ['Comments',   'comments'],
    ['Views',      'views'],
    ['Reach',      'reach'],
    ['Saves',      'saves'],
    ['Shares',     'shares'],
    ['Engagement', 'engagement']
  ];
  const empty = !stats;
  return (
    <SimpleGrid columns={2} spacing={2}>
      {items.map(([label, key]) => {
        const v = stats?.[key];
        return (
          <Box key={key} borderWidth="1px" borderColor="brand.border" borderRadius="md" px={3} py={2}>
            <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
              {label}
            </Text>
            <Text fontSize="lg" fontWeight="800" color="brand.ink">
              {empty || v == null ? '—' : formatNumber(Number(v))}
            </Text>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

function CommentRow({ c }: { c: CommentRow }) {
  const handle = c.authorUsername || '—';
  const when = c.postedAt ? new Date(c.postedAt).toLocaleString() : '—';
  return (
    <Card variant="outline">
      <CardBody py={2.5}>
        <HStack align="flex-start" spacing={2}>
          <Avatar size="xs" name={handle} />
          <Box flex={1} minW={0}>
            <HStack spacing={2}>
              <Text fontSize="xs" fontWeight="700" color="brand.ink" noOfLines={1}>@{handle}</Text>
              <Text fontSize="10px" color="brand.muted">·</Text>
              <Text fontSize="10px" color="brand.muted" noOfLines={1}>{when}</Text>
              {c.likeCount > 0 && (
                <>
                  <Text fontSize="10px" color="brand.muted">·</Text>
                  <Text fontSize="10px" color="brand.muted">{c.likeCount} ♡</Text>
                </>
              )}
            </HStack>
            <Text fontSize="xs" color="brand.ink" mt={1} whiteSpace="pre-wrap">{c.text || '—'}</Text>
          </Box>
        </HStack>
      </CardBody>
    </Card>
  );
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
