// Reach Social marketing landing page.
//
// Public, no auth gate. The Get Started / sign-in CTAs invoke the
// shared OAuth flow via useAuth().signIn(); after auth, the user
// lands on /brand per the AuthProvider's post-auth handling.
//
// Adapted from reach_social_landing_page_mockup.jsx — theme tokens
// remapped to the app's existing reachSocialTheme (rsViolet/rsMagenta/
// rsOrange palettes + brand.* aliases). Stock Unsplash placeholders
// in the mockup are replaced with /landing/* paths served from
// frontend/app/public/landing/.

import {
  Box, Button, Container, Flex, Grid, GridItem, Heading, Text, Badge,
  HStack, VStack, SimpleGrid, Card, CardBody, Image, Icon, Avatar,
  AvatarGroup, Switch, Select
} from '@chakra-ui/react';
import {
  Sparkles, Play, CheckCircle2, ShoppingBag, Megaphone,
  Image as ImageIcon, ShieldCheck, BarChart3, Wand2, ArrowRight, Star,
  Heart, MessageCircle, LayoutGrid, Smartphone, Monitor, Package, Users
} from 'lucide-react';
import type { ComponentType, SVGProps, ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';

// Reach Social signature gradient — matches the brand-button variant
// but in CSS-string form for inline use as backgrounds / text fills.
const RS_GRADIENT = 'linear-gradient(to right, #7A35E8, #D9008D, #F57C00)';

const gradientText = {
  bgGradient: 'linear(to-r, #F57C00, #D9008D, #7A35E8)',
  bgClip: 'text'
} as const;

// ── Brand mark ────────────────────────────────────────────────────

function Logo() {
  return (
    <HStack spacing={3}>
      <Box
        w="34px" h="34px"
        borderRadius="lg"
        bg={RS_GRADIENT}
        color="white"
        display="grid"
        placeItems="center"
        fontWeight="900"
        fontSize="18px"
      >
        R
      </Box>
      <Text fontWeight="800" letterSpacing="-0.02em" color="brand.ink">
        REACH SOCIAL
      </Text>
    </HStack>
  );
}

// ── Top navigation ────────────────────────────────────────────────

function TopNav({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Box
      position="sticky" top={0} zIndex={20}
      bg="whiteAlpha.900" backdropFilter="blur(18px)"
      borderBottomWidth="1px" borderBottomColor="brand.border"
    >
      <Container maxW="1180px" py={4}>
        <Flex align="center" justify="space-between">
          <Logo />
          <HStack spacing={8} display={{ base: 'none', md: 'flex' }} fontSize="sm" color="brand.ink">
            <Text>Product</Text>
            <Text>Solutions</Text>
            <Text>Resources</Text>
            <Text>Pricing</Text>
            <Text>About</Text>
          </HStack>
          <HStack spacing={3}>
            <Button variant="ghost" size="sm" onClick={onSignIn}>Sign in</Button>
            <Button variant="brand" onClick={onSignIn}>Get Started Free</Button>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}

// ── Mocked Generate-Ads preview panel (hero illustration) ──────────

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

function MiniIconButton({ icon, active }: { icon: LucideIcon; active?: boolean }) {
  return (
    <Box
      w="38px" h="38px"
      display="grid" placeItems="center"
      borderRadius="lg"
      bg={active ? 'rsViolet.50' : 'transparent'}
      color={active ? 'rsViolet.500' : 'brand.muted'}
    >
      <Icon as={icon} boxSize={4} />
    </Box>
  );
}

function AdPreviewPanel() {
  return (
    <Card borderRadius="3xl" overflow="hidden" bg="white" boxShadow="md">
      <CardBody p={0}>
        <Grid templateColumns="54px 1fr 170px" minH="446px">
          {/* App-shell rail */}
          <GridItem borderRightWidth="1px" borderRightColor="brand.border" pt={12}>
            <VStack spacing={4}>
              <MiniIconButton icon={LayoutGrid} />
              <MiniIconButton icon={ImageIcon} />
              <MiniIconButton icon={ShoppingBag} />
              <MiniIconButton icon={Megaphone} active />
              <MiniIconButton icon={BarChart3} />
              <MiniIconButton icon={ShieldCheck} />
            </VStack>
          </GridItem>

          {/* Ad preview canvas */}
          <GridItem p={7}>
            <Flex align="center" justify="space-between" mb={4}>
              <Text fontWeight="800" color="brand.ink">Ad Preview</Text>
              <Badge variant="processing">Live</Badge>
            </Flex>
            <HStack spacing={2} mb={5}>
              <Button size="xs" variant="outline" leftIcon={<Icon as={LayoutGrid} boxSize={3} />}>Square (1:1)</Button>
              <Button size="xs" variant="softBrand" leftIcon={<Icon as={Smartphone} boxSize={3} />}>Vertical (9:16)</Button>
              <Button size="xs" variant="outline" leftIcon={<Icon as={Monitor} boxSize={3} />}>Landscape</Button>
            </HStack>

            <Box borderRadius="2xl" overflow="hidden" borderWidth="1px" borderColor="brand.border" bg="gray.50">
              <Grid templateColumns="1fr 190px" minH="318px">
                <Box position="relative" overflow="hidden">
                  <Image
                    src="/landing/hero/creator.jpg"
                    alt="Creator content"
                    objectFit="cover" w="100%" h="100%"
                  />
                  <Box position="absolute" inset={0} bgGradient="linear(to-t, blackAlpha.500, transparent 55%)" />
                  <Box
                    position="absolute" left={4} bottom={4}
                    bg="white" borderRadius="2xl" p={3} maxW="210px" boxShadow="lg"
                  >
                    <HStack align="start" spacing={2}>
                      <Avatar size="sm" src="/landing/hero/creator-avatar.jpg" />
                      <Box>
                        <Text fontWeight="700" fontSize="xs" color="brand.ink">
                          Love this cap! Perfect for hikes.
                        </Text>
                        <Text fontSize="10px" color="brand.muted">@adventure_jen</Text>
                      </Box>
                    </HStack>
                    <HStack spacing={4} mt={2} fontSize="11px" color="brand.ink">
                      <HStack spacing={1}><Icon as={Heart} boxSize={3} color="rsOrange.400" /><Text>1.2k</Text></HStack>
                      <HStack spacing={1}><Icon as={MessageCircle} boxSize={3} /><Text>86</Text></HStack>
                    </HStack>
                  </Box>
                </Box>
                <Flex p={5} direction="column" justify="center" bg="linear-gradient(180deg,#FFFFFF,#F7F2EC)">
                  <Image
                    src="/landing/hero/product.jpg"
                    alt="Featured product"
                    h="126px"
                    objectFit="contain"
                    mb={5}
                  />
                  <Text fontWeight="800" color="brand.ink">Performance Cap</Text>
                  <Text color="brand.ink" fontSize="md">$29.00</Text>
                  <Button mt={5} variant="solid">Shop Now</Button>
                </Flex>
              </Grid>
            </Box>
          </GridItem>

          {/* Settings sidebar */}
          <GridItem borderLeftWidth="1px" borderLeftColor="brand.border" p={6} bg="white">
            <Text fontWeight="800" color="brand.ink" mb={5}>Ad Settings</Text>
            <Text fontSize="xs" color="brand.muted" mb={1}>Call to Action</Text>
            <Select size="sm" mb={5} defaultValue="Shop Now">
              <option>Shop Now</option>
            </Select>
            <VStack align="stretch" spacing={4} fontSize="sm" color="brand.ink">
              {['Show Comments', 'Show Likes', 'Show Price'].map((label) => (
                <Flex key={label} justify="space-between" align="center">
                  <Text>{label}</Text>
                  <Switch size="sm" colorScheme="purple" defaultChecked />
                </Flex>
              ))}
              <Flex justify="space-between" align="center">
                <Text>Show Brand Name</Text>
                <Switch size="sm" />
              </Flex>
            </VStack>
            <Text fontSize="xs" color="brand.muted" mt={6} mb={2}>Brand Colors</Text>
            <HStack spacing={2} mb={6}>
              {['#F57C00', '#7A35E8', '#0B1020', '#E5E7EB'].map((c) => (
                <Box key={c} w="18px" h="18px" borderRadius="full" bg={c} />
              ))}
            </HStack>
            <Button w="100%" size="sm" variant="softBrand" leftIcon={<Icon as={Sparkles} boxSize={4} />}>
              Generate More Ads
            </Button>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );
}

// ── Hero ──────────────────────────────────────────────────────────

function Hero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Box position="relative" overflow="hidden">
      {/* Soft blobs behind content */}
      <Box position="absolute" top="-180px" left="-160px" w="520px" h="520px" bg="rsViolet.100" filter="blur(80px)" opacity={0.65} />
      <Box position="absolute" top="90px" right="-140px" w="520px" h="520px" bg="rsOrange.100" filter="blur(90px)" opacity={0.75} />
      <Container maxW="1180px" pt={{ base: 12, md: 16 }} pb={8} position="relative">
        <Grid templateColumns={{ base: '1fr', lg: '0.86fr 1.14fr' }} gap={12} alignItems="center">
          <Box>
            <Badge variant="processing" px={3} py={2} mb={6}>
              <HStack spacing={2}>
                <Icon as={Sparkles} boxSize={3.5} />
                <Text fontSize="xs">AI-POWERED UGC AD CREATION</Text>
              </HStack>
            </Badge>
            <Heading
              as="h1"
              fontSize={{ base: '44px', md: '60px' }}
              lineHeight="1.02"
              letterSpacing="-0.055em"
              color="brand.ink"
              maxW="620px"
            >
              Turn Content Into{' '}
              <Box as="span" {...gradientText}>High-Converting Ads</Box>
            </Heading>
            <Text mt={6} fontSize="lg" lineHeight="1.8" color="brand.muted" maxW="560px">
              Automatically match your products with real customer content and generate
              on-brand ads in seconds.
            </Text>
            <HStack spacing={4} mt={8}>
              <Button
                size="lg"
                variant="brand"
                rightIcon={<Icon as={ArrowRight} boxSize={5} />}
                px={7}
                h="58px"
                onClick={onSignIn}
              >
                Generate Your First Ads
              </Button>
              <Button size="lg" variant="outline" h="58px" px={7} rightIcon={<Icon as={Play} boxSize={4} color="rsViolet.500" />}>
                View Demo
              </Button>
            </HStack>
            <HStack spacing={8} mt={6} color="brand.muted" fontSize="sm" wrap="wrap">
              {['No credit card required', 'Setup in 2 minutes', 'Cancel anytime'].map((item) => (
                <HStack key={item} spacing={2}>
                  <Icon as={CheckCircle2} boxSize={4} />
                  <Text>{item}</Text>
                </HStack>
              ))}
            </HStack>
            <HStack spacing={4} mt={9}>
              <AvatarGroup size="sm" max={4}>
                {[11, 12, 13, 14].map((i) => <Avatar key={i} src={`/landing/testimonials/avatar-${i}.jpg`} />)}
              </AvatarGroup>
              <Box>
                <HStack spacing={0.5}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Icon key={i} as={Star} boxSize={4} fill="#FFB020" color="#FFB020" />
                  ))}
                </HStack>
                <Text fontSize="sm" color="brand.ink">
                  <b>4.8/5</b> from 2,000+ brands
                </Text>
              </Box>
            </HStack>
          </Box>
          <AdPreviewPanel />
        </Grid>
      </Container>
    </Box>
  );
}

