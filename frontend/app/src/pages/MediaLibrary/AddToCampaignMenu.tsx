// "Add to Campaign" dropdown for the bottom action bar. Replaces the
// older "Add to Collection" affordance — Collections has been folded
// into Campaign (Campaign.mediaIds[] is the storage). Lists the active
// brand's campaigns (reach-social and synced) plus an inline "+ New
// campaign…" entry that opens the existing quick-builder flow.

import { useEffect, useState } from 'react';
import {
  Button, Menu, MenuButton, MenuList, MenuItem, MenuDivider,
  useToast, HStack, Text, Badge
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type CampaignRow = {
  id:        string;
  name:      string;
  platform:  string;
  kind:      string | null;
  status:    string | null;
};

type Props = {
  mediaIds:    string[];
  isDisabled?: boolean;
};

export function AddToCampaignMenu({ mediaIds, isDisabled }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBrand?.id) return;
    let cancelled = false;
    setLoading(true);
    apiJson<{ campaigns: CampaignRow[] }>(`/api/campaigns?brandId=${encodeURIComponent(activeBrand.id)}`)
      .then(res => { if (!cancelled) setCampaigns(res.campaigns || []); })
      .catch(() => { if (!cancelled) setCampaigns([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeBrand?.id]);

  const handleAdd = async (c: CampaignRow) => {
    if (!mediaIds.length) return;
    setBusyId(c.id);
    try {
      await apiJson(`/api/campaigns/${c.id}/media`, {
        method: 'POST',
        body: JSON.stringify({ mediaIds })
      });
      toast({
        title: `Added to "${c.name}"`,
        description: `${mediaIds.length} media · pinned for ad generation`,
        status: 'success',
        duration: 2500
      });
    } catch (err) {
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
    <Menu placement="top">
      <MenuButton
        as={Button}
        variant="outline"
        size="sm"
        isDisabled={isDisabled || !mediaIds.length}
      >
        Add to Campaign
      </MenuButton>
      <MenuList maxH="340px" overflowY="auto" minW="260px">
        {loading ? (
          <MenuItem isDisabled fontSize="sm" color="brand.muted">Loading campaigns…</MenuItem>
        ) : campaigns.length === 0 ? (
          <MenuItem isDisabled fontSize="sm" color="brand.muted">No campaigns yet</MenuItem>
        ) : (
          campaigns.map(c => (
            <MenuItem
              key={c.id}
              onClick={() => handleAdd(c)}
              isDisabled={busyId !== null}
              fontSize="sm"
            >
              <HStack justify="space-between" w="100%">
                <Text noOfLines={1}>{c.name || '(unnamed)'}</Text>
                <Badge variant="subtle" fontSize="9px" colorScheme={c.platform === 'reach-social' ? 'purple' : 'gray'}>
                  {c.platform}
                </Badge>
              </HStack>
            </MenuItem>
          ))
        )}
        <MenuDivider />
        <MenuItem
          onClick={() => navigate('/campaigns?new=1')}
          fontSize="sm"
          color="rsViolet.700"
          fontWeight="700"
        >
          + New campaign…
        </MenuItem>
      </MenuList>
    </Menu>
  );
}
