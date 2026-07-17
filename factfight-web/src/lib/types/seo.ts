export interface ClaimSeoMetadata {
  readonly claimId: string;
  readonly slug: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly keywords: readonly string[];
  readonly openGraphTitle: string;
  readonly openGraphDescription: string;
  readonly version: "creation" | "finalization";
  readonly generatedAt: string | null;
}

export interface SitemapClaimEntry {
  readonly id: string;
  readonly slug: string | null;
  readonly updatedAt: string | null;
}
