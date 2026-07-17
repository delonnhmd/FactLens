"use server";

import { revalidatePath } from "next/cache";

import { getVerifiedSession } from "@/lib/auth/verified-session";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(formData: FormData) {
  const id = formData.get("notificationId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const session = await getVerifiedSession();
  if (!session.ok) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", session.userId);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const session = await getVerifiedSession();
  if (!session.ok) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", session.userId).eq("read", false);
  revalidatePath("/notifications");
}
