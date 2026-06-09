import { supabase } from "../supabase";
export {
  createNotification,
  fetchProfileById,
  fetchProfilesByIds,
} from "./squareFeedRepository";

export async function fetchPostComments(postId: string) {
  return supabase
    .from("post_comments")
    .select(
      `
      *,
      quote:quote_id (
        id,
        content,
        user_id
      ),
      comment_likes (user_id)
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
}

export async function createComment(payload: {
  post_id: string;
  user_id: string;
  content: string;
  quote_id?: string;
}) {
  return supabase.from("post_comments").insert(payload).select().single();
}

export async function unlikeComment(commentId: string, userId: string) {
  return supabase
    .from("comment_likes")
    .delete()
    .match({ comment_id: commentId, user_id: userId });
}

export async function likeComment(commentId: string, userId: string) {
  return supabase
    .from("comment_likes")
    .insert({ comment_id: commentId, user_id: userId });
}

export async function deleteComment(commentId: string) {
  return supabase.from("post_comments").delete().eq("id", commentId);
}
