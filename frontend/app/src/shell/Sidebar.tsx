import { Box, Flex, Image, Text, VStack, Badge, Button, HStack, Avatar, Divider } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { STEPS, SECONDARY_NAV, type StepStatus } from '../routes';
import { rsGradient } from '../theme/reachSocialTheme';
import { useAuth } from '../auth/AuthContext';
import { BrandPicker } from './BrandPicker';
import { useDetectReviewCount } from '../brand/useDetectReviewCount';

// Fixed 240px left sidebar — Reach Social mark at top, four pipeline
// steps as nav links with status badges, sign-out at the bottom
// (Phase 3 wires the sign-out button to actual auth context).

type Props = {
  stepStatuses: Record<string, StepStatus>;
};

export function Sidebar({ stepStatuses }: Props) {
  const auth = useAuth();
  // Pending-detect-drafts count drives the red badge on the Detect
  // Review nav item — gives operators a quick "you have N items to
  // review" signal without needing to click in. Polls every 30s,
  // pauses on tab hide.
  const detectReviewCount = useDetectReviewCount();
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

      {auth.status === 'authenticated' && (
        <Box mt={6}>
          <BrandPicker />
        </Box>
      )}

      <VStack as="nav" align="stretch" spacing={1} mt={6}>
        {STEPS.map((step, i) => {
          const status = stepStatuses[step.key] ?? 'pending';
          return (
            <NavLink key={step.key} to={step.path} style={{ textDecoration: 'none' }}>
              {({ isActive }) => <NavItem index={i + 1} label={step.label} description={step.description} status={status} isActive={isActive} />}
            </NavLink>
          );
        })}
      </VStack>

      <Box mt="auto">
        <Divider my={4} />
        <VStack as="nav" align="stretch" spacing={0.5}>
          {SECONDARY_NAV.map(item => {
            // Detect Review gets a pending-count badge so operators see
            // "you have N items to review" without entering the page.
            const badgeCount = item.path === '/detect' ? detectReviewCount : 0;
            return (
              <NavLink key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
                {({ isActive }) => <SecondaryNavItem label={item.label} isActive={isActive} badgeCount={badgeCount} />}
              </NavLink>
            );
          })}
        </VStack>
      </Box>

      <Box pt={6} mt={4} borderTopWidth="1px" borderTopColor="brand.border">
        {auth.status === 'authenticated' ? (
          <HStack spacing={3}>
            <Avatar name={auth.user.name} src={auth.user.photo ?? undefined} size="sm" />
            <Box flex={1} minW={0}>
              <Text fontSize="sm" fontWeight="700" color="brand.ink" noOfLines={1}>
                {auth.user.name}
              </Text>
              <Text fontSize="xs" color="brand.muted" noOfLines={1}>{auth.user.email}</Text>
            </Box>
            <Button onClick={auth.signOut} variant="ghost" size="xs">Sign out</Button>
          </HStack>
        ) : auth.status === 'loading' ? (
          <Text fontSize="xs" color="brand.muted">Loading session…</Text>
        ) : (
          <Button onClick={auth.signIn} variant="brand" w="full" size="sm">Sign in</Button>
        )}
      </Box>
    </Flex>
  );
}

function BrandMark() {
  return (
    <NavLink to="/home" style={{ textDecoration: 'none' }}>
      <Flex align="center" gap={3} _hover={{ opacity: 0.85 }} cursor="pointer">
        <Image src="/reach-social-logo.png" alt="Reach Social" w="36px" h="36px" />
        <Box>
          <Text fontWeight="800" color="brand.ink" lineHeight="1.1">Reach Social</Text>
          <Text fontSize="xs" color="brand.muted">AI creative pipeline</Text>
        </Box>
      </Flex>
    </NavLink>
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

function SecondaryNavItem({ label, isActive, badgeCount = 0 }: { label: string; isActive: boolean; badgeCount?: number }) {
  return (
    <Flex
      align="center"
      justify="space-between"
      px={3}
      py={2}
      borderRadius="md"
      bg={isActive ? 'rsViolet.50' : 'transparent'}
      transition="background 120ms"
      _hover={{ bg: isActive ? 'rsViolet.50' : 'gray.50' }}
    >
      <Text
        fontSize="sm"
        fontWeight={isActive ? '700' : '600'}
        color={isActive ? 'rsViolet.700' : 'brand.muted'}
        lineHeight="1.2"
      >
        {label}
      </Text>
      {badgeCount > 0 && (
        <Badge
          variant="solid"
          colorScheme="red"
          fontSize="9px"
          borderRadius="full"
          px={1.5}
          minW="18px"
          textAlign="center"
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </Badge>
      )}
    </Flex>
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'complete') return <Badge variant="complete" fontSize="9px">Done</Badge>;
  if (status === 'active')   return <Badge variant="processing" fontSize="9px">Now</Badge>;
  if (status === 'warning')  return <Badge variant="warning" fontSize="9px">!</Badge>;
  return null;
}
