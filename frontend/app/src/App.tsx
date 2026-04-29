import { Box, Heading, Text, VStack, Badge, Button, Card, CardBody, HStack } from '@chakra-ui/react';
import { rsGradient } from './theme/reachSocialTheme';

// Phase 1 acceptance scaffold. Deliberately barebones — proves the
// theme provider, font loading, color tokens, gradients, and component
// variants all wire correctly. Phase 2 replaces this with the real
// PipelineShell + routing.
export function App() {
  return (
    <Box minH="100vh" bg="brand.canvas" p={10}>
      <VStack align="stretch" spacing={8} maxW="840px" mx="auto">

        <Box>
          <Badge variant="brand" mb={3}>Phase 1</Badge>
          <Heading as="h1" size="xl" color="brand.ink" mb={2}>
            Reach Social — theme scaffold
          </Heading>
          <Text color="brand.muted">
            Vite + React + Chakra v2 wired up with the Reach Social theme tokens. The
            real shell + routing land in Phase 2; this page exists only to verify the
            stack is compiling and the font / colors / gradients render correctly.
          </Text>
        </Box>

        <Card>
          <CardBody>
            <Heading size="md" mb={4} color="brand.ink">Theme verification</Heading>
            <VStack align="stretch" spacing={4}>

              <Box>
                <Text fontSize="sm" fontWeight="700" color="brand.muted" mb={2}>Buttons</Text>
                <HStack spacing={3} flexWrap="wrap">
                  <Button variant="brand">Brand CTA</Button>
                  <Button variant="solid">Solid</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="softBrand">Soft brand</Button>
                </HStack>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="700" color="brand.muted" mb={2}>Status badges</Text>
                <HStack spacing={3} flexWrap="wrap">
                  <Badge variant="brand">Brand</Badge>
                  <Badge variant="complete">Complete</Badge>
                  <Badge variant="processing">Processing</Badge>
                  <Badge variant="pending">Pending</Badge>
                  <Badge variant="warning">Warning</Badge>
                </HStack>
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="700" color="brand.muted" mb={2}>Primary gradient</Text>
                <Box h="64px" borderRadius="2xl" bgImage={rsGradient} />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="700" color="brand.muted" mb={2}>Color tokens</Text>
                <HStack spacing={3} flexWrap="wrap">
                  {(['magenta', 'violet', 'blue', 'cyan', 'lime', 'yellow', 'orange'] as const).map((tone) => (
                    <VStack key={tone} spacing={1}>
                      <Box w="48px" h="48px" borderRadius="lg" bg={`brand.${tone}`} boxShadow="sm" />
                      <Text fontSize="xs" color="brand.muted">{tone}</Text>
                    </VStack>
                  ))}
                </HStack>
              </Box>

            </VStack>
          </CardBody>
        </Card>

      </VStack>
    </Box>
  );
}
