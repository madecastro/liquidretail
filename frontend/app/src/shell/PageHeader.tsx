import { Flex, Box, Heading, Text, HStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';

// Top-of-page header used by every page. Eyebrow / title / description
// on the left; primary + secondary actions on the right. Shape mirrors
// PageHeaderProps from the design spec.

type Props = {
  eyebrow?:         string;
  title:            string;
  description:      string;
  primaryAction?:   ReactNode;
  secondaryAction?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, primaryAction, secondaryAction }: Props) {
  return (
    <Flex
      align={{ base: 'flex-start', md: 'center' }}
      justify="space-between"
      gap={6}
      flexDirection={{ base: 'column', md: 'row' }}
    >
      <Box minW={0} flex={1}>
        {eyebrow && (
          <Text fontSize="xs" color="rsViolet.600" textTransform="uppercase" letterSpacing="0.08em" fontWeight="700" mb={2}>
            {eyebrow}
          </Text>
        )}
        <Heading as="h1" size="lg" color="brand.ink" mb={2}>
          {title}
        </Heading>
        <Text color="brand.muted" maxW="640px">
          {description}
        </Text>
      </Box>
      {(primaryAction || secondaryAction) && (
        <HStack spacing={3} flexShrink={0}>
          {secondaryAction}
          {primaryAction}
        </HStack>
      )}
    </Flex>
  );
}
