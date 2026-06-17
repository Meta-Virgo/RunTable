import { supabase } from "../supabase";
import type { RoomMembership } from "./roomAuthority";

export function isMissingLobbyBootstrapError(error: unknown) {
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
    text.includes("get_lobby_catalog_bootstrap")
  );
}

export const ROOM_SELECT =
  "id, created_at, kp_id, title, description, status, room_number, has_password, last_active_at, bg_music_url, cover_image_url, type, is_music_playing, music_track_index";

export const ROOM_WITH_COUNTS_SELECT = `${ROOM_SELECT}, characters(count), messages(count)`;

const LEGACY_ROOM_SELECT =
  "id, created_at, kp_id, title, description, status, room_number, has_password, last_active_at, bg_music_url, type, is_music_playing, music_track_index";

const LEGACY_ROOM_WITH_COUNTS_SELECT = `${LEGACY_ROOM_SELECT}, characters(count), messages(count)`;

export interface RoomActivityCount {
  room_id: string;
  character_count: number;
  message_count: number;
}

export interface RoomMemberUserId {
  room_id: string;
  user_id: string;
}

function isMissingCoverImageColumnError(error: unknown) {
  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const text = [
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    maybeError?.code === "42703" ||
    maybeError?.code === "PGRST204" ||
    text.includes("cover_image_url")
  );
}

function isMissingRoomMemberUserIdsSupportError(error: unknown) {
  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
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
    maybeError?.code === "42P01" ||
    text.includes("get_room_member_user_ids") ||
    text.includes("room_members")
  );
}

export async function fetchRoomById(roomId: string) {
  const result = await supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .eq("id", roomId)
    .single();

  if (!result.error || !isMissingCoverImageColumnError(result.error)) {
    return result;
  }

  return supabase
    .from("rooms")
    .select(LEGACY_ROOM_SELECT)
    .eq("id", roomId)
    .single();
}

export async function fetchVisibleRooms(userId?: string) {
  const runQuery = (select: string) => {
    let query = supabase
      .from("rooms")
      .select(select)
      .order("last_active_at", { ascending: false, nullsFirst: false });

    if (userId) {
      query = query
        .or(`status.eq.open,kp_id.eq.${userId}`)
        .neq("status", "completed");
    } else {
      query = query.eq("status", "open");
    }

    return query;
  };

  const result = await runQuery(ROOM_WITH_COUNTS_SELECT);

  if (!result.error || !isMissingCoverImageColumnError(result.error)) {
    return result;
  }

  return runQuery(LEGACY_ROOM_WITH_COUNTS_SELECT);
}

export async function fetchLobbyCatalogBootstrap(includePrivate: boolean) {
  return supabase.rpc("get_lobby_catalog_bootstrap", {
    p_include_private: includePrivate,
  });
}

export async function fetchRoomActivityCounts(roomIds: string[]) {
  if (roomIds.length === 0) return new Map<string, RoomActivityCount>();

  const { data, error } = await supabase.rpc("get_room_activity_counts", {
    p_room_ids: roomIds,
  });

  if (error) {
    console.warn("Failed to fetch room activity counts:", error);
    return new Map<string, RoomActivityCount>();
  }

  return new Map(
    ((data || []) as RoomActivityCount[]).map((count) => [
      count.room_id,
      count,
    ])
  );
}

export async function fetchRoomMemberUserIds(roomIds: string[]) {
  if (roomIds.length === 0) return new Map<string, string[]>();

  const { data, error } = await supabase.rpc("get_room_member_user_ids", {
    p_room_ids: roomIds,
  });

  if (error) {
    if (isMissingRoomMemberUserIdsSupportError(error)) {
      return new Map<string, string[]>();
    }

    console.warn("Failed to fetch room member user ids:", error);
    return new Map<string, string[]>();
  }

  return ((data || []) as RoomMemberUserId[]).reduce((roomMembers, item) => {
    const current = roomMembers.get(item.room_id) || [];
    current.push(item.user_id);
    roomMembers.set(item.room_id, current);
    return roomMembers;
  }, new Map<string, string[]>());
}

