"use server";

import { redirect } from "next/navigation";

import {
  acceptTerms,
  checkUsernameAvailability,
  ensureProfile,
} from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnvironment } from "@/lib/validation/env";
import { loginSchema, signupSchema } from "@/lib/validation/auth";

export type AuthActionState = {
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function validationState(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): AuthActionState {
  return {
    message: "Check the highlighted fields and try again.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function friendlySignInError(): AuthActionState {
  return {
    message: "We could not sign you in. Check your email and password and try again.",
  };
}

function friendlySignUpError(code?: string): AuthActionState {
  if (code === "user_already_exists" || code === "email_exists") {
    return { message: "An account with this email may already exist. Try logging in." };
  }

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return { message: "Too many attempts. Please wait a moment and try again." };
  }

  if (code === "weak_password") {
    return { message: "Choose a stronger password and try again." };
  }

  return { message: "We could not create your account right now. Please try again." };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.session?.access_token) {
    return friendlySignInError();
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    await supabase.auth.signOut();
    return friendlySignInError();
  }

  const profileResult = await ensureProfile(data.session.access_token, {
    username: "",
    displayName: "",
  });

  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return { message: profileResult.message };
  }

  redirect("/feed");
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    termsAccepted: formData.get("termsAccepted"),
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  const availability = await checkUsernameAvailability(parsed.data.username);

  if (!availability.ok) {
    return { message: availability.message };
  }

  if (!availability.available || availability.reserved) {
    return {
      message: availability.message ?? "This username is not available.",
      fieldErrors: {
        username: [availability.message ?? "This username is not available."],
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnvironment.siteUrl}/auth/callback`,
      data: {
        username: parsed.data.username,
        displayName: parsed.data.displayName,
      },
    },
  });

  if (error) {
    return friendlySignUpError(error.code);
  }

  if (!data.session?.access_token) {
    redirect("/confirmed");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    await supabase.auth.signOut();
    return { message: "Your account was created, but sign-in could not be verified." };
  }

  const profileResult = await ensureProfile(data.session.access_token, {
    username: parsed.data.username,
    displayName: parsed.data.displayName,
  });

  if (!profileResult.ok) {
    await supabase.auth.signOut();
    return { message: profileResult.message };
  }

  const termsResult = await acceptTerms(data.session.access_token);

  if (!termsResult.ok) {
    await supabase.auth.signOut();
    return { message: termsResult.message };
  }

  redirect("/feed");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
