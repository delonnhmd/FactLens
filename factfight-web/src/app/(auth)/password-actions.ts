"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { passwordResetRequestSchema, recoveryPasswordSchema } from "@/lib/validation/auth";
import { publicEnvironment } from "@/lib/validation/env";

export type PasswordActionState = {
  message: string;
  success: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function requestPasswordResetAction(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { message: "Enter a valid email address.", success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnvironment.siteUrl}/auth/callback?next=/reset-password`,
  });

  // The same response is returned whether or not the address exists.
  return {
    message: "If an account exists for that email, a password reset link is on its way.",
    success: true,
  };
}

export async function completePasswordResetAction(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const parsed = recoveryPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { message: "Check the highlighted fields.", success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims?.sub) {
    return { message: "This reset session is invalid or expired. Request a new link.", success: false };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: error.message, success: false };
  await supabase.auth.signOut();
  redirect("/login?status=password_updated");
}
