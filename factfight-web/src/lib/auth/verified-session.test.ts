import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  getVerifiedSession,
  refreshVerifiedSession,
} from "@/lib/auth/verified-session";

describe("verified SSR session", () => {
  const auth = {
    getClaims: vi.fn(),
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    Object.values(auth).forEach((mock) => mock.mockReset());
    mocks.createClient.mockResolvedValue({ auth });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "current-token" } },
      error: null,
    });
  });

  it("validates claims before transporting the current access token", async () => {
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });

    await expect(getVerifiedSession()).resolves.toEqual({
      ok: true,
      accessToken: "current-token",
      userId: "00000000-0000-4000-8000-000000000001",
    });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it("recovers a stale claims cookie with one persisted refresh", async () => {
    auth.getClaims
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    auth.refreshSession.mockResolvedValue({ data: {}, error: null });

    const result = await getVerifiedSession();

    expect(result.ok).toBe(true);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("force-refreshes before a vote retry and validates the rotated token", async () => {
    auth.refreshSession.mockResolvedValue({ data: {}, error: null });
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "rotated-token" } },
      error: null,
    });

    await expect(refreshVerifiedSession()).resolves.toMatchObject({
      ok: true,
      accessToken: "rotated-token",
    });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("reports a failed refresh without calling signOut", async () => {
    auth.refreshSession.mockResolvedValue({
      data: null,
      error: new Error("refresh failed"),
    });

    await expect(refreshVerifiedSession()).resolves.toEqual({
      ok: false,
      message: "Your session could not be refreshed.",
    });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
