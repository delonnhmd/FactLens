import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getSafeInternalDestination } from "@/lib/utils/redirects";

describe("authentication URL and session safety configuration", () => {
  it.each([
    ["/feed", "/feed"],
    ["/reset-password", "/reset-password"],
    ["/claim/example?tab=evidence", "/claim/example?tab=evidence"],
    ["https://evil.example", "/feed"],
    ["//evil.example/path", "/feed"],
    ["/\\evil.example", "/feed"],
    ["/feed\nSet-Cookie:test", "/feed"],
  ])("normalizes safe next path %s", (value, expected) => {
    expect(getSafeInternalDestination(value)).toBe(expected);
  });

  it("contains no active obsolete-domain callback in web source", () => {
    const sourceFiles = [
      "src/app/(auth)/actions.ts",
      "src/app/(auth)/password-actions.ts",
      "src/app/auth/callback/route.ts",
      "src/lib/validation/env.ts",
    ];

    for (const file of sourceFiles) {
      expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toContain(
        "verifact.pennyfloat.com",
      );
    }
  });

  it("keeps canonical web URLs environment-driven", () => {
    const envSource = readFileSync(
      resolve(process.cwd(), "src/lib/validation/env.ts"),
      "utf8",
    );
    expect(envSource).toContain("NEXT_PUBLIC_SITE_URL");
    expect(envSource).toContain("NEXT_PUBLIC_RENDER_BACKEND_URL");
    expect(envSource).not.toContain("factfight.com");
  });

  it("preserves every existing Expo callback scheme", () => {
    const mobileConfig = readFileSync(
      resolve(process.cwd(), "../constants/launchConfig.ts"),
      "utf8",
    );

    expect(mobileConfig).toContain("verifact://auth/callback");
    expect(mobileConfig).toContain("exp+factlens://auth/callback");
    expect(mobileConfig).toContain("exp+verifact://auth/callback");
  });

  it("contains no automatic sign-out in vote or shared-session code", () => {
    const files = [
      "src/app/claim/[id]/actions.ts",
      "src/lib/api/claim-mutations.ts",
      "src/lib/auth/verified-session.ts",
      "src/lib/supabase/proxy.ts",
    ];

    for (const file of files) {
      expect(readFileSync(resolve(process.cwd(), file), "utf8")).not.toContain(
        ".signOut(",
      );
    }
  });

  it("uses the Next.js 16 proxy entrypoint instead of middleware.ts", () => {
    const proxySource = readFileSync(
      resolve(process.cwd(), "src/proxy.ts"),
      "utf8",
    );
    expect(proxySource).toContain("updateSession");
  });
});
