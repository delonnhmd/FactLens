import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/validation/env", () => ({
  publicEnvironment: {
    renderBackendUrl: "https://factlens-e8uf.onrender.com",
  },
}));

import { voteOnClaim } from "@/lib/api/claim-mutations";

describe("vote API error contracts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it.each([
    [400, "The vote request is invalid."],
    [403, "This account cannot vote."],
    [409, "A vote already exists."],
    [429, "Please wait before voting again."],
    [500, "Could not record vote."],
  ])("preserves a safe backend message for HTTP %i", async (status, detail) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await voteOnClaim(
      "test-access-token",
      "00000000-0000-4000-8000-000000000010",
      "TRUE",
    );

    expect(result).toEqual({ ok: false, status, message: detail });
  });

  it("sends the bearer token and never a frontend user id", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await voteOnClaim(
      "test-access-token",
      "00000000-0000-4000-8000-000000000010",
      "FAKE",
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      "https://factlens-e8uf.onrender.com/api/claims/00000000-0000-4000-8000-000000000010/vote",
    );
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-access-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({ vote_type: "FAKE" });
  });
});
