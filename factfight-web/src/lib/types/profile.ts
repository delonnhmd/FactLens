export interface PublicClaimAuthor {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
}
