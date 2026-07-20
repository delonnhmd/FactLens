import "server-only";

import { z } from "zod";

import { requestRenderJson } from "@/lib/api/render-client";
import { claimStatusValues } from "@/lib/types/claim";
import type { VoteHistoryItem } from "@/lib/types/vote-history";
import { voteTypes } from "@/lib/validation/claim-actions";

const voteHistoryItemSchema = z.looseObject({
  claim_id: z.uuid(),
  claim_title: z.string().trim().min(1).max(200),
  vote_type: z.enum(voteTypes),
  claim_status: z.enum(claimStatusValues).nullable().optional().default(null),
  result: z.enum(["MATCHED", "DID_NOT_MATCH", "PENDING"]),
  voted_at: z.preprocess(
    (value) =>
      typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null,
    z.string().nullable(),
  ),
});
const voteHistoryResponseSchema = z.looseObject({
  ok: z.literal(true),
  votes: z.array(voteHistoryItemSchema).max(100),
});

export class VoteHistoryReadError extends Error {
  constructor() {
    super("Your voting history is temporarily unavailable. Please try again.");
    this.name = "VoteHistoryReadError";
  }
}

export async function getVoteHistory(accessToken: string): Promise<readonly VoteHistoryItem[]> {
  try {
    const payload = await requestRenderJson("/profiles/me/votes", accessToken, { method: "GET" });
    const parsed = voteHistoryResponseSchema.parse(payload);
    return Object.freeze(
      parsed.votes.map((vote) =>
        Object.freeze({
          claimId: vote.claim_id,
          claimTitle: vote.claim_title,
          claimStatus: vote.claim_status,
          voteType: vote.vote_type,
          votedAt: vote.voted_at,
          result: vote.result,
        }),
      ),
    );
  } catch {
    throw new VoteHistoryReadError();
  }
}
