// Onboarding page — landing for authenticated users who don't yet
// have an Advertiser membership. Triggered by the apiFetch redirect
// chain: any /api/* call that returns 403 NO_ADVERTISER bounces the
// browser here so the user isn't stuck in the unauthenticated/
// auth-loop state.
//
// Stub for now: it explains the state and offers Sign Out so the
// user can switch accounts. A real self-serve advertiser-create flow
// would replace this card.

import { Box, Button, Card, CardBody, Heading, Text, VStack, HStack, Link } from '@chakra-ui/react';
import { useAuth } from '../../auth/AuthContext';

export function OnboardingPage() {
  const auth = useAuth();
  const email = auth.status === 'authenticated' ? auth.user.email : null;

  return (
    <Box minH="100vh" bg="brand.canvas" py={20} px={4}>
      <Box maxW="560px" mx="auto">
        <Card>
          <CardBody p={8}>
            <VStack align="stretch" spacing={5}>
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
                  Account setup
                </Text>
                <Heading size="md" color="brand.ink">You're signed in, but not in a workspace yet</Heading>
              </Box>
              <Text color="brand.muted" fontSize="sm" lineHeight="1.7">
                {email ? <>Your Google account <b>{email}</b> isn't a member of any Reach Social workspace yet.</> : 'Your account isn\'t a member of any Reach Social workspace yet.'}
                {' '}If you were expecting an invite, ask your admin to (re)send it. If you're setting up a new
                workspace, please reach out to your account contact.
              </Text>
              <HStack spacing={3}>
                <Button variant="outline" onClick={auth.signOut}>Sign out</Button>
                <Button as={Link} href="mailto:hello@reachsocial.io" variant="brand">
                  Request access
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
