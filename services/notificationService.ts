import { supabase } from "../lib/supabase";

export type AppNotificationType =
  | "mention_claim"
  | "mention_evidence"
  | "badge_earned"
  | "claim_verified"
  | "claim_finalized"
  | string;

type NotificationRow = {
  id: string;
  user_id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  claim_id: string | null;
  read: boolean | null;
  created_at: string;
};

export interface AppNotification {
  id: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  claimId: string | null;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_LOAD_ERROR_MESSAGE = "Could not load notifications right now.";

function mapNotificationRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    claimId: row.claim_id,
    read: Boolean(row.read),
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(userId: string, limit = 50): Promise<{
  notifications: AppNotification[];
  error?: string;
}> {
  if (!userId) {
    return { notifications: [] };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,type,title,body,claim_id,read,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)));

  if (error) {
    console.log("[notifications] load warning:", error);
    return {
      notifications: [],
      error: NOTIFICATIONS_LOAD_ERROR_MESSAGE,
    };
  }

  return {
    notifications: ((data ?? []) as NotificationRow[]).map(mapNotificationRow),
  };
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  if (!userId) {
    return 0;
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    console.log("[notifications] unread count warning:", error);
    return 0;
  }

  return count ?? 0;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  if (!notificationId || !userId) {
    return false;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    console.log("[notifications] mark read warning:", error);
    return false;
  }

  return true;
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    console.log("[notifications] mark all read warning:", error);
    return false;
  }

  return true;
}
