// Step 2 — Products select.
//
// Pulls the brand's catalog filtered to products detected in any media
// linked to the chosen campaign. All matched products start selected;
// the operator can deselect any they don't want included.
//
// Empty states:
//   no products in campaign → upload media to generate matches
//   campaign not yet picked → bounce back to Step 1
//
// Backend filter (TODO): GET /api/catalog?brandId=X&campaignId=Y or a
// dedicated /api/campaigns/:id/products endpoint that joins on the
// detected ProductMatchArtifacts.

import { useEffect, useMemo } from 'react';
import { Box, VStack, HStack, Text, Button, Card, CardBody, Checkbox, Image } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { WizardSelections } from './index';
import { StepShell } from './index';

type Product = {
  id:        string;
  title:     string;
  imageUrl:  string | null;
  category:  string | null;
  detectedIn?: number;       // count of media in the campaign that detected this SKU
};

type Props = {
  value:    WizardSelections;
  onChange: (patch: Partial<WizardSelections>) => void;
};

export function Step2Products({ value, onChange }: Props) {
  // TODO(wizard backend): fetch by campaign — for now stub empty list.
  const products: Product[] = [];

  // Auto-select every detected product the first time we see them.
  // The operator can toggle any off; subsequent renders honor their
  // current selection.
  useEffect(() => {
    if (products.length === 0) return;
    if (value.productIds.length > 0) return;
    onChange({ productIds: products.map(p => p.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  const allSelected = useMemo(
    () => products.length > 0 && value.productIds.length === products.length,
    [products, value.productIds]
  );

  const toggle = (id: string) => {
    const set = new Set(value.productIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ productIds: Array.from(set) });
  };

  const toggleAll = () => {
    onChange({ productIds: allSelected ? [] : products.map(p => p.id) });
  };

  if (!value.campaignId) {
    return (
      <StepShell heading="Pick products" helper="Pick a campaign first — its detected products will populate this step.">
        <Card variant="outline">
          <CardBody>
            <Text fontSize="sm" color="brand.muted">
              No campaign selected. Go back to Step 1 to choose one.
            </Text>
          </CardBody>
        </Card>
      </StepShell>
    );
  }

  if (products.length === 0) {
    return (
      <StepShell heading="Pick products" helper="Products detected in this campaign's media.">
        <Card variant="outline">
          <CardBody>
            <VStack align="stretch" spacing={3} py={6} textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                No detected products
              </Text>
              <Text color="brand.ink" fontWeight="600" fontSize="md">
                We haven't detected any products in this campaign's media yet.
              </Text>
              <Text fontSize="sm" color="brand.muted" maxW="440px" mx="auto">
                Upload media for the campaign so the detect pipeline can find product
                matches — or pick a different campaign in Step 1.
              </Text>
              <HStack justify="center" pt={2}>
                <Button as={RouterLink} to="/upload" variant="brand" size="sm">
                  Upload media
                </Button>
                <Button as={RouterLink} to="/catalog" variant="outline" size="sm">
                  Browse catalog
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
      helper={`${value.productIds.length} of ${products.length} selected · auto-selected from products detected in the campaign's media.`}
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
          <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>{product.title}</Text>
          <HStack spacing={2}>
            {product.category && <Text fontSize="11px" color="brand.muted" noOfLines={1}>{product.category}</Text>}
            {product.detectedIn != null && (
              <Text fontSize="10px" color="brand.muted">· detected in {product.detectedIn} media</Text>
            )}
          </HStack>
        </Box>
      </HStack>
    </Box>
  );
}
