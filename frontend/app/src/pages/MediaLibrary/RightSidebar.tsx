// Phase A-1 right-rail tab shell. Phase A-2 fills in each tab's
// content via dedicated components under ./tabs/.

import { Box, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react';
import type { DetectResult, MediaListRow } from './types';
import { SummaryTab } from './tabs/SummaryTab';
import { ObjectsTab } from './tabs/ObjectsTab';
import { CropsTab } from './tabs/CropsTab';
import { TextTab } from './tabs/TextTab';
import { LayoutTab } from './tabs/LayoutTab';
import { PaletteTab } from './tabs/PaletteTab';

type Props = {
  row:    MediaListRow | null;
  detect: DetectResult | null;
};

export function RightSidebar({ row, detect }: Props) {
  return (
    <Box
      w="380px"
      flexShrink={0}
      h="100%"
      minH={0}
      bg="brand.surface"
      borderLeftWidth="1px"
      borderLeftColor="brand.border"
      overflowY="auto"
    >
      <Tabs variant="line" size="sm" colorScheme="purple">
        <TabList px={3} pt={2} position="sticky" top={0} bg="brand.surface" zIndex={1}>
          <Tab fontSize="xs">Summary</Tab>
          <Tab fontSize="xs">Objects</Tab>
          <Tab fontSize="xs">Crops</Tab>
          <Tab fontSize="xs">Text</Tab>
          <Tab fontSize="xs">Layout</Tab>
          <Tab fontSize="xs">Palette</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={4} py={4}><SummaryTab row={row} detect={detect} /></TabPanel>
          <TabPanel px={4} py={4}><ObjectsTab detect={detect} /></TabPanel>
          <TabPanel px={4} py={4}><CropsTab detect={detect} /></TabPanel>
          <TabPanel px={4} py={4}><TextTab detect={detect} /></TabPanel>
          <TabPanel px={4} py={4}><LayoutTab detect={detect} /></TabPanel>
          <TabPanel px={4} py={4}><PaletteTab detect={detect} /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
