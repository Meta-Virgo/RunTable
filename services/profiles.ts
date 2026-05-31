import { supabase } from "../supabase";

export async function fetchProfileSummary(userId: string) {
  return supabase
    .from("profiles")
    .select("nickname, is_vip")
    .eq("id", userId)
    .single();
}

export async function fetchProfileDetails(userId: string) {
  return supabase
    .from("profiles")
    .select("user_code, nickname, bio, created_at, is_vip, avatar_url")
    .eq("id", userId)
    .single();
}

export async function createProfileForUser(userId: string, email?: string) {
  return supabase
    .from("profiles")
    .insert({
      id: userId,
      nickname: email?.split("@")[0] || "User",
    })
    .select()
    .single();
}

export async function updateProfile(
  userId: string,
  profile: { nickname: string; bio: string; avatar_url: string | null }
) {
  return supabase.from("profiles").update(profile).eq("id", userId);
}
