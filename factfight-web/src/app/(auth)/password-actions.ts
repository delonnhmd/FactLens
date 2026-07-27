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

export async function resendConfirmationAction(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      message: "Enter a valid email address.",
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${publicEnvironment.siteUrl}/auth/callback?onboarding=1`,
    },
  });

  if (error) {
    console.error("Supabase confirmation resend failed", {
      code: error.code ?? "unknown",
      category:
        error.status === 500
          ? "supabase_auth_service_failure"
          : "supabase_auth_request_failure",
      status: error.status ?? null,
    });
    return {
      message: "Confirmation email service is temporarily unavailable. Please try again later.",
      success: false,
    };
  }

  // The same response is returned whether or not the address has a pending account.
  return {
    message:
      "If a pending account exists for that email, a new confirmation link is on its way.",
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
