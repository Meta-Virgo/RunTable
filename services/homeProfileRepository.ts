import { supabase } from "../supabase";

export async function fetchFriendRequestCount(userId: string) {
  return supabase
    .from("friendships")
    .select("id", { count: "exact" })
    .eq("friend_id", userId)
    .eq("status", "pending");
}

export async function fetchKpHistory(userId: string) {
  return supabase
    .from("game_histories")
    .select("*")
    .eq("kp_id", userId)
    .order("created_at", { ascending: false });
}

export async function fetchPlayerHistory(userId: string) {
  return supabase
    .from("game_history_participants")
    .select(`*, game_history:game_histories (*)`)
    .eq("user_id", userId)
    .order("id", { ascending: false });
}

export async function fetchCharactersByIds(characterIds: string[]) {
  if (characterIds.length === 0) return { data: [] };
  return supabase.from("characters").select("*").in("id", characterIds);
}
