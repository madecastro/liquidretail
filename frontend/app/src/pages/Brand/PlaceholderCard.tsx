// Phase 4a — pretty stand-in for sections that ship in 4b/4c/4d.
// Keeps the page layout coherent so the design is readable now and
// each follow-up phase can drop its real card in place.

import { Card, CardBody, VStack, HStack, Heading, Text, Badge, Box } from '@chakra-ui/react';

type Props = {
  title:        string;
  phase:        string;          // e.g. "Phase 4b" / "Phase 4c"
  description:  string;
  iconColor?:   string;
};

export function PlaceholderCard({ title, phase, description, iconColor }: Props) {
  return (
    <Card variant="outline" h="100%">
      <CardBody>
        <HStack justify="space-between" mb={3}>
          <HStack spacing={2}>
            <Box w="8px" h="8px" borderRadius="full" bg={iconColor || 'gray.300'} />
            <Heading size="sm" textTransform="uppercase" letterSpacing="0.04em" color="brand.ink">
              {title}
            </Heading>
          </HStack>
          <Badge variant="subtle" fontSize="9px" colorScheme="gray">{phase}</Badge>
        </HStack>
        <VStack align="stretch" spacing={2}>
          <Text fontSize="xs" color="brand.muted" fontStyle="italic">{description}</Text>
        </VStack>
      </CardBody>
    </Card>
  );
}