// ── How it works ─────────────────────────────────────────────────

function StepCard({
  n, icon, title, desc, color, children
}: {
  n: string; icon: LucideIcon; title: string; desc: string;
  color: string; children?: ReactNode;
}) {
  return (
    <Card borderRadius="2xl" bg="white">
      <CardBody p={7}>
        <HStack spacing={4} align="start">
          <Box
            w="58px" h="58px"
            borderRadius="2xl"
            bg={color}
            color="white"
            display="grid" placeItems="center"
            boxShadow="md"
          >
            <Icon as={icon} boxSize={7} />
          </Box>
          <Box flex="1">
            <HStack spacing={3} mb={2}>
              <Badge bg="gray.100" color="brand.ink">{n}</Badge>
              <Text fontWeight="800" color="brand.ink">{title}</Text>
            </HStack>
            <Text fontSize="sm" color="brand.muted" lineHeight="1.7">{desc}</Text>
            {children}
          </Box>
        </HStack>
      </CardBody>
    </Card>
  );
}

function HowItWorks() {
  return (
    <Container maxW="1180px" py={12}>
      <Box borderRadius="3xl" borderWidth="1px" borderColor="brand.border" bg="whiteAlpha.800" p={{ base: 6, md: 8 }}>
        <VStack spacing={2} mb={8} textAlign="center">
          <Heading size="lg" color="brand.ink">How it works</Heading>
          <Text color="brand.muted">Create high-performing ads in just 3 simple steps.</Text>
        </VStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <StepCard n="1" icon={ShoppingBag} title="Connect" color="#7A35E8" desc="Connect your stores, ad accounts, and social platforms.">
            <HStack mt={5} spacing={3}>
              {[
                ['Shop', '#95BF47'],
                ['Meta', '#0B8BFF'],
                ['IG', '#D9008D'],
                ['G', '#4285F4']
              ].map(([label, color]) => (
                <Box
                  key={label}
                  w="34px" h="34px"
                  borderWidth="1px" borderColor="brand.border"
                  borderRadius="lg"
                  display="grid" placeItems="center"
                  color={color}
                  fontWeight="800"
                >
                  {label}
                </Box>
              ))}
            </HStack>
          </StepCard>
          <StepCard n="2" icon={Sparkles} title="Match" color="#D9008D" desc="Our AI matches your products with top-performing UGC.">
            <HStack mt={5} spacing={3} color="brand.muted">
              <Icon as={Package} />
              <Text>+</Text>
              <Icon as={ImageIcon} />
              <Text>=</Text>
              <Icon as={Wand2} color="rsViolet.500" />
            </HStack>
          </StepCard>
          <StepCard n="3" icon={Megaphone} title="Generate" color="#F57C00" desc="Generate on-brand ads across every major format instantly.">
            <HStack mt={5} spacing={3}>
              {[LayoutGrid, Smartphone, Monitor, Users].map((I, idx) => (
                <Box
                  key={idx}
                  w="34px" h="34px"
                  borderWidth="1px" borderColor="brand.border"
                  borderRadius="lg"
                  display="grid" placeItems="center"
                >
                  <Icon as={I} boxSize={4} />
                </Box>
              ))}
            </HStack>
          </StepCard>
        </SimpleGrid>
      </Box>
    </Container>
  );
}

