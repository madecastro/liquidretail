import { Flex, Box, Text, HStack } from '@chakra-ui/react';
import { STEPS, type StepKey, type StepStatus } from '../routes';
import { rsGradient } from '../theme/reachSocialTheme';

const CheckGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4.5 12.75 9.75 18 19.5 7.5" />
  </svg>
);

const WarningGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v3.75m0 3.75h.008M10.5 3.75h3l8.25 14.25h-19.5L10.5 3.75z" />
  </svg>
);

// Horizontal pipeline stepper. Each step is a circular node with the
// step number (or check / warning glyph), connected by a thin line.
// Per spec:
//   active   → brand gradient fill
//   complete → green check
//   pending  → gray outline
//   warning  → yellow/orange warning glyph

type Props = {
  stepStatuses: Record<StepKey, StepStatus>;
};

export function PipelineStepHeader({ stepStatuses }: Props) {
  return (
    <Flex
      as="nav"
      aria-label="Pipeline progress"
      bg="white"
      borderRadius="3xl"
      borderWidth="1px"
      borderColor="brand.border"
      boxShadow="sm"
      px={6}
      py={5}
      gap={2}
      align="center"
      justify="space-between"
    >
      {STEPS.map((step, i) => {
        const status = stepStatuses[step.key] ?? 'pending';
        const isLast = i === STEPS.length - 1;
        return (
          <HStack key={step.key} flex={isLast ? '0 0 auto' : 1} align="center" spacing={3}>
            <StepNode index={i + 1} status={status} />
            <Box minW={0} flex={1}>
              <Text fontSize="xs" color="brand.muted" textTransform="uppercase" letterSpacing="0.06em" fontWeight="700">
                Step {i + 1}
              </Text>
              <Text
                fontSize="sm"
                fontWeight="700"
                color={status === 'pending' ? 'brand.muted' : 'brand.ink'}
                lineHeight="1.2"
              >
                {step.label}
              </Text>
            </Box>
            {!isLast && <Connector />}
          </HStack>
        );
      })}
    </Flex>
  );
}

function StepNode({ index, status }: { index: number; status: StepStatus }) {
  const base = {
    w: '36px',
    h: '36px',
    borderRadius: 'full',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'sm',
    fontWeight: 700,
    flexShrink: 0
  } as const;

  if (status === 'active') {
    return (
      <Box {...base} color="white" bgImage={rsGradient} boxShadow="brand">
        {index}
      </Box>
    );
  }
  if (status === 'complete') {
    return (
      <Box {...base} bg="green.500" color="white">
        <CheckGlyph />
      </Box>
    );
  }
  if (status === 'warning') {
    return (
      <Box {...base} bg="rsYellow.50" color="rsOrange.600" borderWidth="1px" borderColor="rsYellow.200">
        <WarningGlyph />
      </Box>
    );
  }
  // pending
  return (
    <Box {...base} bg="white" color="brand.muted" borderWidth="1.5px" borderColor="gray.200">
      {index}
    </Box>
  );
}

function Connector() {
  return <Box flex={1} h="2px" bg="gray.200" borderRadius="full" minW="20px" />;
}
