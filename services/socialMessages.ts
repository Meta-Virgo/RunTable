import { supabase } from "../supabase";
import type {
  DirectConversationSummary,
  DirectMessage,
  RoomInviteLinkPreview,
  RoomInvitationInboxItem,
  RoomInvitationOutboxItem,
  SocialMessageBadgeCounts,
} from "../types";

const DIRECT_MESSAGE_SELECT = `
  id,
  conversation_id,
  sender_id,
  content,
  created_at,
  sender:sender_id (nickname, avatar_url)
`;

const MIGRATION_NOT_READY_MESSAGE =
  "私信与邀请功能的数据库迁移尚未应用，请先执行 Supabase migration 后再使用。";

export function getSocialMessageErrorMessage(
  error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined,
  fallback: string
) {
  if (!error) return fallback;

  const text = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    text.includes("schema cache") ||
    text.includes("could not find the function") ||
    text.includes("direct_conversation") ||
    text.includes("direct_messages") ||
    text.includes("room_invitation")
  ) {
    return MIGRATION_NOT_READY_MESSAGE;
  }

  return error.message || fallback;
}

export function isSocialMessageSchemaMissingError(
  error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined
) {
  return getSocialMessageErrorMessage(error, "") === MIGRATION_NOT_READY_MESSAGE;
}

export function buildRoomInviteUrl(origin: string, token: string) {
  const url = new URL(origin);
  url.searchParams.set("room_invite", token);
  return url.toString();
}

export function parseRoomInviteToken(search: string) {
  return new URLSearchParams(search).get("room_invite");
}

export function getTotalSocialMessageBadgeCount(
  counts: SocialMessageBadgeCounts | null
) {
  if (!counts) return 0;
  return (
    Number(counts.unread_direct_count || 0) +
    Number(counts.pending_room_invitation_count || 0)
  );
}

export async function fetchSocialMessageBadgeCounts() {
  const { data, error } = await supabase
    .rpc("get_social_message_badge_counts")
    .maybeSingle<SocialMessageBadgeCounts>();

  return {
    data:
      data ||
      ({
        unread_direct_count: 0,
        pending_room_invitation_count: 0,
      } satisfies SocialMessageBadgeCounts),
    error,
  };
}

export async function fetchDirectConversationSummaries() {
  const result = await supabase.rpc("get_direct_conversation_summaries");
  return result as {
    data: DirectConversationSummary[] | null;
    error: any;
  };
}

export async function fetchDirectMessages(conversationId: string) {
  const result = await supabase
    .from("direct_messages")
    .select(DIRECT_MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return result as {
    data: DirectMessage[] | null;
    error: any;
  };
}

export async function getOrCreateDirectConversation(friendUserId: string) {
  const result = await supabase.rpc("get_or_create_direct_conversation", {
    p_friend_user_id: friendUserId,
  });
  return result as { data: string | null; error: any };
}

export async function sendDirectMessage(input: {
  recipientUserId: string;
  content: string;
}) {
  const result = await supabase.rpc("send_direct_message", {
    p_recipient_user_id: input.recipientUserId,
    p_content: input.content,
  });
  return result as { data: DirectMessage | null; error: any };
}

export async function markDirectConversationRead(conversationId: string) {
  return supabase.rpc("mark_direct_conversation_read", {
    p_conversation_id: conversationId,
  });
}

export async function fetchRoomInvitationInbox() {
  const result = await supabase.rpc("get_room_invitation_inbox");
  return result as {
    data: RoomInvitationInboxItem[] | null;
    error: any;
  };
}

export async function fetchRoomInvitationOutbox(roomId?: string | null) {
  const result = await supabase.rpc("get_room_invitation_outbox", {
    p_room_id: roomId || null,
  });
  return result as { data: RoomInvitationOutboxItem[] | null; error: any };
}

export async function createRoomFriendInvitation(input: {
  roomId: string;
  recipientUserId: string;
  startsAt?: string | null;
  note?: string | null;
}) {
  return supabase.rpc("create_room_friend_invitation", {
    p_room_id: input.roomId,
    p_recipient_user_id: input.recipientUserId,
    p_starts_at: input.startsAt || null,
    p_note: input.note || null,
  });
}

export async function createRoomLinkInvitation(input: {
  roomId: string;
  startsAt?: string | null;
  note?: string | null;
}) {
  return supabase
    .rpc("create_room_link_invitation", {
      p_room_id: input.roomId,
      p_starts_at: input.startsAt || null,
      p_note: input.note || null,
    })
    .single<{
      invitation_id: string;
      token: string;
      expires_at: string;
    }>();
}

export async function fetchRoomInviteLinkPreview(token: string) {
  return supabase
    .rpc("get_room_invite_link_preview", {
      p_token: token,
    })
    .maybeSingle<RoomInviteLinkPreview>();
}

export async function acceptRoomInvitation(input: {
  invitationId: string;
  characterId: string;
}) {
  return supabase.rpc("accept_room_invitation", {
    p_invitation_id: input.invitationId,
    p_character_id: input.characterId,
  });
}

export async function acceptRoomInviteLink(input: {
  token: string;
  characterId: string;
}) {
  return supabase.rpc("accept_room_invite_link", {
    p_token: input.token,
    p_character_id: input.characterId,
  });
}

export async function declineRoomInvitation(invitationId: string) {
  return supabase.rpc("decline_room_invitation", {
    p_invitation_id: invitationId,
  });
}

export async function revokeRoomInvitation(invitationId: string) {
  return supabase.rpc("revoke_room_invitation", {
    p_invitation_id: invitationId,
  });
}
