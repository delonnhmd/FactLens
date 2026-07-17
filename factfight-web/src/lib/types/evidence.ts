export const evidenceTypeValues = [
  "SUPPORTS_TRUE",
  "SUPPORTS_FAKE",
  "ADDS_CONTEXT",
  "UNCLEAR",
] as const;

export type EvidenceType = (typeof evidenceTypeValues)[number];

export interface PublicEvidence {
  readonly id: string;
  readonly contributorId: string | null;
  readonly contributorName: string;
  readonly type: EvidenceType;
  readonly url: string | null;
  readonly note: string;
  readonly imageUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly sourceQualityLabel: string | null;
  readonly sourceQualityScore: number | null;
  readonly sourceQualityReason: string | null;
  readonly createdAt: string | null;
}
