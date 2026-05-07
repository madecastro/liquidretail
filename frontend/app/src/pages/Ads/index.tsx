// Ads page — gallery of rendered creatives produced by the renderer.
//
// Phase 1: lists Ad docs from GET /api/ads filtered by current
// brand. Each row is a Cloudinary thumbnail + the on-doc copy
// snapshot + template/ratio/status. Click opens a detail modal.
//
// Filter state: campaignId from query string (set by the wizard's
// post-generate redirect to /ads?campaignRunId=...). campaignRunId
// scopes to a single Generate Ads click (one batch). Status filter
// defaults to "draft" since freshly-rendered ads land in draft.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Card, CardBody, VStack, HStack, Text, Heading, Button, SimpleGrid,
  Badge, Image, Box, Spinner, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalCloseButton, Select
} from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';
import { apiJson } from '../../auth/apiFetch';
import { useBrand } from '../../brand/BrandContext';

type AdRow = {
  id:           string;
  brandId:      string;
  campaignId:   string;
  campaignRunId: string;
  mediaId:      string | null;
  productId:    string | null;
  template:     string;
  aspectRatio:  string;
  mediaSource:  string;
  campaignKind: string | null;
  kind:         'image' | 'video';
  renderUrl:    string;
  posterUrl:    string | null;
  width:        number;
  height:       number;
  bytes:        number;
  copy: {
    headline?:     string;
    cta_text?:     string;
    quote?:        string;
    productName?:  string;
    productPrice?: string;
  };
  ctaUrl:       string;
  ctaUrlParams: string;
  status:       'draft' | 'live' | 'archived';
  generatedAt:  string;
};

type AdsResponse = { ads: AdRow[]; total: number; limit: number; offset: number };

export function AdsPage() {
  const { activeBrand } = useBrand();
  const activeBrandId = activeBrand?.id || null;
  const [params] = useSearchParams();
  const campaignRunId = params.get('campaignRunId');
  const campaignId    = params.get('campaignId');

  const [status, setStatus] = useState<string>('draft');
  const [rows, setRows]     = useState<AdRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [selected, setSelected] = useState<AdRow | null>(null);
  const detailModal = useDisclosure();

  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const qp = new URLSearchParams({ brandId: activeBrandId, limit: '120' });
        if (status)          qp.set('status', status);
        if (campaignId)      qp.set('campaignId', campaignId);
        const res = await apiJson<AdsResponse>(`/api/ads?${qp.toString()}`);
        if (cancelled) return;
        // Client-side narrow to a specific batch when the wizard
        // forwarded a campaignRunId.
        const filtered = campaignRunId
          ? res.ads.filter(a => a.campaignRunId === campaignRunId)
          : res.ads;
        setRows(filtered);
        setTotal(filtered.length);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeBrandId, status, campaignId, campaignRunId]);

  const headline = useMemo(() => {
    if (campaignRunId) return `Latest batch — ${total} creative${total === 1 ? '' : 's'}`;
    if (campaignId)    return `Campaign — ${total} creative${total === 1 ? '' : 's'}`;
    return `${total} creative${total === 1 ? '' : 's'}`;
  }, [total, campaignId, campaignRunId]);

  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Step 3 / 3"
        title="Ads"
        description="Every ad creative the renderer has produced for this brand. Filter by campaign or status; click for the full creative + copy + tracking URL."
      />

      <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
        <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
          {headline}
        </Heading>
        <HStack spacing={3}>
          <Select
            size="sm"
            width="140px"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            <option value="archived">Archived</option>
          </Select>
          <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
            Generate Ads
          </Button>
        </HStack>
      </HStack>

      {loading && (
        <Box textAlign="center" py={6}>
          <Spinner size="md" />
        </Box>
      )}

      {err && (
        <Card variant="outline">
          <CardBody>
            <Text color="red.500" fontSize="sm">Failed to load ads: {err}</Text>
          </CardBody>
        </Card>
      )}

      {!loading && !err && rows.length === 0 && (
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={8} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No rendered ads yet
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="lg">
                Run the Generate Ads wizard from a campaign to produce your first batch.
              </Text>
              <HStack justify="center" pt={2}>
                <Button as={RouterLink} to="/campaigns" variant="outline" size="sm">
                  Pick a campaign
                </Button>
                <Button as={RouterLink} to="/generate-ads" variant="brand" size="sm">
                  Generate Ads
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
          {rows.map((ad) => (
            <Card
              key={ad.id}
              variant="outline"
              cursor="pointer"
              _hover={{ borderColor: 'brand.accent', transform: 'translateY(-1px)' }}
              transition="all 120ms"
              onClick={() => { setSelected(ad); detailModal.onOpen(); }}
            >
              <Box
                position="relative"
                bg="gray.900"
                borderTopRadius="md"
                overflow="hidden"
                style={{ aspectRatio: `${ad.width} / ${ad.height}` }}
              >
                <Image
                  src={ad.renderUrl}
                  alt={ad.copy.headline || ad.template}
                  width="100%"
                  height="100%"
                  objectFit="contain"
                  loading="lazy"
                />
                <Badge
                  position="absolute"
                  top={2}
                  right={2}
                  colorScheme={ad.status === 'live' ? 'green' : ad.status === 'archived' ? 'gray' : 'orange'}
                  fontSize="9px"
                  textTransform="uppercase"
                >
                  {ad.status}
                </Badge>
              </Box>
              <CardBody py={3}>
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between" spacing={2}>
                    <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
                      {ad.template}
                    </Text>
                    <Text fontSize="9px" color="brand.muted">{ad.aspectRatio}</Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={2}>
                    {ad.copy.headline || '—'}
                  </Text>
                  {ad.copy.productName && (
                    <Text fontSize="11px" color="brand.muted" noOfLines={1}>
                      {ad.copy.productName} {ad.copy.productPrice ? `· ${ad.copy.productPrice}` : ''}
                    </Text>
                  )}
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal isOpen={detailModal.isOpen} onClose={detailModal.onClose} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selected?.copy.headline || 'Ad detail'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selected && (
              <VStack align="stretch" spacing={4}>
                <Box bg="gray.900" borderRadius="md" overflow="hidden" style={{ aspectRatio: `${selected.width} / ${selected.height}` }}>
                  <Image src={selected.renderUrl} alt={selected.copy.headline || selected.template} width="100%" height="100%" objectFit="contain" />
                </Box>
                <SimpleGrid columns={2} spacing={3}>
                  <DetailRow label="Template" value={selected.template} />
                  <DetailRow label="Aspect ratio" value={selected.aspectRatio} />
                  <DetailRow label="Status" value={selected.status} />
                  <DetailRow label="Media source" value={selected.mediaSource} />
                  <DetailRow label="CTA" value={selected.copy.cta_text || selected.ctaUrl} />
                  <DetailRow label="Generated" value={new Date(selected.generatedAt).toLocaleString()} />
                </SimpleGrid>
                {selected.copy.quote && (
                  <DetailRow label="Quote" value={selected.copy.quote} />
                )}
                <HStack justify="flex-end" spacing={2}>
                  <Button as="a" href={selected.renderUrl} target="_blank" variant="outline" size="sm">
                    Open in Cloudinary
                  </Button>
                </HStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="9px" fontWeight="800" textTransform="uppercase" letterSpacing="0.06em" color="brand.muted">
        {label}
      </Text>
      <Text fontSize="sm" color="brand.ink" fontWeight="600">
        {value || '—'}
      </Text>
    </Box>
  );
}
