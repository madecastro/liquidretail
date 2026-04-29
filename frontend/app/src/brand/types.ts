// Shapes mirror what /api/brand returns.

export type BrandSummary = {
  id:             string;
  name:           string;
  slug:           string;
  logoUrl:        string | null;
  websiteUrl:     string | null;
  primaryColor:   string | null;
  source:         string;
  enrichmentSources: string[];
  curatedFields:  string[];
  createdAt:      string;
};
