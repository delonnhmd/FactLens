import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVerifiedSession: vi.fn(),
  refreshVerifiedSession: vi.fn(),
  revalidatePath: vi.fn(),
  voteOnClaim: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/api/claim-mutations", () => ({
  deleteOwnClaim: vi.fn(),
  voteOnClaim: mocks.voteOnClaim,
}));
vi.mock("@/lib/auth/verified-session", () => ({
  getVerifiedSession: mocks.getVerifiedSession,
  refreshVerifiedSession: mocks.refreshVerifiedSession,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/storage/user-images", () => ({
  removeUserImage: vi.fn(),
  uploadUserImage: vi.fn(),
  validateOptionalUserImage: vi.fn(),
}));

import { voteClaimAction } from "@/app/claim/[id]/actions";

function voteForm() {
  const form = new FormData();
  form.set("claimId", "00000000-0000-4000-8000-000000000010");
  form.set("pathIdentifier", "test-claim");
  form.set("voteType", "TRUE");
  return form;
}

describe("vote server action", () => {
  beforeEach(() => {
    mocks.getVerifiedSession.mockResolvedValue({
      ok: true,
      accessToken: "old-token",
      userId: "00000000-0000-4000-8000-000000000001",
    });
    mocks.refreshVerifiedSession.mockResolvedValue({
      ok: true,
      accessToken: "new-token",
      userId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("records an authenticated vote and refreshes claim data", async () => {
    mocks.voteOnClaim.mockResolvedValue({ ok: true, data: null });

    const result = await voteClaimAction(
      { message: "", success: false },
      voteForm(),
    );

    expect(result).toEqual({ message: "Your vote was recorded.", success: true });
    expect(mocks.voteOnClaim).toHaveBeenCalledWith(
      "old-token",
      "00000000-0000-4000-8000-000000000010",
      "TRUE",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/feed");
  });

  it.each([
    [400, "Invalid vote."],
    [403, "Voting is unavailable for this account."],
    [409, "You already voted."],
    [429, "Too many vote attempts."],
    [500, "Could not record vote."],
  ])("returns a backend-safe %i response without refreshing auth", async (status, message) => {
    mocks.voteOnClaim.mockResolvedValue({ ok: false, status, message });

    const result = await voteClaimAction(
      { message: "", success: false },
      voteForm(),
    );

    expect(result).toEqual({ message, success: false });
    expect(mocks.refreshVerifiedSession).not.toHaveBeenCalled();
  });

  it("refreshes once and retries once after a 401", async () => {
    mocks.voteOnClaim
      .mockResolvedValueOnce({ ok: false, status: 401, message: "Unauthorized" })
      .mockResolvedValueOnce({ ok: true, data: null });

    const result = await voteClaimAction(
      { message: "", success: false },
      voteForm(),
    );

    expect(result.success).toBe(true);
    expect(mocks.refreshVerifiedSession).toHaveBeenCalledTimes(1);
    expect(mocks.voteOnClaim).toHaveBeenCalledTimes(2);
    expect(mocks.voteOnClaim).toHaveBeenLastCalledWith(
      "new-token",
      "00000000-0000-4000-8000-000000000010",
      "TRUE",
    );
  });

  it("does not loop or clear auth when the refreshed-token retry is also 401", async () => {
    mocks.voteOnClaim.mockResolvedValue({
      ok: false,
      status: 401,
      message: "Unauthorized",
    });

    const result = await voteClaimAction(
      { message: "", success: false },
      voteForm(),
    );

    expect(result).toEqual({
      message: "Your session could not be verified. Please sign in again.",
      success: false,
      loginRequired: true,
    });
    expect(mocks.refreshVerifiedSession).toHaveBeenCalledTimes(1);
    expect(mocks.voteOnClaim).toHaveBeenCalledTimes(2);
  });

  it("does not send a vote if no authenticated session can be validated", async () => {
    mocks.getVerifiedSession.mockResolvedValue({
      ok: false,
      message: "Log in to continue.",
    });

    const result = await voteClaimAction(
      { message: "", success: false },
      voteForm(),
    );

    expect(result.loginRequired).toBe(true);
    expect(mocks.voteOnClaim).not.toHaveBeenCalled();
  });
});
