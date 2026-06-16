// Step 1 — Campaign select.
//
// Lists the brand's synced campaigns from connected integrations
// (populated by services/campaignSyncService → metaAdsCampaignService /
// googleAdsCampaignService). Pre-selects whatever campaignId arrived
// from the URL (e.g. when the user clicked Generate Ads on a row from
// the Campaigns page) so the radio reflects state immediately.
//
// Empty state offers Connect Integrations + Upload Media; "+ New
// campaign" stays disabled until a manual-campaign create flow lands.

import { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Button, Card, CardBody, Radio, RadioGroup, Badge, Spinner } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { WizardSelections } from './index';
import { StepShell } from './index';
import { apiJson } from '../../auth/apiFetch';

type Campaign = {
  id:           string;
  platform:     string;
  externalId:   string;
  name:         string;
  status:       string | null;
  objective:    string | null;
  productSetIds: string[];
  adSetCount:   number;
  adCount:      number;
  isExpired?:   boolean;
};

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step1Campaign({ value, onChange }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await apiJson<{ campaigns: Campaign[] }>('/api/campaigns');
        setCampaigns(res.campaigns || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <StepShell heading="Pick a campaign">
        <HStack py={6} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading campaigns…</Text></HStack>
      </StepShell>
    );
  }

  if (error) {
    return (
      <StepShell heading="Pick a campaign">
        <Card variant="outline"><CardBody><Text color="red.600" fontSize="sm">{error}</Text></CardBody></Card>
      </StepShell>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <StepShell heading="Pick a campaign" helper="Synced campaigns will appear here once you connect an integration.">
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={6} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No campaigns connected
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="md">
                Connect Meta Ads or Google Ads to sync existing campaigns, or upload media to start your first campaign from scratch.
              </Text>
              <HStack justify="center" spacing={2} pt={2}>
                <Button as={RouterLink} to="/brand" variant="outline" size="sm">
                  Connect integrations
                </Button>
                <Button variant="outline" size="sm" isDisabled>
                  + New campaign
                </Button>
                <Button as={RouterLink} to="/upload" variant="brand" size="sm">
                  Upload media
                </Button>
              </HStack>
              <Text fontSize="10px" color="brand.muted" pt={2}>
                Manual campaign creation and the in-wizard upload flow ship in a follow-up.
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </StepShell>
    );
  }

  return (
    <StepShell heading="Pick a campaign" helper="Choose the campaign whose product set you want to generate ads for.">
      <VStack align="stretch" spacing={5}>
        <PlatformFormatPicker value={value.platformFormat} onChange={(f) => onChange({ platformFormat: f })} />
        <RadioGroup value={value.campaignId || ''} onChange={(v) => onChange({ campaignId: v || null })}>
          <VStack align="stretch" spacing={2}>
            {campaigns.map(c => (
              <CampaignRow key={c.id} campaign={c} selected={c.id === value.campaignId} />
            ))}
          </VStack>
        </RadioGroup>
      </VStack>
    </StepShell>
  );
}

// Platform-format picker (Phase 2). Operator picks which Meta surface
// this batch targets — drives canvas aspect + safe areas + archetype
// weighting downstream. Default meta_feed_1_1 (current behavior).
function PlatformFormatPicker({ value, onChange }: { value: 'meta_feed_1_1' | 'meta_reels_9_16'; onChange: (f: 'meta_feed_1_1' | 'meta_reels_9_16') => void }) {
  const options: Array<{ id: 'meta_feed_1_1' | 'meta_reels_9_16'; label: string; sub: string; aspect: string }> = [
    { id: 'meta_feed_1_1',   label: 'Feed',  sub: 'Image or video, no safe-area constraints', aspect: '1:1' },
    { id: 'meta_reels_9_16', label: 'Reels', sub: 'Vertical video, top + bottom safe zones reserved for IG/FB UI', aspect: '9:16' }
  ];
  return (
    <Box>
      <Text fontSize="11px" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted" mb={2}>
        Platform format
      </Text>
      <HStack spacing={2} align="stretch">
        {options.map(opt => {
          const isActive = opt.id === value;
          return (
            <Box
              key={opt.id}
              flex={1}
              borderWidth="1px"
              borderColor={isActive ? 'rsViolet.400' : 'brand.border'}
              bg={isActive ? 'rsViolet.50' : 'brand.surface'}
              borderRadius="md"
              p={3}
              cursor="pointer"
              onClick={() => onChange(opt.id)}
              transition="border-color 0.12s, background 0.12s"
            >
              <HStack spacing={2}>
                <Text fontSize="sm" fontWeight="800" color={isActive ? 'rsViolet.700' : 'brand.ink'}>{opt.label}</Text>
                <Badge fontSize="9px" colorScheme="purple" variant="subtle">{opt.aspect}</Badge>
              </HStack>
              <Text fontSize="11px" color="brand.muted" mt={1}>{opt.sub}</Text>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}

function CampaignRow({ campaign, selected }: { campaign: Campaign; selected: boolean }) {
  const platformLabel = campaign.platform === 'meta-ads' ? 'Meta'
                      : campaign.platform === 'google-ads' ? 'Google'
                      : campaign.platform;
  const statusColor = !campaign.status ? 'gray'
                    : /active|enabled/i.test(campaign.status) ? 'green'
                    : /paused/i.test(campaign.status) ? 'yellow'
                    : 'gray';
  const productSetCount = campaign.productSetIds?.length || 0;

  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : campaign.isExpired ? 'red.200' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : campaign.isExpired ? 'red.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
      opacity={campaign.isExpired ? 0.7 : 1}
    >
      <Radio value={campaign.id} isDisabled={campaign.isExpired}>
        <HStack spacing={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="700" color="brand.ink">{campaign.name}</Text>
          <Badge fontSize="9px" colorScheme="purple" variant="subtle">{platformLabel}</Badge>
          {campaign.status && (
            <Badge fontSize="9px" colorScheme={statusColor} variant="subtle">{campaign.status}</Badge>
          )}
          {campaign.isExpired && (
            <Badge fontSize="9px" colorScheme="red" variant="solid">Expired</Badge>
          )}
          {campaign.objective && (
            <Badge fontSize="9px" colorScheme="gray" variant="outline">{campaign.objective}</Badge>
          )}
        </HStack>
        <HStack spacing={2} mt={0.5} fontSize="11px" color="brand.muted">
          <Text>{campaign.adSetCount} ad set{campaign.adSetCount === 1 ? '' : 's'}</Text>
          <Text>·</Text>
          <Text>{campaign.adCount} ad{campaign.adCount === 1 ? '' : 's'}</Text>
          {productSetCount > 0 && (
            <>
              <Text>·</Text>
              <Text>{productSetCount} product set{productSetCount === 1 ? '' : 's'}</Text>
            </>
          )}
        </HStack>
      </Radio>
    </Box>
  );
}
