import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/lib/validation/env", () => ({
  publicEnvironment: {
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "test-anon-key",
  },
}));

import { updateSession } from "@/lib/supabase/proxy";

type SetAllFn = (
  values: Array<{ name: string; value: string; options: Record<string, unknown> }>,
  headers: Record<string, string>,
) => void;

function mockClient({
  getClaims,
  refreshToken,
  setSession,
}: {
  getClaims: ReturnType<typeof vi.fn>;
  refreshToken?: string | null;
  setSession?: ReturnType<typeof vi.fn>;
}) {
  mocks.createServerClient.mockImplementation(
    (_url: string, _key: string, options: { cookies: { setAll: SetAllFn } }) => ({
      auth: {
        getClaims,
        getSession: vi.fn().mockResolvedValue({
          data: { session: refreshToken ? { refresh_token: refreshToken } : null },
          error: null,
        }),
        setSession:
          setSession ??
          vi.fn(async () => {
            options.cookies.setAll(
              [{ name: "sb-project-auth-token", value: "rotated", options: { path: "/", secure: true } }],
              { "Cache-Control": "private, no-store" },
            );
            return { data: {}, error: null };
          }),
      },
    }),
  );
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("Supabase proxy cookie refresh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /login and does not leak cookies when the refresh grant fails on a protected route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, false)),
    );
    mockClient({
      getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("stale") }),
      refreshToken: "token-a",
    });

    const response = await updateSession(
      new NextRequest("https://www.factfight.com/feed?tab=latest"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.factfight.com/login?next=%2Ffeed%3Ftab%3Dlatest",
    );
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("sb-project-auth-token");
  });

  it("recovers a stale access token on a public claim route without redirecting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh" }),
      ),
    );
    const getClaims = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    mockClient({ getClaims, refreshToken: "token-b" });

    const response = await updateSession(
      new NextRequest("https://www.factfight.com/claim/00000000-0000-4000-8000-000000000010"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-project-auth-token=rotated");
  });

  it("does not attempt any refresh when there is no session to recover (anonymous visitor)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockClient({
      getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("no session") }),
      refreshToken: null,
    });

    const response = await updateSession(
      new NextRequest("https://www.factfight.com/claim/00000000-0000-4000-8000-000000000010"),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("coalesces two concurrent requests refreshing the same token into a single network call", async () => {
    let resolveGrant!: (value: Response) => void;
    const grantPromise = new Promise<Response>((resolve) => {
      resolveGrant = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(grantPromise);
    vi.stubGlobal("fetch", fetchMock);

    const getClaims = vi.fn().mockResolvedValue({ data: null, error: new Error("stale") });
    mockClient({ getClaims, refreshToken: "shared-token" });

    const first = updateSession(new NextRequest("https://www.factfight.com/claim/a"));
    const second = updateSession(new NextRequest("https://www.factfight.com/claim/b"));

    // Let both calls reach the in-flight refresh before it resolves.
    await Promise.resolve();
    await Promise.resolve();
    resolveGrant(jsonResponse({ access_token: "new-access", refresh_token: "new-refresh" }));

    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not leak cookies when a losing single-flight race resolves to failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, false)),
    );
    mockClient({
      getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("stale") }),
      refreshToken: "token-c",
    });

    const response = await updateSession(
      new NextRequest("https://www.factfight.com/claim/00000000-0000-4000-8000-000000000010"),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("sb-project-auth-token");
  });

  it("applies all cookies from a successful rotated refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh" }),
      ),
    );
    const getClaims = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    mockClient({
      getClaims,
      refreshToken: "token-d",
      setSession: vi.fn(async (...args: unknown[]) => {
        const [, , options] = mocks.createServerClient.mock.calls.at(-1) as [
          string,
          string,
          { cookies: { setAll: SetAllFn } },
        ];
        void args;
        options.cookies.setAll(
          [
            { name: "sb-project-auth-token.0", value: "rotated-a", options: { path: "/", secure: true } },
            { name: "sb-project-auth-token.1", value: "rotated-b", options: { path: "/", secure: true } },
          ],
          { "Cache-Control": "private, no-store" },
        );
        return { data: {}, error: null };
      }),
    });

    const response = await updateSession(new NextRequest("https://www.factfight.com/feed"));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.headers.get("location")).toBeNull();
    expect(setCookie).toContain("sb-project-auth-token.0=rotated-a");
    expect(setCookie).toContain("sb-project-auth-token.1=rotated-b");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("allows navigation when refresh restores authenticated claims", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh" }),
      ),
    );
    const getClaims = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    mockClient({ getClaims, refreshToken: "token-e" });

    const response = await updateSession(new NextRequest("https://www.factfight.com/feed"));

    expect(response.headers.get("location")).toBeNull();
    expect(getClaims).toHaveBeenCalledTimes(2);
  });
});
