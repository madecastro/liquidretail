// Phase 4 follow-up #3 — page-level ErrorBoundary for the Catalog
// Browser. Catches render-time exceptions (unlike Vite's runtime
// console errors which the user has to dig devtools to see) and
// shows a recovery card with the error message + a Reset button
// that re-mounts the children.
//
// Mostly a defensive belt against pipeline-data shape drift —
// CatalogProduct.{specs, reviews, productReviews, sellers} are all
// Mongoose Mixed and can hold whatever the upstream provider
// returns; a malformed entry should not blank the entire page.

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Button, Card, CardBody, Heading, Text, VStack, Code } from '@chakra-ui/react';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class CatalogErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console with full stack so devtools shows the
    // un-minified call site. (React's own log strips the stack on
    // the production minified bundle.)
    // eslint-disable-next-line no-console
    console.error('CatalogBrowser render error:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <Box p={8}>
          <Card variant="outline">
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <Heading size="md" color="red.600">Something went wrong rendering this product</Heading>
                <Text fontSize="sm" color="brand.muted">
                  An exception occurred inside the Catalog Browser. The selected product's data
                  shape may be unexpected. Try selecting another product or reload the page.
                </Text>
                <Code fontSize="xs" colorScheme="red" p={3} display="block" whiteSpace="pre-wrap">
                  {this.state.error.message || String(this.state.error)}
                </Code>
                <Button onClick={this.reset} variant="brand" size="sm" alignSelf="flex-start">
                  Reset
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </Box>
      );
    }
    return this.props.children;
  }
}
