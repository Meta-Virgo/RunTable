import { supabase } from "../supabase";
import type { Channel, CreateSquarePostModuleInput, Post } from "../types";

export interface SquareFeedBootstrap {
  current_user: any | null;
  channels: Channel[];
  active_channel_id: string | null;
  posts: Post[];
}

export function isMissingSquareFeedBootstrapError(error: unknown) {
  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
  const text = [
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    maybeError?.code === "42883" ||
    maybeError?.code === "PGRST202" ||
    text.includes("get_square_feed_bootstrap")
  );
}

export async function fetchSquareFeedBootstrap(channelId?: string | null) {
  return supabase.rpc("get_square_feed_bootstrap", {
    p_channel_id: channelId || null,
    p_limit: 30,
  });
}

export async function fetchSquareUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { ...user, ...profile };
}

export async function fetchChannels() {
  return supabase
    .from("channels")
    .select("*")
    .order("category")
    .order("created_at");
}

export async function fetchPostsForChannel(channelId: string) {
  return supabase
    .from("posts")
    .select(
      `
      *,
      square_post_modules (*),
      post_likes (user_id),
      post_comments (count)
    `
    )
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });
}

export async function fetchPostWithCounts(postId: string) {
  return supabase
    .from("posts")
    .select(
      `
      *,
      square_post_modules (*),
      post_likes (count),
      post_comments (count)
    `
    )
    .eq("id", postId)
    .single();
}

export async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return { data: [] };
  return supabase
    .from("profiles")
    .select("id, nickname, avatar_url, is_vip")
    .in("id", userIds);
}

export async function fetchProfileById(userId: string) {
  return supabase.from("profiles").select("*").eq("id", userId).single();
}

export async function fetchLikedPostIds(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();

  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  return new Set((data || []).map((like) => like.post_id));
}

export async function fetchLatestComments(postId: string, limit = 1) {
  return supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function uploadPostImage(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const imagePath = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${safeExt}`;

  const { error } = await supabase.storage.from("post-images").upload(
    imagePath,
    file,
    {
      contentType: file.type || "image/jpeg",
    }
  );

  if (error) throw error;

  const { data } = supabase.storage.from("post-images").getPublicUrl(imagePath);
  return data.publicUrl;
}

export async function createPost(postData: {
  channel_id: string;
  user_id: string;
  content: string;
  image_url?: string;
}) {
  return supabase.from("posts").insert(postData).select("id").single();
}

export async function createPostModules(
  postId: string,
  modules: CreateSquarePostModuleInput[]
) {
  if (modules.length === 0) return { error: null };

  return supabase.from("square_post_modules").insert(
    modules.map((module, index) => ({
      post_id: postId,
      module_type: module.module_type,
      payload: module.payload,
      source_character_id: module.source_character_id || null,
      source_room_id: module.source_room_id || null,
      source_message_ids: module.source_message_ids || [],
      display_order: module.display_order ?? index,
    }))
  );
}

export async function createNotification(payload: {
  user_id: string;
  actor_id: string;
  type: string;
  post_id: string;
}) {
  return supabase.from("notifications").insert(payload);
}

export async function unlikePost(postId: string, userId: string) {
  return supabase
    .from("post_likes")
    .delete()
    .match({ post_id: postId, user_id: userId });
}

export async function likePost(postId: string, userId: string) {
  return supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
}

export async function deletePost(postId: string) {
  return supabase.from("posts").delete().eq("id", postId);
}