// ── Ads gallery ───────────────────────────────────────────────────

const adExamples = [
  { label: 'Square (1:1)',     title: 'Trail Runner Pack',   price: '$69.00',  img: '/landing/ads-gallery/ad-1.jpg' },
  { label: 'Vertical (9:16)',  title: 'Stormproof Jacket',   price: '$149.00', img: '/landing/ads-gallery/ad-2.jpg' },
  { label: 'Landscape (16:9)', title: 'Hiker Boots',         price: '$129.00', img: '/landing/ads-gallery/ad-3.jpg' },
  { label: 'Carousel',         title: 'Performance Cap',     price: '$29.00',  img: '/landing/ads-gallery/ad-4.jpg' }
];

type AdExample = typeof adExamples[number];

function MiniAdCard({ item, wide }: { item: AdExample; wide?: boolean }) {
  return (
    <Box borderWidth="1px" borderColor="brand.border" borderRadius="2xl" overflow="hidden" bg="white" boxShadow="sm">
      <Box position="relative" h={wide ? '180px' : '230px'}>
        <Image src={item.img} alt={item.title} w="100%" h="100%" objectFit="cover" />
        <Badge position="absolute" top={3} left={3} variant="processing">{item.label}</Badge>
        <Box position="absolute" left={3} bottom={3} bg="white" borderRadius="lg" p={2} boxShadow="md" maxW="150px">
          <Text fontSize="11px" fontWeight="700">Game changer on long hikes!</Text>
          <HStack mt={1} spacing={2} color="brand.muted" fontSize="10px">
            <Icon as={Heart} boxSize={3} color="rsOrange.400" /><Text>892</Text>
            <Icon as={MessageCircle} boxSize={3} /><Text>42</Text>
          </HStack>
        </Box>
      </Box>
      <Flex align="center" justify="space-between" p={4}>
        <Box>
          <Text fontWeight="800" color="brand.ink" fontSize="sm">{item.title}</Text>
          <Text color="brand.ink" fontSize="13px">{item.price}</Text>
        </Box>
        <Button size="xs" variant="solid">Shop Now</Button>
      </Flex>
    </Box>
  );
}

