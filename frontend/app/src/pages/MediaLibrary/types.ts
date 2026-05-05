// Phase A-1 — types shared across the Media Library page.
//
// These mirror the server response shapes from:
//   GET /api/media                      (list)
//   GET /api/media/:mediaId/detect      (detail — assembleResult shape)
//
// Kept loose (Mixed-style) where the backend itself stores Mixed, so the
// types document intent rather than rigidly constraining the dynamic
// pipeline output. UI code defends with optional chaining.

export type MatchLevel = 'high' | 'medium' | 'low' | 'none';

export type DetectOutcome =
  | 'own_product'
  | 'competitor'
  | 'mixed'
  | 'category'
  | 'no_products'
  | null;

export type MediaListRow = {
  mediaId:         string;
  source:          'instagram' | 'tiktok' | 'meta' | 'manual_upload' | 'youtube' | 'other';
  externalId:      string;
  fileType:        'image' | 'video';
  fileUrl:         string;
  fileName?:       string | null;
  width:           number | null;
  height:          number | null;
  brand:           string | null;
  caption:         string | null;
  permalink:       string | null;
  postedAt:        string | null;
  creatorHandle:   string | null;
  postType:        string | null;
  rightsApproved:  boolean;
  ready:           boolean;
  createdAt:       string;
  primarySubjectLabel: string | null;
  matchLevel:      MatchLevel;
  detectOutcome:   DetectOutcome;
  adReadiness:     number | null;
};

export type MediaListResponse = {
  media:   MediaListRow[];
  total:   number;
  limit:   number;
  offset:  number;
  hasMore: boolean;
};

// Bbox shapes — server stores normalized [0,1] for subjects + text and
// pixel-based for YOLO detections. Refined products carry source-image
// pixel coords. The Canvas component normalizes everything to [0,1] for
// rendering against the displayed image.
export type Bbox     = { x1: number; y1: number; x2: number; y2: number };

export type Subject = Bbox & {
  id:          string;
  role:        'primary' | 'secondary' | 'background';
  description: string;
};

export type TextRegion = Bbox & {
  id:         string;
  content:    string;
  type:       'product_label' | 'brand' | 'serial' | 'warning' | 'general' | string;
  confidence: number;
};

export type RefinedProduct = Bbox & {
  id:                string;
  sourceDetectionId: string;
  label:             string;
  category:          string | null;
  brand:             string | null;
  categoryLabel?:    string | null;
  agreement?:        string | null;
  confidence:        number;
  croppedImageUrl:   string | null;
};

export type YoloProduct = {
  id:          string;
  className:   string;
  confidence:  number;
  x1: number; y1: number; x2: number; y2: number;
  imgWidth:   number;
  imgHeight:  number;
  identification?: {
    label:       string;
    description: string;
    brand:       string | null;
    category:    string | null;
    confidence:  number;
  };
};

export type Restriction = {
  id:             string;
  rectPct:        Bbox;            // already normalized
  classification: 'product' | 'face' | 'secondary_subject' | 'text' | 'object' | 'other';
  strictness:     number;           // 0..1
  reason:         string;
};

export type DensityGrid = {
  cols:  number;
  rows:  number;
  cells: number[][];                // values 0..1
};

export type OverlayZoneAnalysis = {
  schemaVersion?:        string;
  imageWidth?:           number | null;
  imageHeight?:          number | null;
  densityGrid?:          DensityGrid;
  brightnessGrid?:       DensityGrid;
  restrictions?:         Restriction[];
  primarySubjectRectPct?: Bbox | null;
};

export type OverlayZoneVariant = {
  provider:     string | null;
  variant:      string;
  candidateId:  string;
  imageUrl:     string | null;
  analysis:     OverlayZoneAnalysis | null;
};

export type DetectMatch = {
  refinedProductId?: string | null;
  productIndex?:     string | null;
  outcome:           'product_match' | 'product_category' | 'brand_match' | 'no_products' | null;
  winner:            string | null;
  matchSource?:      string | null;
  identification?: {
    productName?:    string | null;
    brand?:          string | null;
    certainty?:      number;
    certaintyLabel?: string;
    reasoning?:      string;
  } | null;
  catalog?: {
    title?:        string;
    imageUrl?:     string | null;
    productUrl?:   string | null;
    category?:     string;
    price?:        number | null;
    currency?:     string | null;
  } | null;
  categoryDoc?: {
    breadcrumb?: string;
    url?:        string | null;
  } | null;
  catalogVisualScore?:   number | null;
  catalogCombinedScore?: number | null;
  brandCategory?: { breadcrumb?: string; url?: string } | null;
  enrichmentTiers?: string[];
};

export type DetectResult = {
  type:    'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  width:   number;
  height:  number;
  rights?: { approved: boolean };
  heroFrameSec?:     number | null;
  heroReason?:       string | null;
  videoDurationSec?: number | null;
  products?:         YoloProduct[];
  refinedProducts?:  RefinedProduct[];
  subjects?:         Subject[];
  text?:             TextRegion[];
  background?:       Record<string, unknown> | null;
  primarySubjectDesc?: string | null;
  safeRect?:         Bbox | null;
  crops?:            Record<string, unknown[]>;
  judge?:            unknown;
  extendedCrops?:    Record<string, unknown[]>;
  productMatchesAll?: DetectMatch[];
  mediaClassification?: { detectSummary?: { outcome?: DetectOutcome } } | null;
  overlayZones?:     Record<string, OverlayZoneVariant[]>;
  mediaSource?:      Record<string, unknown>;
};

export type DetectDetailResponse = {
  runId:   string;
  mediaId: string;
  status:  'pending' | 'running' | 'completed' | 'failed';
  stage:   string | null;
  result:  DetectResult | null;
  error?:  string | null;
};

// Layer keys for the FilterChips toggle
export type LayerKey = 'products' | 'people' | 'text' | 'safe-zones' | 'density' | 'crops' | 'palette';

export const ALL_LAYER_KEYS: LayerKey[] = ['products', 'people', 'text', 'safe-zones', 'density', 'crops', 'palette'];

export const LAYER_LABELS: Record<LayerKey, string> = {
  products:     'Products',
  people:       'People',
  text:         'Text (OCR)',
  'safe-zones': 'Safe Zones',
  density:      'Density',
  crops:        'Crops',
  palette:      'Palette'
};

export const ASPECT_RATIOS = ['original', '1:1', '4:5', '9:16', '1.91:1', '16:9'] as const;
export type AspectRatioKey = (typeof ASPECT_RATIOS)[number];

export const ASPECT_RATIO_LABELS: Record<AspectRatioKey, string> = {
  original: 'Original',
  '1:1':    '1:1 Square',
  '4:5':    '4:5 Portrait',
  '9:16':   '9:16 Story',
  '1.91:1': '1.91:1 Landscape',
  '16:9':   '16:9 Landscape'
};
