import { Card, CardBody, VStack, Text, Box } from '@chakra-ui/react';
import { PageHeader } from '../shell/PageHeader';

// Phase 2 stand-in. Every primary route renders this until the
// real page rebuilds (Phase 4+) replace it. Keeps the shell visually
// complete while progress is in flight.

type Props = {
  eyebrow:     string;
  title:       string;
  description: string;
  cta?:        string;       // e.g. "Continue to Upload"
  legacyHref?: string;       // link to the existing vanilla page so
                             // users can keep working during migration
};

export function PlaceholderPage({ eyebrow, title, description, cta, legacyHref }: Props) {
  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4} py={6}>
            <Box textAlign="center">
              <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
                Coming soon
              </Text>
              <Text mt={3} color="brand.ink" fontWeight="600" fontSize="lg">
                {cta ?? 'This page is being rebuilt.'}
              </Text>
              <Text mt={2} color="brand.muted" fontSize="sm" maxW="520px" mx="auto">
                The full feature set ports over in a later phase. Until then you can
                keep working from the existing page below.
              </Text>
              {legacyHref && (
                <Text mt={4} fontSize="sm">
                  <a
                    href={legacyHref}
                    style={{ color: '#7A35E8', fontWeight: 700 }}
                  >
                    Open the legacy page →
                  </a>
                </Text>
              )}
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
