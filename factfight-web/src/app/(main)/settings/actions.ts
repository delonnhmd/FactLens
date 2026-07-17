"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { deleteAccount, updateProfile } from "@/lib/api/profile-mutations";
import { getVerifiedSession } from "@/lib/auth/verified-session";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema, profileSettingsSchema } from "@/lib/validation/settings";

export type SettingsActionState = {
  message: string;
  success: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function updateProfileAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = profileSettingsSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    profileVisibility: formData.get("profileVisibility"),
  });
  if (!parsed.success) {
    return { message: "Check the highlighted fields.", success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const session = await getVerifiedSession();
  if (!session.ok) return { message: session.message, success: false };
  const result = await updateProfile(session.accessToken, parsed.data);
  if (!result.ok) return { message: result.message, success: false };

  revalidatePath("/profile");
  return { message: "Profile updated.", success: true };
}

export async function changePasswordAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { message: "Check the highlighted fields.", success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const session = await getVerifiedSession();
  if (!session.ok) return { message: session.message, success: false };

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (userError || !email || userData.user?.id !== session.userId) {
    return { message: "Your account could not be verified. Log in again.", success: false };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return { message: "Current password is incorrect.", success: false, fieldErrors: { currentPassword: ["Current password is incorrect."] } };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (updateError) {
    return { message: updateError.message, success: false };
  }

  return { message: "Password updated.", success: true };
}

export async function deleteAccountAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = z.literal("DELETE", { error: "Type DELETE to confirm account deletion." }).safeParse(formData.get("confirmation"));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Type DELETE to confirm.", success: false };
  const session = await getVerifiedSession();
  if (!session.ok) return { message: session.message, success: false };
  const result = await deleteAccount(session.accessToken);
  if (!result.ok) return { message: result.message, success: false };
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?status=account_deleted");
}
