import type { ClaimStatus, ClaimVoteCounts } from "@/lib/types/claim";
import type { EvidenceType } from "@/lib/types/evidence";

export type PublicProfileTab = "posts" | "replies" | "evidence" | "about";

export interface PublicProfilePost {
  readonly id: string;
  readonly title: string;
  readonly descriptionPreview: string;
  readonly imageUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly category: string | null;
  readonly status: ClaimStatus | null;
  readonly finalVerdict: "TRUE" | "FAKE" | "NEEDS_MORE_EVIDENCE" | null;
  readonly votes: ClaimVoteCounts;
  readonly createdAt: string | null;
}

export interface PublicProfileReply {
  readonly id: string;
  readonly text: string;
  readonly claimId: string;
  readonly claimTitle: string;
  readonly createdAt: string | null;
  readonly replyCount: number;
  readonly helpfulCount: number;
  readonly anchor: string;
}

export interface PublicProfileEvidence {
  readonly id: string;
  readonly type: EvidenceType;
  readonly note: string;
  readonly sourceUrl: string | null;
  readonly sourceDomain: string | null;
  readonly imageUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly claimId: string;
  readonly claimTitle: string;
  readonly helpfulCount: number;
  readonly createdAt: string | null;
}
