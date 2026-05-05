// Phase A-3 — drill-in for "why did we match this product?"
// Shows each provider that fired, its reasoning, and the URLs it
// returned with thumbnails. Backed by ProductMatchArtifact.providers
// (now exposed via productMatchesAll[i].providers).

import {
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverHeader,
  PopoverBody, PopoverCloseButton, Box, Text, VStack, HStack, Badge,
  Image, Link, Divider, Heading
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { DetectMatch, ProviderEntry } from './types';

type Props = {
  match:    DetectMatch;
  children: ReactNode;     // the trigger element (e.g. an agreement chip)
};

export function EvidencePopover({ match, children }: Props) {
  const providers = match.providers || {};
  const keys = Object.keys(providers);

  return (
    <Popover placement="left-start" closeOnBlur trigger="click">
      <PopoverTrigger>
        <Box display="inline-block" cursor="pointer">{children}</Box>
      </PopoverTrigger>
      <PopoverContent w="380px" maxH="70vh" overflowY="auto">
        <PopoverArrow />
        <PopoverHeader>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="700">Match evidence</Text>
            <Badge variant="subtle" fontSize="9px" colorScheme="gray">{keys.length} provider{keys.length === 1 ? '' : 's'}</Badge>
          </HStack>
        </PopoverHeader>
        <PopoverCloseButton />
        <PopoverBody>
          {keys.length === 0 ? (
            <Text fontSize="xs" color="brand.muted">
              No provider evidence captured (catalog winner or scene-level path).
            </Text>
          ) : (
            <VStack align="stretch" spacing={4} divider={<Divider />}>
              {keys.map(k => (
                <ProviderBlock key={k} entry={providers[k]} />
              ))}
            </VStack>
          )}

          {match.identification?.reasoning && (
            <Box mt={4} pt={3} borderTopWidth="1px" borderTopColor="brand.border">
              <Heading size="xs" mb={1}>Reasoner</Heading>
              <Text fontSize="xs" color="brand.ink" lineHeight="1.5">
                {match.identification.reasoning}
              </Text>
            </Box>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

function ProviderBlock({ entry }: { entry: ProviderEntry }) {
  return (
    <Box>
      <HStack mb={1.5}>
        <Heading size="xs">{entry.provider}</Heading>
        {entry.matches?.length ? (
          <Badge variant="subtle" fontSize="9px" colorScheme="gray">{entry.matches.length}</Badge>
        ) : null}
      </HStack>
      {entry.queryUsed && (
        <Text fontSize="9px" color="brand.muted" mb={1.5}>
          query: <Text as="span" fontFamily="mono">{entry.queryUsed}</Text>
        </Text>
      )}
      {entry.reasoning && (
        <Text fontSize="xs" color="brand.ink" lineHeight="1.5" mb={2}>{entry.reasoning}</Text>
      )}
      {entry.matches && entry.matches.length > 0 && (
        <VStack align="stretch" spacing={1.5}>
          {entry.matches.slice(0, 6).map((m, i) => (
            <HStack key={i} spacing={2} align="flex-start">
              <Box w="32px" h="32px" borderRadius="sm" overflow="hidden" bg="gray.100" flexShrink={0}>
                {m.thumbnail && <Image src={m.thumbnail} alt={m.title || ''} w="100%" h="100%" objectFit="cover" />}
              </Box>
              <Box flex={1} minW={0}>
                {m.url ? (
                  <Link href={m.url} isExternal fontSize="xs" color="rsViolet.700" noOfLines={1}>
                    {m.title || m.url}
                  </Link>
                ) : (
                  <Text fontSize="xs" color="brand.ink" noOfLines={1}>{m.title || '(untitled)'}</Text>
                )}
                <HStack spacing={2} mt={0.5}>
                  {m.retailer && <Text fontSize="9px" color="brand.muted">{m.retailer}</Text>}
                  {m.priceHint && <Text fontSize="9px" color="brand.muted">· {m.priceHint}</Text>}
                  {m.weight && <Badge variant="outline" fontSize="9px">{m.weight}</Badge>}
                </HStack>
              </Box>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
