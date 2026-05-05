import { Box, VStack, Heading, Text, Button, HStack, Card, CardBody } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

// Phase A landed before Phase 6, so Detect is no longer a pure
// placeholder — it offers an entry into the new Media Library page
// alongside the legacy detect.html link until Phase 6 absorbs both.
export function DetectPage() {
  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.08em" fontWeight="700">
          Step 3 / 4
        </Text>
        <Heading size="lg" color="brand.ink" mt={1}>AI Detection Review</Heading>
        <Text color="brand.muted" mt={2} maxW="640px">
          Review what AI found inside uploaded assets — products, scenes, people, text,
          safe zones, match scores, rights and safety flags.
        </Text>
      </Box>

      <Card variant="outline">
        <CardBody>
          <Heading size="sm" color="brand.ink">Media Library (Phase A)</Heading>
          <Text fontSize="sm" color="brand.muted" mt={1}>
            Browse every uploaded asset for the active brand, inspect detection results,
            and continue to ad generation. Replaces detect.html for most workflows.
          </Text>
          <HStack mt={4} spacing={3}>
            <Button as={RouterLink} to="/media-library" variant="brand" size="sm">
              Open Media Library →
            </Button>
            <Button as="a" href="/detect.html" variant="outline" size="sm">
              Legacy detect.html
            </Button>
          </HStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
