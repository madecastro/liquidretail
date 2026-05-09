// "Add to Campaign" dropdown. Used by:
//   - Media Library bottom action bar (mediaIds)
//   - Catalog Browser header           (productIds)
//
// Lists the active brand's campaigns + an inline "+ New campaign…"
// entry that routes to /campaigns?new=1.
//
// Props are an XOR: pass either { mediaIds } or { productIds }.

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

type Props = (
  | { mediaIds: string[]; productIds?: never }
  | { productIds: string[]; mediaIds?: never }
) & {
  isDisabled?: boolean;
  /** Override the button label; defaults based on which kind is passed. */
  label?: string;
};

export function AddToCampaignMenu(props: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const { activeBrand } = useBrand();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const kind: 'media' | 'product' = 'mediaIds' in props && props.mediaIds ? 'media' : 'product';
  const ids = (kind === 'media' ? props.mediaIds : props.productIds) || [];
  const label = props.label || (kind === 'media' ? 'Add to Campaign' : 'Add to Campaign');

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
    if (!ids.length) return;
    setBusyId(c.id);
    try {
      const path = kind === 'media' ? 'media' : 'products';
      const body = kind === 'media' ? { mediaIds: ids } : { productIds: ids };
      await apiJson(`/api/campaigns/${c.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      toast({
        title: `Added to "${c.name}"`,
        description: `${ids.length} ${kind} · pinned for ad generation`,
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
    <Menu placement="bottom-end">
      <MenuButton
        as={Button}
        variant="outline"
        size="sm"
        isDisabled={props.isDisabled || !ids.length}
      >
        {label}
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
