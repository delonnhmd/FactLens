import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/validation/env", () => ({
  publicEnvironment: {
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "test-anon-key",
  },
}));

import {
  getVerifiedSession,
  refreshVerifiedSession,
} from "@/lib/auth/verified-session";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("verified SSR session", () => {
  const auth = {
    getClaims: vi.fn(),
    getSession: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    Object.values(auth).forEach((mock) => mock.mockReset());
    mocks.createClient.mockResolvedValue({ auth });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "current-token", refresh_token: "refresh-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates claims before transporting the current access token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });

    await expect(getVerifiedSession()).resolves.toEqual({
      ok: true,
      accessToken: "current-token",
      userId: "00000000-0000-4000-8000-000000000001",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recovers a stale claims cookie with one persisted refresh, via the shared single-flight cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "rotated-access", refresh_token: "rotated-refresh" }),
      ),
    );
    auth.getClaims
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    auth.setSession.mockResolvedValue({ data: {}, error: null });

    const result = await getVerifiedSession();

    expect(result.ok).toBe(true);
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: "rotated-access",
      refresh_token: "rotated-refresh",
    });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("force-refreshes before a vote retry and validates the rotated token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "rotated-token", refresh_token: "rotated-refresh" }),
      ),
    );
    auth.setSession.mockResolvedValue({ data: {}, error: null });
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "rotated-token", refresh_token: "refresh-token" } },
      error: null,
    });

    await expect(refreshVerifiedSession()).resolves.toMatchObject({
      ok: true,
      accessToken: "rotated-token",
    });
    expect(auth.setSession).toHaveBeenCalledTimes(1);
  });

  it("reports a failed refresh without calling signOut", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, false)));

    await expect(refreshVerifiedSession()).resolves.toEqual({
      ok: false,
      message: "Your session could not be refreshed.",
    });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it("does not attempt a refresh when there is no session to recover", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(refreshVerifiedSession()).resolves.toEqual({
      ok: false,
      message: "Your session could not be refreshed.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
