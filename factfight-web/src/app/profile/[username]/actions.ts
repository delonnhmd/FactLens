"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { setUserBlocked } from "@/lib/api/blocks";
import { getVerifiedSession } from "@/lib/auth/verified-session";

export type BlockActionState = { message: string; success: boolean };
const blockSchema = z.object({ userId: z.uuid(), confirmation: z.preprocess((value) => value === "on", z.literal(true, { error: "Confirm that you want to block this user." })) });

export async function blockUserAction(_state: BlockActionState, formData: FormData): Promise<BlockActionState> {
  const parsed = blockSchema.safeParse({ userId: formData.get("userId"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Confirm this block.", success: false };
  const session = await getVerifiedSession();
  if (!session.ok) return { message: "Log in to block users.", success: false };
  if (session.userId === parsed.data.userId) return { message: "You cannot block yourself.", success: false };
  const result = await setUserBlocked(session.accessToken, parsed.data.userId, true);
  if (!result.ok) return { message: result.message, success: false };
  revalidatePath("/feed");
  redirect("/feed");
}
