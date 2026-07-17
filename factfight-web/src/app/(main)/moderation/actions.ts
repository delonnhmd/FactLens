"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveReport } from "@/lib/api/moderation";
import { getVerifiedSession } from "@/lib/auth/verified-session";

export type ModerationActionState = { message: string; success: boolean };

const schema = z.object({ reportId: z.uuid(), status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), hideTarget: z.preprocess((value) => value === "on", z.boolean()), adminNote: z.string().trim().max(500) });

export async function resolveReportAction(_state: ModerationActionState, formData: FormData): Promise<ModerationActionState> {
  const parsed = schema.safeParse({ reportId: formData.get("reportId"), status: formData.get("status"), hideTarget: formData.get("hideTarget"), adminNote: formData.get("adminNote") });
  if (!parsed.success) return { message: "Check the moderation fields.", success: false };
  const session = await getVerifiedSession();
  if (!session.ok) return { message: "Admin access required.", success: false };
  const result = await resolveReport(session.accessToken, parsed.data.reportId, parsed.data);
  if (!result.ok) return { message: result.message, success: false };
  revalidatePath("/moderation");
  return { message: "Report updated.", success: true };
}
