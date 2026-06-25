// Phase 4a — Brand types matching the server's /api/brand/:id response.
// Most fields are optional in the legacy Brand model (stub brands have
// almost nothing); UI defends with optional chaining + sensible defaults.

export type BrandDemographic = {
  name?:        string;
  description?: string;
  interests?:   string[];
  painPoints?:  string[];
  toneHint?:    string;
  avatarUrl?:   string;
};

export type BrandReviewQuote = {
  text:    string;
  author?: string | null;
  source?: string | null;
};

export type BrandReviews = {
  quotes?:      BrandReviewQuote[];
  rating?:      number | null;
  reviewCount?: number | null;
  summary?:     string | null;
  source?:      string;
  fetchedAt?:   string;
};

export type Brand = {
  _id:               string;
  advertiserId?:     string;
  name:              string;
  nameNormalized?:   string;
  websiteUrl?:       string | null;
  tagline?:          string | null;
  summary?:          string | null;

  // Visual identity
  logoUrl?:          string | null;
  primaryColor?:     string | null;
  secondaryColor?:   string | null;
  accentColor?:      string | null;
  fontColor?:        string | null;
  fontFamily?:       string | null;
  fontSource?:       string | null;

  // Voice
  tone?:             string[];
  hashtags?:         string[];
  tags?:             string[];

  // Audience
  demographics?:     BrandDemographic[];

  // Derived voice — extracted from existing Meta/Google ad creatives
  // by brandVoiceDerivationService. Refreshed automatically on
  // campaign sync (debounced) plus a nightly sweep. Operator can
  // override via PATCH /api/brand/:id/voice.
  derivedVoice?: {
    tone?:           string[];
    value_props?:    string[];
    hooks?:          string[];
    cta_patterns?:   { text: string; frequency?: number }[];
    common_phrases?: string[];
    audience_pitch?: { segment: string; pitch_style: string }[];
    voice_summary?:  string;
    evidence_count?: number;
    weighted?:       boolean;
    model?:          string;
    promptVersion?:  string;
  } | null;
  derivedVoiceAt?: string | null;

  // Reviews + enrichment provenance
  brandReviews?:     BrandReviews | null;
  source?:           'stub' | 'enriched' | 'curated' | string;
  enrichmentSources?: string[];
  enrichmentStage?:  string | null;
  enrichedAt?:       string;
  curatedFields?:    string[];

  // Phase 4d — Brand Safety operator config
  brandSafety?: {
    riskScore?:     number | null;
    category?:      string | null;
    blockedTopics?: string[];
    adjustedAt?:    string | null;
    adjustedBy?:    string | null;
  } | null;

  // Settings
  syncSettings?: {
    autoSyncEnabled?:    boolean;
    dailyDetectRunCap?:  number;
    catalogCadenceHours?: number;
    postsCadenceHours?:  number;
    campaignCadenceHours?: number;
  };
  commentReply?: {
    enabled?:        boolean;
    template?:       string;
    dailyCap?:       number;
    perMediaCap?:    number;
    fallbackToCategory?: boolean;
    fallbackToBrand?:    boolean;
  };
  uploadSettings?: {
    autoCreateFromDetect?: boolean;
  };

  createdAt?:        string;
  updatedAt?:        string;
};
