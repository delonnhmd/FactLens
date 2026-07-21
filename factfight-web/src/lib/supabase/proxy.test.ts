import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

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

describe("Supabase proxy cookie refresh", () => {
  it("does not clear cookies when a parallel protected-route refresh fails", async () => {
    mocks.createServerClient.mockImplementation(
      (_url: string, _key: string, options: {
        cookies: {
          setAll: (
            values: Array<{
              name: string;
              value: string;
              options: Record<string, unknown>;
            }>,
            headers: Record<string, string>,
          ) => void;
        };
      }) => ({
        auth: {
          getClaims: vi
            .fn()
            .mockResolvedValue({ data: null, error: new Error("stale") }),
          refreshSession: vi.fn(async () => {
            options.cookies.setAll(
              [
                {
                  name: "sb-project-auth-token",
                  value: "rotated-cookie",
                  options: {
                    httpOnly: true,
                    path: "/",
                    sameSite: "lax",
                    secure: true,
                  },
                },
              ],
              { "Cache-Control": "private, no-store" },
            );
            return { data: null, error: new Error("expired") };
          }),
        },
      }),
    );

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

  it("does not attempt a refresh for public claim requests", async () => {
    const refreshSession = vi.fn();
    mocks.createServerClient.mockImplementation(() => ({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: null, error: new Error("stale") }),
        refreshSession,
      },
    }));

    const response = await updateSession(
      new NextRequest("https://www.factfight.com/claim/00000000-0000-4000-8000-000000000010"),
    );

    expect(response.status).toBe(200);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("applies all cookies from a successful rotated refresh", async () => {
    const getClaims = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    mocks.createServerClient.mockImplementation(
      (_url: string, _key: string, options: {
        cookies: {
          setAll: (
            values: Array<{ name: string; value: string; options: Record<string, unknown> }>,
            headers: Record<string, string>,
          ) => void;
        };
      }) => ({
        auth: {
          getClaims,
          refreshSession: vi.fn(async () => {
            options.cookies.setAll(
              [
                { name: "sb-project-auth-token.0", value: "rotated-a", options: { path: "/", secure: true } },
                { name: "sb-project-auth-token.1", value: "rotated-b", options: { path: "/", secure: true } },
              ],
              { "Cache-Control": "private, no-store" },
            );
            return { data: {}, error: null };
          }),
        },
      }),
    );

    const response = await updateSession(new NextRequest("https://www.factfight.com/feed"));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.headers.get("location")).toBeNull();
    expect(setCookie).toContain("sb-project-auth-token.0=rotated-a");
    expect(setCookie).toContain("sb-project-auth-token.1=rotated-b");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("allows navigation when refresh restores authenticated claims", async () => {
    const getClaims = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error("stale") })
      .mockResolvedValueOnce({
        data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      });
    mocks.createServerClient.mockImplementation(() => ({
      auth: {
        getClaims,
        refreshSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    }));

    const response = await updateSession(
      new NextRequest("https://www.factfight.com/feed"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(getClaims).toHaveBeenCalledTimes(2);
  });
});
