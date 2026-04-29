import { Box, Flex, Text, VStack, Badge } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { STEPS, type StepStatus } from '../routes';
import { rsGradient } from '../theme/reachSocialTheme';

// Fixed 240px left sidebar — Reach Social mark at top, four pipeline
// steps as nav links with status badges, sign-out at the bottom
// (Phase 3 wires the sign-out button to actual auth context).

type Props = {
  stepStatuses: Record<string, StepStatus>;
};

export function Sidebar({ stepStatuses }: Props) {
  return (
    <Flex
      as="aside"
      direction="column"
      w="240px"
      flexShrink={0}
      h="100vh"
      bg="brand.surface"
      borderRightWidth="1px"
      borderRightColor="brand.border"
      position="sticky"
      top={0}
      px={5}
      py={6}
    >
      <BrandMark />

      <VStack as="nav" align="stretch" spacing={1} mt={8}>
        {STEPS.map((step, i) => {
          const status = stepStatuses[step.key] ?? 'pending';
          return (
            <NavLink key={step.key} to={step.path} style={{ textDecoration: 'none' }}>
              {({ isActive }) => <NavItem index={i + 1} label={step.label} description={step.description} status={status} isActive={isActive} />}
            </NavLink>
          );
        })}
      </VStack>

      <Box mt="auto" pt={6} borderTopWidth="1px" borderTopColor="brand.border">
        <Text fontSize="xs" color="brand.muted">
          Phase 2 shell — auth + brand picker arrive next.
        </Text>
      </Box>
    </Flex>
  );
}

function BrandMark() {
  // Placeholder mark — replace with the real Reach Social logo asset
  // when art lands. Gradient block + wordmark keeps the brand voice
  // visible in the meantime.
  return (
    <Flex align="center" gap={3}>
      <Box w="36px" h="36px" borderRadius="xl" bgImage={rsGradient} boxShadow="brand" />
      <Box>
        <Text fontWeight="800" color="brand.ink" lineHeight="1.1">Reach Social</Text>
        <Text fontSize="xs" color="brand.muted">AI creative pipeline</Text>
      </Box>
    </Flex>
  );
}

function NavItem({
  index, label, description, status, isActive
}: {
  index: number;
  label: string;
  description: string;
  status: StepStatus;
  isActive: boolean;
}) {
  const showAsActive = isActive;
  return (
    <Flex
      align="center"
      gap={3}
      px={3}
      py={3}
      borderRadius="xl"
      bg={showAsActive ? 'rsViolet.50' : 'transparent'}
      transition="background 120ms"
      _hover={{ bg: showAsActive ? 'rsViolet.50' : 'gray.50' }}
    >
      <Box
        w="28px"
        h="28px"
        borderRadius="lg"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize="xs"
        fontWeight="800"
        color={showAsActive ? 'white' : 'brand.muted'}
        bgImage={showAsActive ? rsGradient : undefined}
        bg={showAsActive ? undefined : 'gray.100'}
      >
        {index}
      </Box>
      <Box flex={1} minW={0}>
        <Text
          fontSize="sm"
          fontWeight="700"
          color={showAsActive ? 'rsViolet.700' : 'brand.ink'}
          lineHeight="1.2"
        >
          {label}
        </Text>
        <Text fontSize="xs" color="brand.muted" noOfLines={1}>
          {description}
        </Text>
      </Box>
      <StatusBadge status={status} />
    </Flex>
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'complete') return <Badge variant="complete" fontSize="9px">Done</Badge>;
  if (status === 'active')   return <Badge variant="processing" fontSize="9px">Now</Badge>;
  if (status === 'warning')  return <Badge variant="warning" fontSize="9px">!</Badge>;
  return null;
}
