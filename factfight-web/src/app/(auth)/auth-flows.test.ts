import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptTerms: vi.fn(),
  checkUsernameAvailability: vi.fn(),
  createClient: vi.fn(),
  ensureProfile: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/api/auth", () => ({
  acceptTerms: mocks.acceptTerms,
  checkUsernameAvailability: mocks.checkUsernameAvailability,
  ensureProfile: mocks.ensureProfile,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/validation/env", () => ({
  publicEnvironment: {
    siteUrl: "https://factfight.com",
  },
}));

import { loginAction, signupAction } from "@/app/(auth)/actions";
import {
  requestPasswordResetAction,
  resendConfirmationAction,
} from "@/app/(auth)/password-actions";

function signupForm() {
  const form = new FormData();
  form.set("username", "unique_user");
  form.set("displayName", "Unique User");
  form.set("email", "unique@example.test");
  form.set("password", "correct-horse");
  form.set("confirmPassword", "correct-horse");
  form.set("termsAccepted", "on");
  return form;
}

describe("authentication server actions", () => {
  const auth = {
    getClaims: vi.fn(),
    resend: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  };

  beforeEach(() => {
    Object.values(auth).forEach((mock) => mock.mockReset());
    mocks.createClient.mockResolvedValue({ auth });
    mocks.checkUsernameAvailability.mockResolvedValue({
      ok: true,
      available: true,
      reserved: false,
    });
    mocks.ensureProfile.mockResolvedValue({ ok: true });
    mocks.acceptTerms.mockResolvedValue({ ok: true });
  });

  it("starts a unique-email signup with the canonical callback", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await expect(signupAction({ message: "" }, signupForm())).rejects.toThrow(
      "NEXT_REDIRECT:/confirmed?onboarding=1",
    );

    expect(auth.signUp).toHaveBeenCalledWith({
      email: "unique@example.test",
      password: "correct-horse",
      options: {
        emailRedirectTo: "https://factfight.com/auth/callback?onboarding=1",
        data: { username: "unique_user", displayName: "Unique User" },
      },
    });
  });

  it("reports confirmation-email infrastructure failure without leaking raw errors", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: "{}", status: 500 },
    });

    const result = await signupAction({ message: "" }, signupForm());

    expect(result.message).toContain("confirmation email could not be sent");
    expect(result.message).not.toContain("{}");
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("logs in and validates claims without clearing the session", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test-access-token" } },
      error: null,
    });
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    const form = new FormData();
    form.set("email", "member@example.test");
    form.set("password", "correct-horse");
    form.set("next", "/feed");

    await expect(loginAction({ message: "" }, form)).rejects.toThrow(
      "NEXT_REDIRECT:/feed",
    );
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("resends confirmation with the canonical callback and an enumeration-safe result", async () => {
    auth.resend.mockResolvedValue({ error: null });
    const form = new FormData();
    form.set("email", "unknown@example.test");

    const result = await resendConfirmationAction(
      { message: "", success: false },
      form,
    );

    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "unknown@example.test",
      options: { emailRedirectTo: "https://factfight.com/auth/callback?onboarding=1" },
    });
    expect(result).toEqual({
      message:
        "If a pending account exists for that email, a new confirmation link is on its way.",
      success: true,
    });
  });

  it("requests password recovery through the canonical reset callback", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const form = new FormData();
    form.set("email", "member@example.test");

    await requestPasswordResetAction({ message: "", success: false }, form);

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "member@example.test",
      {
        redirectTo:
          "https://factfight.com/auth/callback?next=/reset-password",
      },
    );
  });
});
