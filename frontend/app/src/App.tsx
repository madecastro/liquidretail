import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, Card, CardBody, VStack, Heading, Text, Button } from '@chakra-ui/react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { BrandProvider } from './brand/BrandContext';
import { PipelineShell } from './shell/PipelineShell';
import { BrandPage } from './pages/Brand';
import { UploadPage } from './pages/Upload';
import { DetectPage } from './pages/Detect';
import { AdGenerationPage } from './pages/AdGeneration';
import { MediaLibraryPage } from './pages/MediaLibrary';

// Phase 3 wraps everything in AuthProvider + BrandProvider so any
// component (including the Sidebar's BrandPicker + sign-out) can read
// auth state via hooks.
//
// RequireAuth gates the routes — unauthenticated users see a sign-in
// CTA inside the shell, not a blank page. Authentication itself
// happens through the existing /login.html (Google OAuth bounce);
// rebuilding login as a SPA route is a later phase.

export function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PipelineShell />}>
              <Route path="/brand"         element={<RequireAuth><BrandPage /></RequireAuth>} />
              <Route path="/upload"        element={<RequireAuth><UploadPage /></RequireAuth>} />
              <Route path="/detect"        element={<RequireAuth><DetectPage /></RequireAuth>} />
              <Route path="/media-library" element={<RequireAuth><MediaLibraryPage /></RequireAuth>} />
              <Route path="/ads"           element={<RequireAuth><AdGenerationPage /></RequireAuth>} />
            </Route>
            <Route path="/"  element={<Navigate to="/brand" replace />} />
            <Route path="*"  element={<Navigate to="/brand" replace />} />
          </Routes>
        </BrowserRouter>
      </BrandProvider>
    </AuthProvider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return (
      <Card>
        <CardBody>
          <Text color="brand.muted" fontSize="sm">Loading session…</Text>
        </CardBody>
      </Card>
    );
  }
  if (auth.status === 'unauthenticated') {
    return (
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4} py={8}>
            <Box textAlign="center">
              <Heading size="md" color="brand.ink" mb={2}>Sign in to continue</Heading>
              <Text color="brand.muted" fontSize="sm" maxW="420px" mx="auto" mb={6}>
                Reach Social uses Google sign-in. Your account links to the
                Advertiser workspace you've been invited to.
              </Text>
              <Button variant="brand" onClick={auth.signIn}>Sign in with Google</Button>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    );
  }
  return <>{children}</>;
}
