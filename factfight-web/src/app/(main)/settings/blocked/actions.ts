"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setUserBlocked } from "@/lib/api/blocks";
import { getVerifiedSession } from "@/lib/auth/verified-session";

export type UnblockActionState = { message: string; success: boolean };

export async function unblockUserAction(_state: UnblockActionState, formData: FormData): Promise<UnblockActionState> {
  const parsed = z.uuid().safeParse(formData.get("userId"));
  if (!parsed.success) return { message: "User not found.", success: false };
  const session = await getVerifiedSession();
  if (!session.ok) return { message: session.message, success: false };
  const result = await setUserBlocked(session.accessToken, parsed.data, false);
  if (!result.ok) return { message: result.message, success: false };
  revalidatePath("/settings/blocked");
  revalidatePath("/feed");
  return { message: "User unblocked.", success: true };
}
