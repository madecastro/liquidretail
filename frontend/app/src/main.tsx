import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { reachSocialTheme } from './theme/reachSocialTheme';
import { App } from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <ColorModeScript initialColorMode={reachSocialTheme.config.initialColorMode} />
    <ChakraProvider theme={reachSocialTheme}>
      <App />
    </ChakraProvider>
  </StrictMode>
);
