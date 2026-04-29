import { Flex, Box, VStack } from '@chakra-ui/react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { PipelineStepHeader } from './PipelineStepHeader';
import { statusFromPath } from '../routes';

// Layout chrome: 240px sidebar (left, sticky) + main content (max 1280px,
// centered, scrollable). Stepper sits at the top of every page above
// the route's own content. Page-specific content renders into <Outlet />.

export function PipelineShell() {
  const location = location_safe(useLocation());
  const stepStatuses = statusFromPath(location.pathname);

  return (
    <Flex bg="brand.canvas" minH="100vh" align="stretch">
      <Sidebar stepStatuses={stepStatuses} />

      <Box flex={1} minW={0}>
        <Box maxW="1280px" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 6, md: 10 }}>
          <VStack align="stretch" spacing={8}>
            <PipelineStepHeader stepStatuses={stepStatuses} />
            <Outlet />
          </VStack>
        </Box>
      </Box>
    </Flex>
  );
}

// useLocation can theoretically return null if used outside a Router,
// but inside the shell that never happens. Tiny helper to keep TS
// strict-mode happy without a non-null assertion sprinkled inline.
function location_safe(loc: ReturnType<typeof useLocation>) {
  return loc;
}
