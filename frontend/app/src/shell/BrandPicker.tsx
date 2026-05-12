import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, Menu, MenuButton, MenuList, MenuItem, MenuDivider,
  Button, HStack, Spinner
} from '@chakra-ui/react';
import { useBrand } from '../brand/BrandContext';
import { NewBrandModal } from './NewBrandModal';

// Sidebar dropdown showing the active brand + a list to switch.
// Workspace switcher appears at the top of the menu when the user
// belongs to >1 advertiser. Mirrors the legacy brandPicker.js
// behavior — same localStorage keys, same brand:change event.

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function BrandPicker() {
  const { loading, brands, activeBrand, setActiveBrand, refreshBrands, memberships, activeAdvertiserId, setActiveAdvertiser } = useBrand();
  const navigate = useNavigate();
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const showWorkspaceSwitcher = memberships.length > 1;

  // After a successful create: refresh the brand list, switch to the
  // new brand, and bounce to the connect step so the user can wire IG
  // + ads. dispatch-syncs auto-fires once integrations land, which is
  // what triggers catalog sync → product-path detect + post detect.
  const handleCreated = async (newBrandId: string) => {
    setNewBrandOpen(false);
    await refreshBrands();
    setActiveBrand(newBrandId);
    navigate('/onboarding/connect');
  };

  if (loading && !activeBrand) {
    return (
      <Flex align="center" gap={2} px={3} py={2} borderRadius="lg" bg="gray.50">
        <Spinner size="xs" /><Text fontSize="xs" color="brand.muted">Loading brands…</Text>
      </Flex>
    );
  }

  if (!brands.length) {
    return (
      <>
        <Box px={3} py={2} borderRadius="lg" bg="rsYellow.50" borderWidth="1px" borderColor="rsYellow.200">
          <Text fontSize="xs" color="rsOrange.700" fontWeight="700">No brand yet</Text>
          <Button
            size="xs" mt={2} variant="solid" colorScheme="purple"
            leftIcon={<PlusIcon />}
            onClick={() => setNewBrandOpen(true)}
          >
            New brand
          </Button>
        </Box>
        <NewBrandModal
          isOpen={newBrandOpen}
          onClose={() => setNewBrandOpen(false)}
          onCreated={handleCreated}
        />
      </>
    );
  }

  return (
    <>
      <Menu placement="bottom-start" matchWidth>
        <MenuButton as={Button} variant="outline" w="full" textAlign="left" h="auto" py={2.5} px={3}>
          <Flex align="center" gap={2}>
            <Box w="20px" h="20px" borderRadius="md" bg={activeBrand?.primaryColor ?? 'gray.300'} flexShrink={0} />
            <Box flex={1} minW={0}>
              <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" fontWeight="700">
                Active brand
              </Text>
              <Text fontSize="sm" color="brand.ink" fontWeight="700" noOfLines={1}>
                {activeBrand?.name ?? 'Pick a brand'}
              </Text>
            </Box>
            <Box color="brand.muted"><ChevronDown /></Box>
          </Flex>
        </MenuButton>

        <MenuList shadow="lg" maxH="60vh" overflowY="auto">
          {showWorkspaceSwitcher && (
            <>
              <Text px={3} pt={2} pb={1} fontSize="10px" color="brand.muted" textTransform="uppercase" letterSpacing="0.07em" fontWeight="800">
                Workspaces
              </Text>
              {memberships.filter(m => m.status === 'active').map(m => {
                const isActive = m.advertiserId === activeAdvertiserId;
                return (
                  <MenuItem
                    key={m.id}
                    onClick={() => !isActive && setActiveAdvertiser(m.advertiserId)}
                    isDisabled={isActive}
                    bg={isActive ? 'rsViolet.50' : undefined}
                  >
                    <HStack flex={1} justify="space-between">
                      <Text fontSize="sm" fontWeight={isActive ? 700 : 500} color="brand.ink">
                        {m.advertiserName ?? m.advertiserId.slice(-6)}
                      </Text>
                      <Text fontSize="xs" color="brand.muted">{m.role}</Text>
                    </HStack>
                  </MenuItem>
                );
              })}
              <MenuDivider />
            </>
          )}

          <Text px={3} pt={2} pb={1} fontSize="10px" color="brand.muted" textTransform="uppercase" letterSpacing="0.07em" fontWeight="800">
            Brands
          </Text>
          {brands.map(b => {
            const isActive = b.id === activeBrand?.id;
            return (
              <MenuItem
                key={b.id}
                onClick={() => !isActive && setActiveBrand(b.id)}
                isDisabled={isActive}
                bg={isActive ? 'rsViolet.50' : undefined}
              >
                <HStack flex={1}>
                  <Box w="14px" h="14px" borderRadius="sm" bg={b.primaryColor ?? 'gray.300'} />
                  <Text fontSize="sm" fontWeight={isActive ? 700 : 500} color="brand.ink" noOfLines={1}>
                    {b.name}
                  </Text>
                </HStack>
              </MenuItem>
            );
          })}

          <MenuDivider />
          <MenuItem onClick={() => setNewBrandOpen(true)} icon={<PlusIcon />}>
            <Text fontSize="sm" fontWeight={600} color="rsViolet.600">New brand</Text>
          </MenuItem>
        </MenuList>
      </Menu>

      <NewBrandModal
        isOpen={newBrandOpen}
        onClose={() => setNewBrandOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
