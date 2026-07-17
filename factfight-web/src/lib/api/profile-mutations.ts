import "server-only";

import { z } from "zod";

import { RenderApiError, requestRenderJson } from "@/lib/api/render-client";

const profileUpdateResponseSchema = z.looseObject({ ok: z.literal(true), profile: z.unknown() });
const accountDeleteResponseSchema = z.looseObject({ ok: z.literal(true), mode: z.literal("anonymized") });

export async function updateProfile(
  accessToken: string,
  input: { readonly displayName: string; readonly bio: string; readonly profileVisibility: "public" | "private" },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const payload = await requestRenderJson("/profile", accessToken, {
      method: "PATCH",
      body: JSON.stringify({
        display_name: input.displayName,
        bio: input.bio,
        profile_visibility: input.profileVisibility,
      }),
    });

    if (!profileUpdateResponseSchema.safeParse(payload).success) {
      return { ok: false, message: "Could not verify the updated profile." };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof RenderApiError) {
      if (error.status === 401) return { ok: false, message: "Your session expired. Log in again." };
      if (error.status === 400 || error.status === 409) return { ok: false, message: error.message };
    }
    return { ok: false, message: "Could not update your profile right now." };
  }
}

export async function deleteAccount(accessToken: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const payload = await requestRenderJson("/account", accessToken, { method: "DELETE" });
    if (!accountDeleteResponseSchema.safeParse(payload).success) {
      return { ok: false, message: "The account deletion response could not be verified." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not delete your account right now." };
  }
}