function AdsGallery() {
  return (
    <Container maxW="1180px" py={2}>
      <Box borderWidth="1px" borderColor="brand.border" bg="white" borderRadius="3xl" p={8} boxShadow="sm">
        <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={3}>
          <Box>
            <Heading size="md" color="brand.ink">AI-Generated Ads That Convert</Heading>
            <Text color="brand.muted" mt={1}>Real content. Real products. Real results.</Text>
          </Box>
          <Button variant="outline" size="sm">View More Examples</Button>
        </Flex>
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1.35fr 1fr' }} gap={6}>
          {adExamples.map((item, idx) => (
            <MiniAdCard key={item.title} item={item} wide={idx === 2} />
          ))}
        </Grid>
        <HStack justify="center" mt={6}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Box key={i} w={i === 0 ? '8px' : '7px'} h="7px" borderRadius="full" bg={i === 0 ? 'rsViolet.500' : 'gray.300'} />
          ))}
        </HStack>
      </Box>
    </Container>
  );
}

// ── Testimonials ──────────────────────────────────────────────────

const testimonials: Array<[string, string, string]> = [
  ['Reach Social replaced our entire creative workflow. Our ROAS increased by 43% in the first month.', 'Sarah Thompson', 'Head of Growth, TrailBlaze'],
  ['The AI matching is unreal. It finds content we never would have discovered.',                       'James Park',     'CMO, Summit Supply Co.'],
  ['Finally, a platform that makes UGC ads easy, fast, and effective.',                                  'Maya Patel',     'Marketing Lead, Nimbus']
];

