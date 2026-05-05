// Phase 4 follow-up #3 — Catalog Browser types.
// Mirror the /api/catalog response shapes exactly so the UI stays
// loose where the schema is loose (specs, productReviews, etc.).

export type CatalogSource = 'ig-catalog' | 'manual-upload' | 'detect-identified' | string;

export type CatalogListRow = {
  id:           string;
  externalId:   string;
  source:       CatalogSource;
  draft:        boolean;
  title:        string;
  brand:        string | null;
  category:     string | null;
  price:        number | null;
  currency:     string | null;
  availability: string | null;
  imageUrl:     string | null;
  productUrl:   string | null;
  rating:       number | null;
  reviewCount:  number | null;
  matchCount:   number;
  gtin:         string | null;
  mpn:          string | null;
  detectedFromMediaId: string | null;
  firstSeenAt?: string;
  lastSyncedAt?: string;
};

export type CatalogListResponse = {
  products:    CatalogListRow[];
  total:       number;
  limit:       number;
  offset:      number;
  hasMore:     boolean;
  categories:  string[];
  totalDrafts: number;
};

export type CatalogReviewQuote = {
  text:    string;
  author?: string | null;
  source?: string | null;
};

export type CatalogReviewBlock = {
  quotes?:      CatalogReviewQuote[];
  rating?:      number | null;
  reviewCount?: number | null;
  summary?:     string | null;
  sources?:     string[];
  fetchedAt?:   string;
} | null;

export type CatalogReviewRow = {
  rating?:    number;
  title?:     string;
  text?:      string;
  author?:    string;
  date?:      string;
  source?:    string;
  // Immersive shape varies; preserve unknown keys
  [k: string]: unknown;
};

export type CatalogSeller = {
  name?:    string;
  link?:    string;
  price?:   string;
  shipping?: string;
  total?:   string;
  thumbnail?: string;
  // Preserve unknown keys
  [k: string]: unknown;
};

export type CatalogDetail = {
  id:           string;
  externalId:   string;
  retailerId:   string | null;
  source:       CatalogSource;
  draft:        boolean;
  title:        string;
  description:  string | null;
  brand:        string | null;
  category:     string | null;
  categoryRef:  string | null;
  categoryBreadcrumb: string | null;
  categoryUrl:  string | null;
  price:        number | null;
  currency:     string | null;
  availability: string | null;
  imageUrl:     string | null;
  additionalImages: string[];
  productUrl:   string | null;
  gtin:         string | null;
  mpn:          string | null;

  rating:              number | null;
  ratingDistribution:  Array<Record<string, unknown>>;
  reviews:             CatalogReviewRow[];
  specs:               Record<string, unknown> | null;
  sellers:             CatalogSeller[];
  reviewSummary:       Record<string, unknown> | null;
  productReviews:      CatalogReviewBlock;
  detailsRefreshedAt:  string | null;

  detectedFromMediaId: string | null;
  firstSeenAt?: string;
  lastSyncedAt?: string;
};

export type PlatformStats = {
  views?:      number | null;
  likes?:      number | null;
  comments?:   number | null;
  shares?:     number | null;
  saves?:      number | null;
  reach?:      number | null;
  engagement?: number | null;
  fetchedAt?:  string | null;
};

export type SourceMediaRef = {
  id:             string;
  externalId:     string;
  fileType:       'image' | 'video';
  fileUrl:        string;
  fileName?:      string;
  source:         string;
  permalink:      string | null;
  createdAt:      string;
  platformStats?: PlatformStats | null;
} | null;

export type CatalogDetailResponse = {
  product:     CatalogDetail;
  sourceMedia: SourceMediaRef;
};

export type CatalogMatchRow = {
  mediaId:               string;
  runArtifactId:         string;
  productIndex:          string | null;
  outcome:               string | null;
  winner:                string | null;
  confidence:            number | null;
  catalogCombinedScore:  number | null;
  catalogVisualScore:    number | null;
  croppedImageUrl:       string | null;
  cropLabel:             string | null;
  cropBbox:              { x1: number; y1: number; x2: number; y2: number } | null;
  media: {
    externalId:   string;
    fileType:     'image' | 'video';
    fileUrl:      string;
    fileName?:    string;
    source:       string;
    permalink:    string | null;
    creatorHandle: string | null;
    postedAt:     string | null;
    likes:        number | null;
    comments:     number | null;
    detectOutcome: string | null;
    createdAt:    string;
  };
  artifactCreatedAt: string;
};

export type CatalogMatchesResponse = {
  productId: string;
  total:    number;
  matches:  CatalogMatchRow[];
};
