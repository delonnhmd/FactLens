import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptTerms: vi.fn(),
  createClient: vi.fn(),
  ensureProfile: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  acceptTerms: mocks.acceptTerms,
  ensureProfile: mocks.ensureProfile,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/validation/env", () => ({
  publicEnvironment: { siteUrl: "https://factfight.com" },
}));

import { GET } from "@/app/auth/callback/route";

describe("authentication callback", () => {
  const auth = {
    exchangeCodeForSession: vi.fn(),
    getClaims: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    Object.values(auth).forEach((mock) => mock.mockReset());
    mocks.createClient.mockResolvedValue({ auth });
    mocks.ensureProfile.mockResolvedValue({ ok: true });
    mocks.acceptTerms.mockResolvedValue({ ok: true });
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "test-access-token" } },
      error: null,
    });
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
  });

  it("exchanges a confirmation code and establishes the feed session", async () => {
    const response = await GET(
      new NextRequest("https://www.factfight.com/auth/callback?code=test-code"),
    );

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe("https://factfight.com/feed");
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("preserves a safe password-reset destination after code exchange", async () => {
    const response = await GET(
      new NextRequest(
        "https://factfight.com/auth/callback?code=test-code&next=/reset-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://factfight.com/reset-password",
    );
  });

  it("rejects an external next destination", async () => {
    const response = await GET(
      new NextRequest(
        "https://factfight.com/auth/callback?code=test-code&next=https://evil.example",
      ),
    );

    expect(response.headers.get("location")).toBe("https://factfight.com/feed");
  });

  it("does not silently clear a session when profile setup is unavailable", async () => {
    mocks.ensureProfile.mockResolvedValue({ ok: false, message: "Unavailable" });

    const response = await GET(
      new NextRequest("https://factfight.com/auth/callback?code=test-code"),
    );

    expect(response.headers.get("location")).toBe(
      "https://factfight.com/login?error=profile_unavailable",
    );
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
