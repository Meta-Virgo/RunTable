import { supabase } from "../supabase";

const PROFILE_SELECT =
  "id, nickname, avatar_url, user_code, bio, is_vip, level, created_at";

export async function fetchAcceptedFriendships(userId: string) {
  return supabase
    .from("friendships")
    .select(
      `
        *,
        friend_profile:friend_id (${PROFILE_SELECT}),
        user_profile:user_id (${PROFILE_SELECT})
      `
    )
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq("status", "accepted");
}

export async function fetchIncomingFriendRequests(userId: string) {
  return supabase
    .from("friendships")
    .select(
      `
        *,
        user_profile:user_id (${PROFILE_SELECT})
      `
    )
    .eq("friend_id", userId)
    .eq("status", "pending");
}

export async function searchProfiles(input: {
  currentUserId: string;
  query: string;
}) {
  let query = supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .neq("id", input.currentUserId);

  if (/^\d+$/.test(input.query)) {
    query = query.eq("user_code", Number.parseInt(input.query, 10));
  } else {
    query = query.ilike("nickname", `%${input.query}%`);
  }

  return query;
}

export async function fetchExistingFriendship(input: {
  currentUserId: string;
  targetUserId: string;
}) {
  return supabase
    .from("friendships")
    .select("*")
    .or(
      `and(user_id.eq.${input.currentUserId},friend_id.eq.${input.targetUserId}),and(user_id.eq.${input.targetUserId},friend_id.eq.${input.currentUserId})`
    )
    .single();
}

export async function createFriendRequest(input: {
  currentUserId: string;
  targetUserId: string;
}) {
  return supabase.from("friendships").insert({
    user_id: input.currentUserId,
    friend_id: input.targetUserId,
    status: "pending",
  });
}

export async function acceptFriendRequest(friendshipId: string) {
  return supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);
}

export async function rejectFriendRequest(friendshipId: string) {
  return supabase.from("friendships").delete().eq("id", friendshipId);
}

export async function deleteFriendship(friendshipId: string) {
  return supabase.from("friendships").delete().eq("id", friendshipId);
}
