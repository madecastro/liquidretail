import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, Card, CardBody, VStack, Heading, Text, Button } from '@chakra-ui/react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { BrandProvider } from './brand/BrandContext';
import { PipelineShell } from './shell/PipelineShell';
import { LandingPage } from './pages/Landing';
import { OnboardingPage } from './pages/Onboarding';
import { WorkspacePage } from './pages/Onboarding/WorkspacePage';
import { BrandPage as OnboardingBrandPage } from './pages/Onboarding/BrandPage';
import { ConnectPage } from './pages/Onboarding/ConnectPage';
import { BrandPage } from './pages/Brand';
import { HomePage } from './pages/Home';
import { UploadPage } from './pages/Upload';
import { DetectReviewPage } from './pages/DetectReview';
import { CampaignsPage } from './pages/Campaigns';
import { CampaignDetailPage } from './pages/CampaignDetail';
import { AdsPage } from './pages/Ads';
import { GenerateAdsWizard } from './pages/GenerateAds';
import { MediaLibraryPage } from './pages/MediaLibrary';
import { CatalogBrowserPage } from './pages/CatalogBrowser';
import { SettingsPage } from './pages/Settings';

// Reorg: primary nav is Brand / Campaigns / Ads. Upload + Detect retired
// from the sidebar but their routes remain so deep links keep working
// (they fold into the Generate Ads wizard's empty-state upload step).

export function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PipelineShell />}>
              <Route path="/home"           element={<RequireAuth><HomePage /></RequireAuth>} />
              <Route path="/brand"          element={<RequireAuth><BrandPage /></RequireAuth>} />
              <Route path="/campaigns"      element={<RequireAuth><CampaignsPage /></RequireAuth>} />
              <Route path="/campaigns/:id"  element={<RequireAuth><CampaignDetailPage /></RequireAuth>} />
              <Route path="/ads"            element={<RequireAuth><AdsPage /></RequireAuth>} />
              <Route path="/generate-ads"   element={<RequireAuth><GenerateAdsWizard /></RequireAuth>} />
              {/* Detect Review — secondary nav entry. Operator queue
                  for reviewing AI-detected products before they land in
                  the Product Catalog. */}
              <Route path="/detect"         element={<RequireAuth><DetectReviewPage /></RequireAuth>} />
              {/* Deep-link / wizard-internal routes — not in primary nav */}
              <Route path="/upload"         element={<RequireAuth><UploadPage /></RequireAuth>} />
              <Route path="/media-library"  element={<RequireAuth><MediaLibraryPage /></RequireAuth>} />
              <Route path="/catalog"        element={<RequireAuth><CatalogBrowserPage /></RequireAuth>} />
              <Route path="/settings"       element={<RequireAuth><SettingsPage /></RequireAuth>} />
            </Route>
            {/* Public marketing landing — no app shell, no auth gate. */}
            <Route path="/landing" element={<LandingPage />} />
            {/* Onboarding — authenticated users without an Advertiser
                membership. Reached via apiFetch's 403 NO_ADVERTISER
                redirect; rendered without RequireAuth so the
                logged-in-but-no-workspace state doesn't bounce back
                through the auth gate. */}
            <Route path="/onboarding"           element={<OnboardingPage />} />
            <Route path="/onboarding/workspace" element={<WorkspacePage />} />
            <Route path="/onboarding/brand"     element={<RequireAuth><OnboardingBrandPage /></RequireAuth>} />
            <Route path="/onboarding/connect"   element={<RequireAuth><ConnectPage /></RequireAuth>} />
            {/* Root redirects: unauthed → /landing, authed → /brand. */}
            <Route path="/"  element={<RootRedirect />} />
            <Route path="*"  element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </BrandProvider>
    </AuthProvider>
  );
}

// Root entry — sends prospects to the marketing page and authed users
// to their brand workspace. Loading state renders nothing rather than
// flashing a redirect target while AuthProvider resolves the session.
function RootRedirect() {
  const auth = useAuth();
  if (auth.status === 'loading') return null;
  if (auth.status === 'unauthenticated') return <Navigate to="/landing" replace />;
  return <Navigate to="/home" replace />;
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
