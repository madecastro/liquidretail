// Settings — workspace-level configuration stub.
//
// Placeholder for advertiser-level settings (members, billing,
// integration management across brands, API keys). Brand-level
// settings stay on /brand. The real surface lands once we have a
// concrete config to expose.

import { Card, CardBody, VStack, Text } from '@chakra-ui/react';
import { PageHeader } from '../../shell/PageHeader';

export function SettingsPage() {
  return (
    <VStack align="stretch" spacing={6}>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Advertiser-level configuration — members, billing, API access, and cross-brand integration management."
      />
      <Card variant="outline">
        <CardBody>
          <VStack align="stretch" spacing={3} py={8} textAlign="center">
            <Text fontSize="sm" color="brand.muted" fontWeight="700" textTransform="uppercase" letterSpacing="0.06em">
              Coming soon
            </Text>
            <Text color="brand.ink" fontWeight="600" fontSize="lg">
              Workspace settings rebuild is on the backlog.
            </Text>
            <Text fontSize="sm" color="brand.muted" maxW="520px" mx="auto">
              Per-brand settings live on the Brand page. This page will host
              advertiser-level configuration once we have member management
              and billing surfaces to expose.
            </Text>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}
