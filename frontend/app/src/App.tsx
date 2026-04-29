import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PipelineShell } from './shell/PipelineShell';
import { BrandPage } from './pages/Brand';
import { UploadPage } from './pages/Upload';
import { DetectPage } from './pages/Detect';
import { AdGenerationPage } from './pages/AdGeneration';

// Phase 2: every primary route nests under PipelineShell so the
// sidebar + stepper render once. Default and unknown routes redirect
// to /brand. Auth + onboarding gates land in Phase 3 — for now any
// load of the SPA drops directly into the shell.

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PipelineShell />}>
          <Route path="/brand"  element={<BrandPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/detect" element={<DetectPage />} />
          <Route path="/ads"    element={<AdGenerationPage />} />
        </Route>
        <Route path="/"  element={<Navigate to="/brand" replace />} />
        <Route path="*"  element={<Navigate to="/brand" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
