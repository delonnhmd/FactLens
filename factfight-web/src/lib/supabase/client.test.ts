import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createBrowserClient: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}));
vi.mock("@/lib/validation/env", () => ({
  publicEnvironment: {
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "test-anon-key",
  },
}));

import { createClient } from "@/lib/supabase/client";

describe("browser Supabase client", () => {
  it("memoizes one client across renders and navigation", () => {
    const browserClient = { auth: {} };
    mocks.createBrowserClient.mockReturnValue(browserClient);

    expect(createClient()).toBe(browserClient);
    expect(createClient()).toBe(browserClient);
    expect(mocks.createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
