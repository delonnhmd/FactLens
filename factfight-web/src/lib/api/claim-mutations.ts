import "server-only";

import { z } from "zod";

import { RenderApiError, requestRenderJson } from "@/lib/api/render-client";
import type { CreateClaimInput, VoteType } from "@/lib/validation/claim-actions";

const createdClaimSchema = z.looseObject({ id: z.uuid() });
const voteResponseSchema = z.looseObject({ ok: z.literal(true) });
const deleteResponseSchema = z.looseObject({ ok: z.literal(true) });

export type ClaimMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function friendlyCreateError(error: unknown): string {
  if (!(error instanceof RenderApiError)) {
    return "Could not create your claim right now. Please try again.";
  }

  if (error.status === 401) return "Your session expired. Log in and try again.";
  if (error.status === 403) return "Your account cannot post claims right now.";
  if (error.status === 429) return "You reached today's claim limit. Please try again later.";
  if (error.code === "UNSAFE_CLAIM_TEXT") {
    return "This content violates our community guidelines. Rewrite it before posting.";
  }
  if (error.status === 400 || error.status === 422) {
    return error.message || "Check the claim fields and try again.";
  }

  return "Could not create your claim right now. Please try again.";
}

function friendlyVoteError(error: unknown): string {
  if (!(error instanceof RenderApiError)) {
    return "Could not save your vote right now. Please try again.";
  }

  if (error.status === 401) return "Log in to vote.";
  if (error.status === 403) return "Your account cannot vote right now.";
  if (error.status === 404) return "This claim is no longer available.";
  if (error.status === 409 && error.alreadyVoted) return "You already voted on this claim.";
  if (error.status === 409) return "Voting is closed for this claim.";
  if (error.status === 422) return "Choose True, Fake, or Unsure.";

  return "Could not save your vote right now. Please try again.";
}

export async function createClaim(
  accessToken: string,
  input: CreateClaimInput,
  media?: { readonly imageUrl: string; readonly imagePath: string; readonly thumbnailUrl: string },
): Promise<ClaimMutationResult<{ id: string }>> {
  try {
    const payload = await requestRenderJson("/api/claims", accessToken, {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        source_url: input.sourceUrl,
        video_url: input.videoUrl ?? null,
        category: input.category,
        sub_category: input.category === "Politics" ? input.subCategory ?? null : null,
        politician_tag:
          input.category === "Politics" && input.subCategory === "Politician"
            ? input.politicianTag ?? null
            : null,
        image_url: media?.imageUrl ?? null,
        image_path: media?.imagePath ?? null,
        thumbnail_url: media?.thumbnailUrl ?? null,
      }),
    });
    const parsed = createdClaimSchema.safeParse(payload);

    if (!parsed.success) {
      return { ok: false, message: "Your claim was submitted, but its page could not be opened." };
    }

    return { ok: true, data: { id: parsed.data.id } };
  } catch (error) {
    return { ok: false, message: friendlyCreateError(error) };
  }
}

export async function voteOnClaim(
  accessToken: string,
  claimId: string,
  voteType: VoteType,
): Promise<ClaimMutationResult<null>> {
  try {
    const payload = await requestRenderJson(`/api/claims/${claimId}/vote`, accessToken, {
      method: "POST",
      body: JSON.stringify({ vote_type: voteType }),
    });

    if (!voteResponseSchema.safeParse(payload).success) {
      return { ok: false, message: "Your vote response could not be verified. Refresh the claim before trying again." };
    }

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, message: friendlyVoteError(error) };
  }
}

export async function deleteOwnClaim(
  accessToken: string,
  claimId: string,
): Promise<ClaimMutationResult<null>> {
  try {
    const payload = await requestRenderJson(`/api/claims/${claimId}`, accessToken, {
      method: "DELETE",
    });
    if (!deleteResponseSchema.safeParse(payload).success) {
      return { ok: false, message: "The claim removal response could not be verified." };
    }
    return { ok: true, data: null };
  } catch (error) {
    if (error instanceof RenderApiError) {
      if (error.status === 401) return { ok: false, message: "Log in again to remove this claim." };
      if (error.status === 403) {
        return { ok: false, message: error.message || "This claim is permanent and cannot be removed." };
      }
      if (error.status === 404) return { ok: false, message: "This claim is no longer available." };
    }
    return { ok: false, message: "Could not remove this claim right now." };
  }
}