function Testimonials() {
  return (
    <Container maxW="1180px" py={10}>
      <Box borderRadius="3xl" bg="rsViolet.50" borderWidth="1px" borderColor="brand.border" p={8}>
        <Heading size="md" textAlign="center" color="brand.ink" mb={6}>
          Loved by 2,000+ brands worldwide
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          {testimonials.map(([quote, name, role], idx) => (
            <Card key={name} borderRadius="2xl" bg="white">
              <CardBody p={6}>
                <Text color="brand.ink" lineHeight="1.7">&ldquo;{quote}&rdquo;</Text>
                <HStack mt={6} spacing={3}>
                  <Avatar size="sm" src={`/landing/testimonials/quote-${idx + 1}.jpg`} />
                  <Box>
                    <Text fontSize="13px" fontWeight="800">{name}</Text>
                    <Text fontSize="xs" color="brand.muted">{role}</Text>
                  </Box>
                </HStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Box>
    </Container>
  );
}

// ── Integrations ──────────────────────────────────────────────────

const integrations: Array<[string, string, string]> = [
  ['Shopify',         'E-commerce',  '#95BF47'],
  ['Meta Ads',        'Advertising', '#0B8BFF'],
  ['Instagram',       'Social',      '#D9008D'],
  ['Google Merchant', 'Products',    '#4285F4'],
  ['TikTok Shop',     'E-commerce',  '#111111'],
  ['Facebook',        'Social',      '#1877F2']
];

function Integrations() {
  return (
    <Container maxW="1180px" py={4}>
      <Grid
        templateColumns={{ base: '1fr', lg: '230px 1fr' }}
        gap={6}
        alignItems="center"
        borderWidth="1px" borderColor="brand.border" borderRadius="3xl"
        p={7} bg="white" boxShadow="sm"
      >
        <Box>
          <Heading size="md" color="brand.ink">Works with the tools you already use</Heading>
          <Text color="brand.muted" fontSize="sm" mt={3}>
            Connect your favorite platforms and start creating in minutes.
          </Text>
        </Box>
        <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4}>
          {integrations.map(([title, sub, color]) => (
            <Card key={title} borderRadius="2xl" boxShadow="none">
              <CardBody p={4} textAlign="center">
                <Box
                  mx="auto" mb={3}
                  w="36px" h="36px"
                  borderRadius="lg"
                  bg={`${color}14`}
                  color={color}
                  display="grid" placeItems="center"
                  fontWeight="900"
                >
                  {title[0]}
                </Box>
                <Text fontSize="13px" fontWeight="800" color="brand.ink">{title}</Text>
                <Text fontSize="11px" color="brand.muted">{sub}</Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Grid>
    </Container>
  );
}

// ── Features ──────────────────────────────────────────────────────

const features: Array<[LucideIcon, string, string]> = [
  [Sparkles,    'AI-Powered Matching',   'Advanced AI matches products with the most relevant, high-performing content.'],
  [ShieldCheck, 'Rights Management',     'Built-in rights tracking and approvals keep your brand safe and compliant.'],
  [ImageIcon,   'Multi-Format Ads',      'Generate ads in all popular formats across every major platform.'],
  [BarChart3,   'Performance Insights',  'Track ad performance and get AI-powered recommendations to improve results.']
];

function Features() {
  return (
    <Container maxW="1180px" py={4}>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={5}>
        {features.map(([I, title, desc]) => (
          <Card key={title} borderRadius="2xl">
            <CardBody p={6}>
              <Box
                w="48px" h="48px"
                borderRadius="2xl"
                bg="rsViolet.50"
                color="rsViolet.500"
                display="grid" placeItems="center"
                mb={4}
              >
                <Icon as={I} />
              </Box>
              <Text fontWeight="800" color="brand.ink" mb={2}>{title}</Text>
              <Text fontSize="sm" color="brand.muted" lineHeight="1.7">{desc}</Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────

function FinalCTA({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Container maxW="1180px" pt={8} pb={12}>
      <Box position="relative" overflow="hidden" borderRadius="3xl" p={{ base: 7, md: 10 }} bg="brand.ink" color="white" boxShadow="brand">
        <Box
          position="absolute" right="-80px" top="-80px"
          w="360px" h="360px"
          bg={RS_GRADIENT}
          filter="blur(28px)" opacity={0.65}
          borderRadius="full"
        />
        <Flex
          position="relative"
          align={{ base: 'start', md: 'center' }}
          justify="space-between"
          direction={{ base: 'column', md: 'row' }}
          gap={6}
        >
          <Box maxW="600px">
            <Heading size="lg" lineHeight="1.1">
              Ready to transform your content into high-converting ads?
            </Heading>
            <Text color="whiteAlpha.800" mt={3}>
              Join thousands of brands already growing with UGC.
            </Text>
          </Box>
          <HStack spacing={4} wrap="wrap">
            <Button variant="brand" rightIcon={<Icon as={ArrowRight} />} h="52px" px={7} onClick={onSignIn}>
              Generate Your First Ads
            </Button>
            <Button variant="outline" color="white" borderColor="whiteAlpha.500" h="52px" px={7} _hover={{ bg: 'whiteAlpha.200' }}>
              Schedule a Demo
            </Button>
          </HStack>
        </Flex>
      </Box>
    </Container>
  );
}

// ── Page composition ─────────────────────────────────────────────

export function LandingPage() {
  const auth = useAuth();
  return (
    <Box bg="linear-gradient(180deg,#FFFFFF 0%, #F8FAFC 45%, #FFFFFF 100%)" minH="100vh">
      <TopNav onSignIn={auth.signIn} />
      <Hero onSignIn={auth.signIn} />
      <HowItWorks />
      <AdsGallery />
      <Testimonials />
      <Integrations />
      <Features />
      <FinalCTA onSignIn={auth.signIn} />
    </Box>
  );
}
