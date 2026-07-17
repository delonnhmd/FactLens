import type { PublicClaim } from "./claim";

export interface FeedClaimsPage {
  readonly claims: readonly PublicClaim[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}