export async function createRoom(input: {
  title: string;
  description: string;
  coverImageUrl?: string | null;
  kpId: string;
  hasPassword: boolean;
  type: "text" | "voice";
}) {
  const payload = {
    title: input.title,
    description: input.description,
    cover_image_url: input.coverImageUrl || null,
    kp_id: input.kpId,
    status: "open",
    has_password: input.hasPassword,
    type: input.type,
  };

  const result = await supabase
    .from("rooms")
    .insert(payload)
    .select()
    .single();

  if (!result.error || !isMissingCoverImageColumnError(result.error)) {
    return result;
  }

  const legacyPayload = {
    title: payload.title,
    description: payload.description,
    kp_id: payload.kp_id,
    status: payload.status,
    has_password: payload.has_password,
    type: payload.type,
  };

  return supabase.from("rooms").insert(legacyPayload).select().single();
}

export async function updateRoomDetails(
  roomId: string,
  details: {
    title: string;
    description: string | null;
    cover_image_url?: string | null;
  }
) {
  const result = await supabase.from("rooms").update(details).eq("id", roomId);

  if (!result.error || !isMissingCoverImageColumnError(result.error)) {
    return result;
  }

  const legacyDetails = {
    title: details.title,
    description: details.description,
  };

  return supabase.from("rooms").update(legacyDetails).eq("id", roomId);
}

export async function deleteRoom(roomId: string) {
  return supabase.from("rooms").delete().eq("id", roomId);
}

export async function updateRoomMusicUrl(roomId: string, url: string) {
  return supabase.from("rooms").update({ bg_music_url: url }).eq("id", roomId);
}

export async function updateRoomMusicState(
  roomId: string,
  isPlaying: boolean,
  trackIndex: number
) {
  return supabase
    .from("rooms")
    .update({
      is_music_playing: isPlaying,
      music_track_index: trackIndex,
    })
    .eq("id", roomId);
}

export async function updateRoomModule(
  roomId: string,
  updates: Record<string, any>
) {
  return supabase.from("rooms").update(updates).eq("id", roomId);
}

export async function concludeRoom(
  roomId: string,
  outcomes: Record<string, string>
) {
  return supabase.rpc("conclude_game", {
    p_room_id: roomId,
    p_outcomes: outcomes,
  });
}

export async function joinRoom(input: {
  roomId: string;
  characterId: string | null;
  password?: string | null;
  invitationId?: string | null;
  inviteToken?: string | null;
}) {
  if (input.invitationId) {
    return supabase.rpc("accept_room_invitation", {
      p_invitation_id: input.invitationId,
      p_character_id: input.characterId,
    });
  }

  if (input.inviteToken) {
    return supabase.rpc("accept_room_invite_link", {
      p_token: input.inviteToken,
      p_character_id: input.characterId,
    });
  }

  return supabase.rpc("join_room", {
    p_room_id: input.roomId,
    p_character_id: input.characterId,
    p_password: input.password || null,
  });
}

export function isMissingRoomSessionBootstrapError(error: unknown) {
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
    text.includes("join_room_session_bootstrap")
  );
}

export async function joinRoomSessionBootstrap(input: {
  roomId: string;
  characterId: string | null;
  password?: string | null;
  invitationId?: string | null;
  inviteToken?: string | null;
  pageSize: number;
}) {
  return supabase.rpc("join_room_session_bootstrap", {
    p_room_id: input.roomId,
    p_character_id: input.characterId,
    p_password: input.password || null,
    p_invitation_id: input.invitationId || null,
    p_invite_token: input.inviteToken || null,
    p_page_size: input.pageSize,
  });
}

export async function fetchCurrentRoomMembership(
  roomId: string,
  userId: string
) {
  return supabase
    .from("room_members")
    .select("room_id, user_id, character_id, role, status")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle<RoomMembership>();
}

export async function kickRoomMember(roomId: string, userId: string) {
  const { error } = await supabase.rpc("kick_room_member", {
    p_room_id: roomId,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }
}

export async function fetchRoomCharacters(roomId: string) {
  return supabase.from("characters").select("*").eq("room_id", roomId);
}

export async function fetchProfileNickname(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .single();

  return data?.nickname || null;
}

export async function addRoomSystemMessage(
  roomId: string,
  userId: string,
  content: string,
  characterId: string | null = null
) {
  return supabase
    .from("messages")
    .insert({
      room_id: roomId,
      user_id: userId,
      character_id: characterId,
      type: "system",
      content,
    })
    .select()
    .single();
}

export async function setRoomPassword(roomId: string, password: string) {
  const { error } = await supabase.rpc("set_room_password", {
    p_room_id: roomId,
    p_password: password,
  });

  if (error) {
    throw error;
  }
}

