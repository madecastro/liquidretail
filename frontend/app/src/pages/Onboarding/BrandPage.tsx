// Onboarding step 2 — create the user's first Brand.
//
// Routed at /onboarding/brand. Reached via the workspace-create
// success redirect, or directly. Two-input form (name + URL); submit
// fires POST /api/brand which:
//   1. Creates the Brand stub (advertiserId from req.advertiserId)
//   2. Calls triggerEnrichment(brand, 'create') — fire-and-forget
//      brandfetch + scrape + GPT-4.1 fan-out for tagline / tone /
//      personas / colors / logo / fonts / brand-safety / reviews
//
// User doesn't wait on enrichment — they advance to /onboarding/connect
// (Phase 3) immediately. The Brand object fills in over ~15s in the
// background; UI surfaces fields as they land.
//
// URL handling: scheme auto-prepended if missing. We validate the
// final shape with the URL constructor so a typo'd URL gets caught
// client-side before the round trip.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardBody, FormControl, FormLabel, FormHelperText,
  Input, Heading, Text, VStack, HStack, Spinner, useToast
} from '@chakra-ui/react';
import { apiJson } from '../../auth/apiFetch';
import { useAuth } from '../../auth/AuthContext';

type CreateResponse = {
  brand: {
    id:           string;
    name:         string;
    slug:         string;
    websiteUrl:   string | null;
    primaryColor: string | null;
    source:       string;
  };
};

export function BrandPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [url, setUrl]   = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Defensive bounces. Deep-links here are valid in two states:
  //   - signed in + already has Advertiser → continue to the form
  //   - signed in + NO advertiser → bounce back to workspace-create
  // The eligibility check carries hasAdvertiser, so reuse it.
  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      navigate('/landing', { replace: true });
      return;
    }
    if (auth.status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const elig = await apiJson<{ hasAdvertiser: boolean; canSelfCreate: boolean }>('/api/onboarding/eligibility');
        if (cancelled) return;
        if (!elig.hasAdvertiser) {
          navigate(elig.canSelfCreate ? '/onboarding/workspace' : '/onboarding', { replace: true });
        }
      } catch {
        // Eligibility failure is non-fatal — let the user proceed; if
        // they really lack an advertiser, the POST /api/brand will
        // 403 and apiFetch handles the bounce.
      }
    })();
    return () => { cancelled = true; };
  }, [auth.status, navigate]);

  const trimmedName = name.trim();
  const normalizedUrl = normalizeUrl(url);
  const canSubmit = trimmedName.length > 0 && !!normalizedUrl && !urlError && !submitting;

  const onUrlBlur = () => {
    if (!url.trim()) { setUrlError(null); return; }
    if (!normalizeUrl(url)) {
      setUrlError("That doesn't look like a valid URL — e.g. yourbrand.com");
    } else {
      setUrlError(null);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiJson<CreateResponse>('/api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       trimmedName,
          websiteUrl: normalizedUrl
        })
      });
      // Stash the new brand id so the next call (and the brand picker)
      // already knows which brand the operator just created.
      localStorage.setItem('brand_id', res.brand.id);
      toast({
        title:       'Brand created',
        description: 'Background enrichment kicked off — colors, voice, and personas will fill in shortly.',
        status:      'success',
        duration:    3500
      });
      // Phase 3 will replace this with /onboarding/connect. For now
      // we hand off to the existing /brand page where the user can
      // watch enrichment land + manually start integrations.
      navigate('/brand', { replace: true });
    } catch (e) {
      toast({
        title:       'Could not create brand',
        description: e instanceof Error ? e.message : String(e),
        status:      'error',
        duration:    6000
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.status === 'loading') {
    return (
      <Box minH="60vh" display="grid" placeItems="center">
        <HStack spacing={3}><Spinner size="sm" /><Text fontSize="sm" color="brand.muted">Checking session…</Text></HStack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="brand.canvas" py={20} px={4}>
      <Box maxW="560px" mx="auto">
        <Card>
          <CardBody p={8}>
            <VStack align="stretch" spacing={5}>
              <Box>
                <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="rsViolet.500" mb={2}>
                  Step 2 of 3 — Brand
                </Text>
                <Heading size="md" color="brand.ink">Tell us about your brand</Heading>
                <Text fontSize="sm" color="brand.muted" mt={2}>
                  We'll pull your colors, fonts, voice, personas, and audience tags from your site so you can
                  start generating ads with one click.
                </Text>
              </Box>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Brand name</FormLabel>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Hot Crispy Oil"
                  autoFocus
                  isDisabled={submitting}
                />
              </FormControl>

              <FormControl isRequired isInvalid={!!urlError}>
                <FormLabel fontSize="sm">Website URL</FormLabel>
                <Input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(null); }}
                  onBlur={onUrlBlur}
                  placeholder="hotcrispyoil.com"
                  isDisabled={submitting}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
                />
                <FormHelperText fontSize="11px" color={urlError ? 'red.500' : 'brand.muted'}>
                  {urlError || "We'll add https:// if you leave it off."}
                </FormHelperText>
              </FormControl>

              <HStack justify="flex-end">
                <Button variant="outline" onClick={auth.signOut} isDisabled={submitting}>
                  Sign out
                </Button>
                <Button
                  variant="brand"
                  onClick={submit}
                  isLoading={submitting}
                  loadingText="Creating…"
                  isDisabled={!canSubmit}
                >
                  Continue
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}

// Auto-prepend https:// when missing, then validate via the URL
// constructor. Returns the normalized form on success or null when
// the input can't be coerced into a valid URL. Keeps localhost out
// since this is a brand site, not a dev URL.
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    if (u.hostname === 'localhost') return null;
    return u.toString().replace(/\/$/, '');   // strip trailing slash for tidiness
  } catch {
    return null;
  }
}
