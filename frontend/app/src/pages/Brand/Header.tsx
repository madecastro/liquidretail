// Phase 4a — Brand page top header card.
// Phase 4b — Edit Brand toggles edit mode; tagline + website become
// inputs; Refresh AI fires the existing background-enrichment endpoint.

import { Box, HStack, VStack, Text, Image, Badge, Button, Link, Card, CardBody, Icon, Heading, Input } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../auth/apiFetch';
import { useState } from 'react';
import { useToast } from '@chakra-ui/react';
import type { Brand } from './types';
import type { BrandEdit } from './useBrandEdit';

type Props = {
  brand:     Brand;
  edit:      BrandEdit;
  onChanged: () => void;
};

export function BrandHeader({ brand, edit, onChanged }: Props) {
  const navigate = useNavigate();
  const toast    = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const sourceLabel = (brand.source || 'stub').toUpperCase();
  const sourceTone  = brand.source === 'curated' ? 'purple'
                    : brand.source === 'enriched' ? 'green'
                    :                               'gray';

  const isEditing  = edit.isEditing;
  const websiteUrl = (edit.valueOf('websiteUrl') as string | null) ?? '';
  const tagline    = (edit.valueOf('tagline')    as string | null) ?? '';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiJson(`/api/brand/${brand._id}/refresh-enrichment`, { method: 'POST' });
      toast({
        title: 'Refresh queued',
        description: 'Enrichment is running in the background. Refresh the page in ~60s to see updates.',
        status: 'info',
        duration: 4000
      });
      onChanged();
    } catch (err: unknown) {
      toast({
        title: 'Refresh failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 4000
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card variant="outline">
      <CardBody>
        <HStack spacing={6} align="flex-start">
          <Box
            w="124px" h="124px"
            flexShrink={0}
            borderRadius="lg"
            overflow="hidden"
            bg={brand.primaryColor || '#0B1020'}
            border="1px solid"
            borderColor="brand.border"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {brand.logoUrl ? (
              <Image src={brand.logoUrl} alt={brand.name} maxW="100%" maxH="100%" objectFit="contain" />
            ) : (
              <Text color="white" fontSize="3xl" fontWeight="800" opacity={0.6}>
                {brand.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            )}
          </Box>

          <VStack align="stretch" flex={1} spacing={2} minW={0}>
            <HStack spacing={3} align="center" wrap="wrap">
              <Heading size="lg" color="brand.ink" lineHeight="1.1" noOfLines={1}>{brand.name}</Heading>
              <Badge colorScheme={sourceTone} fontSize="10px" px={2} py={0.5} borderRadius="md">
                {sourceLabel}
              </Badge>
            </HStack>

            {isEditing ? (
              <Input
                size="sm"
                value={websiteUrl}
                onChange={e => edit.setField('websiteUrl', e.target.value || null)}
                placeholder="https://example.com"
                fontSize="sm"
                color="rsViolet.700"
              />
            ) : (
              brand.websiteUrl && (
                <Link href={brand.websiteUrl} isExternal fontSize="sm" color="rsViolet.700" display="inline-flex" alignItems="center">
                  {brand.websiteUrl}
                  <ExternalIcon />
                </Link>
              )
            )}

            {isEditing ? (
              <Input
                size="sm"
                value={tagline}
                onChange={e => edit.setField('tagline', e.target.value || null)}
                placeholder='Tagline — e.g. "The perfect combination of heat & flavor."'
                fontSize="md"
                fontStyle="italic"
              />
            ) : (
              brand.tagline && (
                <Text fontSize="md" color="brand.muted" fontStyle="italic" noOfLines={2}>
                  "{brand.tagline}"
                </Text>
              )
            )}

            <HStack spacing={4} mt={1} flexWrap="wrap">
              {brand.createdAt && (
                <HStack spacing={1.5}>
                  <CalendarIcon />
                  <Text fontSize="xs" color="brand.muted">Created {formatDate(brand.createdAt)}</Text>
                </HStack>
              )}
              {brand.updatedAt && (
                <HStack spacing={1.5}>
                  <ClockIcon />
                  <Text fontSize="xs" color="brand.muted">Last updated {formatDate(brand.updatedAt)}</Text>
                </HStack>
              )}
            </HStack>
          </VStack>

          <VStack spacing={2} align="stretch" flexShrink={0}>
            <Button
              variant="brand"
              size="sm"
              onClick={() => navigate(`/ads?brandId=${brand._id}`)}
              leftIcon={<SparklesIcon />}
              isDisabled={isEditing}
            >
              Generate Ads
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={refreshing}
              isDisabled={isEditing}
              leftIcon={<RefreshIcon />}
            >
              Refresh AI
            </Button>
            {isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={edit.cancelEdit}
                leftIcon={<EditIcon />}
              >
                Cancel Edit
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={edit.enterEdit}
                leftIcon={<EditIcon />}
              >
                Edit Brand
              </Button>
            )}
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function ExternalIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px" ml={1}><path fill="currentColor" d="M14 3v2h3.59L8.29 14.29l1.42 1.42L19 6.41V10h2V3h-7zM5 5h6V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6h-2v6H5V5z" /></Icon>;
}
function CalendarIcon() {
  return <Icon viewBox="0 0 24 24" w="12px" h="12px" color="brand.muted"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" /></Icon>;
}
function ClockIcon() {
  return <Icon viewBox="0 0 24 24" w="12px" h="12px" color="brand.muted"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" /></Icon>;
}
function SparklesIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zm6 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" /></Icon>;
}
function RefreshIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.7 10h-2.06A6 6 0 1 1 12 6a5.95 5.95 0 0 1 4.22 1.78L13 11h7V4l-2.35 2.35z" /></Icon>;
}
function EditIcon() {
  return <Icon viewBox="0 0 24 24" w="14px" h="14px"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></Icon>;
}
