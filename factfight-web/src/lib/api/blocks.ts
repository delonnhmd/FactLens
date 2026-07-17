import "server-only";

import { z } from "zod";

import { requestRenderJson } from "@/lib/api/render-client";

const blockResultSchema = z.looseObject({ ok: z.literal(true) });
const blockListSchema = z.looseObject({ blocked_ids: z.array(z.uuid()).max(1_000) });

export async function getBlockedUserIds(accessToken: string): Promise<readonly string[]> {
  try {
    const payload = await requestRenderJson("/api/users/me/blocks", accessToken, { method: "GET" });
    const parsed = blockListSchema.safeParse(payload);
    return Object.freeze(parsed.success ? parsed.data.blocked_ids : []);
  } catch {
    return Object.freeze([]);
  }
}

export async function setUserBlocked(accessToken: string, userId: string, blocked: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const payload = await requestRenderJson(`/api/users/${userId}/block`, accessToken, {
      method: blocked ? "POST" : "DELETE",
      ...(blocked ? { body: JSON.stringify({ source_claim_id: null }) } : {}),
    });
    return blockResultSchema.safeParse(payload).success ? { ok: true } : { ok: false, message: "The block response could not be verified." };
  } catch {
    return { ok: false, message: blocked ? "Could not block this user right now." : "Could not unblock this user right now." };
  }
}
