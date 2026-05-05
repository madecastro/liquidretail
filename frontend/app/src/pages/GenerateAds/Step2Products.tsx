// Step 2 — Products select.
//
// Pulls the brand's catalog filtered to products this campaign is
// promoting, as resolved by the Meta Ads creative matcher (URL +
// text similarity against ad creatives → CatalogProduct.productUrl /
// title). The matched set lands pre-selected; the operator can
// deselect any they don't want included.
//
// Empty states:
//   no products in campaign → upload media or pick a different campaign
//   campaign not yet picked → bounce back to Step 1
//
// Backend: GET /api/campaigns/:id/products returns the hydrated rows
// + per-product matchMethod ('url' | 'text' | 'mixed').

import { useEffect, useMemo, useState } from 'react';
import { Box, VStack, HStack, Text, Button, Card, CardBody, Checkbox, Image, Badge, Spinner } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { WizardSelections } from './index';
import { StepShell } from './index';
import { apiJson } from '../../auth/apiFetch';

type Product = {
  id:          string;
  title:       string;
  imageUrl:    string | null;
  category:    string | null;
  productUrl:  string | null;
  matchMethod: 'url' | 'text' | 'mixed' | null;
};

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step2Products({ value, onChange }: Props) {
  const campaignId = value.campaignId;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) { setProducts(null); return; }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await apiJson<{ products: Product[] }>(`/api/campaigns/${campaignId}/products`);
        setProducts(res.products || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign products');
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  // First-time auto-select — every matched product starts checked.
  // Re-runs when the campaign changes (productIds reset by step nav).
  useEffect(() => {
    if (!products || products.length === 0) return;
    if (value.productIds.length > 0) return;
    onChange({ productIds: products.map(p => p.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const allSelected = useMemo(
    () => !!products && products.length > 0 && value.productIds.length === products.length,
    [products, value.productIds]
  );

  const toggle = (id: string) => {
    const set = new Set(value.productIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ productIds: Array.from(set) });
  };
  const toggleAll = () => {
    if (!products) return;
    onChange({ productIds: allSelected ? [] : products.map(p => p.id) });
  };

  if (!campaignId) {
    return (
      <StepShell heading="Pick products" helper="Pick a campaign first — its matched products will populate this step.">
        <Card variant="outline">
          <CardBody>
            <Text fontSize="sm" color="brand.muted">No campaign selected. Go back to Step 1 to choose one.</Text>
          </CardBody>
        </Card>
      </StepShell>
    );
  }

  if (loading) {
    return (
      <StepShell heading="Pick products">
        <HStack py={6} justify="center"><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Loading matched products…</Text></HStack>
      </StepShell>
    );
  }

  if (error) {
    return (
      <StepShell heading="Pick products">
        <Card variant="outline"><CardBody><Text color="red.600" fontSize="sm">{error}</Text></CardBody></Card>
      </StepShell>
    );
  }

  if (!products || products.length === 0) {
    return (
      <StepShell heading="Pick products" helper="Products this campaign's creatives are promoting.">
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={6} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No products matched
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="md">
                We couldn't match this campaign's creatives to any of your catalog products.
              </Text>
              <Text fontSize="sm" color="brand.muted" maxW="480px" mx="auto">
                Make sure your catalog has product URLs and titles that align with what the
                ads link to and describe — or pick a different campaign in Step 1.
              </Text>
              <HStack justify="center" pt={2}>
                <Button as={RouterLink} to="/catalog" variant="outline" size="sm">
                  Browse catalog
                </Button>
                <Button as={RouterLink} to="/upload" variant="brand" size="sm">
                  Upload media
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </StepShell>
    );
  }

  return (
    <StepShell
      heading="Pick products"
      helper={`${value.productIds.length} of ${products.length} selected · matched via the ad creatives' link URL + caption text.`}
    >
      <HStack justify="space-between" mb={3}>
        <Button size="xs" variant="outline" onClick={toggleAll}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
        <Text fontSize="11px" color="brand.muted">
          Each selected product fans out into one ad per chosen template in Step 3.
        </Text>
      </HStack>

      <VStack align="stretch" spacing={2}>
        {products.map(p => (
          <ProductRow
            key={p.id}
            product={p}
            selected={value.productIds.includes(p.id)}
            onToggle={() => toggle(p.id)}
          />
        ))}
      </VStack>
    </StepShell>
  );
}

function ProductRow({ product, selected, onToggle }: { product: Product; selected: boolean; onToggle: () => void }) {
  const methodColor = product.matchMethod === 'url' ? 'green'
                    : product.matchMethod === 'mixed' ? 'purple'
                    : product.matchMethod === 'text' ? 'blue'
                    : 'gray';
  const methodLabel = product.matchMethod === 'url' ? 'URL match'
                    : product.matchMethod === 'mixed' ? 'URL + text'
                    : product.matchMethod === 'text' ? 'Text match'
                    : null;

  return (
    <Box
      borderWidth="1px"
      borderColor={selected ? 'rsViolet.400' : 'brand.border'}
      bg={selected ? 'rsViolet.50' : 'brand.surface'}
      borderRadius="md"
      p={3}
    >
      <HStack spacing={3}>
        <Checkbox isChecked={selected} onChange={onToggle} />
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.title} w="44px" h="44px" borderRadius="md" objectFit="cover" />
        ) : (
          <Box w="44px" h="44px" borderRadius="md" bg="gray.100" />
        )}
        <Box flex={1} minW={0}>
          <HStack spacing={2}>
            <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{product.title}</Text>
            {methodLabel && (
              <Badge fontSize="9px" colorScheme={methodColor} variant="subtle">{methodLabel}</Badge>
            )}
          </HStack>
          <HStack spacing={2}>
            {product.category && <Text fontSize="11px" color="brand.muted" noOfLines={1}>{product.category}</Text>}
            {product.productUrl && <Text fontSize="10px" color="brand.muted" noOfLines={1}>· {shortUrl(product.productUrl)}</Text>}
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname;
  } catch {
    return url;
  }
}
