"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteOwnClaim, voteOnClaim } from "@/lib/api/claim-mutations";
import {
  getVerifiedSession,
  refreshVerifiedSession,
} from "@/lib/auth/verified-session";
import { createClient } from "@/lib/supabase/server";
import { removeUserImage, uploadUserImage, validateOptionalUserImage } from "@/lib/storage/user-images";
import {
  addEvidenceSchema,
  deleteClaimSchema,
  reportClaimSchema,
  savedClaimSchema,
  voteClaimSchema,
} from "@/lib/validation/claim-actions";

export type VoteActionState = {
  message: string;
  success: boolean;
  loginRequired?: boolean;
};

export type ParticipationActionState = {
  message: string;
  success: boolean;
  loginRequired?: boolean;
};

export type SavedClaimActionState = ParticipationActionState & {
  saved?: boolean;
};

function refreshClaimPages(claimId: string, pathIdentifier: string) {
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/claim/${claimId}`);
  revalidatePath(`/claim/${pathIdentifier}`);
}

export async function voteClaimAction(
  _previousState: VoteActionState,
  formData: FormData,
): Promise<VoteActionState> {
  const parsed = voteClaimSchema.safeParse({
    claimId: formData.get("claimId"),
    pathIdentifier: formData.get("pathIdentifier"),
    voteType: formData.get("voteType"),
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Choose a vote.", success: false };
  }

  const session = await getVerifiedSession();
  if (!session.ok) {
    return { message: "Log in to vote on this claim.", success: false, loginRequired: true };
  }

  let result = await voteOnClaim(
    session.accessToken,
    parsed.data.claimId,
    parsed.data.voteType,
  );

  if (!result.ok && result.status === 401) {
    const refreshedSession = await refreshVerifiedSession();

    if (refreshedSession.ok) {
      result = await voteOnClaim(
        refreshedSession.accessToken,
        parsed.data.claimId,
        parsed.data.voteType,
      );
    }

    if (!refreshedSession.ok || (!result.ok && result.status === 401)) {
      return {
        message: "Your session could not be verified. Please sign in again.",
        success: false,
        loginRequired: true,
      };
    }
  }

  if (!result.ok) {
    return { message: result.message, success: false };
  }

  refreshClaimPages(parsed.data.claimId, parsed.data.pathIdentifier);

  return { message: "Your vote was recorded.", success: true };
}

export async function addEvidenceAction(
  _previousState: ParticipationActionState,
  formData: FormData,
): Promise<ParticipationActionState> {
  const parsed = addEvidenceSchema.safeParse({
    claimId: formData.get("claimId"),
    pathIdentifier: formData.get("pathIdentifier"),
    evidenceType: formData.get("evidenceType"),
    url: formData.get("url"),
    note: formData.get("note"),
  });
  const image = validateOptionalUserImage(formData.get("evidenceImage"));

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check the evidence fields.", success: false };
  }
  if (!image.ok) return { message: image.message, success: false };

  const session = await getVerifiedSession();
  if (!session.ok) {
    return { message: "Log in to add evidence.", success: false, loginRequired: true };
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,is_suspended,is_deleted")
    .eq("id", session.userId)
    .maybeSingle();

  if (profileError || !profile || profile.is_deleted) {
    return { message: "An active profile is required to add evidence.", success: false };
  }
  if (profile.is_suspended) {
    return { message: "This account is suspended from adding evidence.", success: false };
  }

  const sanitizedNote = parsed.data.note.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  const { data: insertedEvidence, error } = await supabase
    .from("evidence")
    .insert({
      claim_id: parsed.data.claimId,
      user_id: session.userId,
      evidence_type: parsed.data.evidenceType,
      url: parsed.data.url,
      note: sanitizedNote,
      source_quality_label: null,
      source_quality_score: null,
      source_quality_reason: null,
    })
    .select("id")
    .single();

  if (error) {
    return { message: "Could not save evidence right now. Check the source URL and try again.", success: false };
  }

  if (image.file) {
    const evidenceId = typeof insertedEvidence?.id === "string" ? insertedEvidence.id : "";
    const uploadedImage = evidenceId
      ? await uploadUserImage("evidence-images", session.userId, evidenceId, image.file)
      : null;

    if (!uploadedImage) {
      if (evidenceId) {
        await supabase.from("evidence").delete().eq("id", evidenceId).eq("user_id", session.userId);
      }
      return {
        message: "Could not upload this evidence image. Try another image or add evidence without it.",
        success: false,
      };
    }

    const { error: imageUpdateError } = await supabase
      .from("evidence")
      .update({
        image_url: uploadedImage.publicUrl,
        image_path: uploadedImage.path,
        thumbnail_url: uploadedImage.publicUrl,
      })
      .eq("id", evidenceId)
      .eq("user_id", session.userId);

    if (imageUpdateError) {
      await removeUserImage("evidence-images", uploadedImage.path);
      await supabase.from("evidence").delete().eq("id", evidenceId).eq("user_id", session.userId);
      return { message: "Could not attach this image to the evidence.", success: false };
    }
  }

  await supabase.rpc("recalculate_claim_evidence_count", { target_claim_id: parsed.data.claimId });
  refreshClaimPages(parsed.data.claimId, parsed.data.pathIdentifier);
  return { message: "Evidence added to this claim.", success: true };
}

export async function reportClaimAction(
  _previousState: ParticipationActionState,
  formData: FormData,
): Promise<ParticipationActionState> {
  const parsed = reportClaimSchema.safeParse({
    claimId: formData.get("claimId"),
    pathIdentifier: formData.get("pathIdentifier"),
    reason: formData.get("reason"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check the report fields.", success: false };
  }

  const session = await getVerifiedSession();
  if (!session.ok) {
    return { message: "Log in to report this claim.", success: false, loginRequired: true };
  }

  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("reports")
    .select("id")
    .eq("target_type", "CLAIM")
    .eq("claim_id", parsed.data.claimId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (lookupError) {
    return { message: "Could not submit this report right now.", success: false };
  }

  if (!existing) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
    const { count, error: countError } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .gte("created_at", since);

    if (countError) return { message: "Could not submit this report right now.", success: false };
    if ((count ?? 0) >= 20) {
      return { message: "Too many reports today. Please try again later.", success: false };
    }
  }

  const reportRow = {
    target_type: "CLAIM",
    claim_id: parsed.data.claimId,
    evidence_id: null,
    profile_id: null,
    reason: parsed.data.reason,
    note: parsed.data.note || null,
    status: "OPEN",
  };
  const request = existing
    ? supabase.from("reports").update(reportRow).eq("id", existing.id)
    : supabase.from("reports").insert({ user_id: session.userId, ...reportRow });
  const { error } = await request;

  if (error) {
    return { message: "Could not submit this report right now.", success: false };
  }

  await supabase.rpc("recalculate_claim_report_count", { target_claim_id: parsed.data.claimId });
  return { message: existing ? "Your report was updated." : "Report submitted for moderator review.", success: true };
}

export async function toggleSavedClaimAction(
  _previousState: SavedClaimActionState,
  formData: FormData,
): Promise<SavedClaimActionState> {
  const parsed = savedClaimSchema.safeParse({
    claimId: formData.get("claimId"),
    pathIdentifier: formData.get("pathIdentifier"),
  });

  if (!parsed.success) {
    return { message: "Claim not found.", success: false };
  }

  const session = await getVerifiedSession();
  if (!session.ok) {
    return { message: "Log in to save claims.", success: false, loginRequired: true };
  }

  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("saved_claims")
    .select("claim_id")
    .eq("user_id", session.userId)
    .eq("claim_id", parsed.data.claimId)
    .maybeSingle();

  if (lookupError) return { message: "Could not update saved claims right now.", success: false };

  const { error } = existing
    ? await supabase.from("saved_claims").delete().eq("user_id", session.userId).eq("claim_id", parsed.data.claimId)
    : await supabase.from("saved_claims").insert({ user_id: session.userId, claim_id: parsed.data.claimId });

  if (error) return { message: "Could not update saved claims right now.", success: false };

  revalidatePath("/profile/saved");
  return {
    message: existing ? "Claim removed from saved items." : "Claim saved for later.",
    success: true,
    saved: !existing,
  };
}

export async function deleteClaimAction(
  _previousState: ParticipationActionState,
  formData: FormData,
): Promise<ParticipationActionState> {
  const parsed = deleteClaimSchema.safeParse({
    claimId: formData.get("claimId"),
    pathIdentifier: formData.get("pathIdentifier"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Confirm claim removal.",
      success: false,
    };
  }

  const session = await getVerifiedSession();
  if (!session.ok) return { message: session.message, success: false };
  const result = await deleteOwnClaim(session.accessToken, parsed.data.claimId);
  if (!result.ok) return { message: result.message, success: false };

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/profile/claims");
  redirect("/feed");
}
