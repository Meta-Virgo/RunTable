import { supabase } from "../supabase";

export async function fetchNotifications(userId: string) {
  return supabase
    .from("notifications")
    .select("*, actor:actor_id(nickname, avatar_url), post:post_id(content)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
}

export async function markNotificationRead(notificationId: string) {
  return supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

export async function deleteNotification(notificationId: string) {
  return supabase
    .from("notifications")
    .delete({ count: "exact" })
    .eq("id", notificationId);
}
