import { supabase } from "../supabase";

export const ROOM_SELECT =
  "id, created_at, kp_id, title, description, status, room_number, has_password, last_active_at, bg_music_url, type, is_music_playing, music_track_index";

export const ROOM_WITH_COUNTS_SELECT = `${ROOM_SELECT}, characters(count), messages(count)`;

export interface RoomActivityCount {
  room_id: string;
  character_count: number;
  message_count: number;
}

export async function fetchRoomById(roomId: string) {
  return supabase.from("rooms").select(ROOM_SELECT).eq("id", roomId).single();
}

export async function fetchVisibleRooms(userId?: string) {
  let query = supabase
    .from("rooms")
    .select(ROOM_WITH_COUNTS_SELECT)
    .order("last_active_at", { ascending: false, nullsFirst: false });

  if (userId) {
    query = query
      .or(`status.eq.open,kp_id.eq.${userId}`)
      .neq("status", "completed");
  } else {
    query = query.eq("status", "open");
  }

  return query;
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

export async function createRoom(input: {
  title: string;
  description: string;
  kpId: string;
  hasPassword: boolean;
  type: "text" | "voice";
}) {
  return supabase
    .from("rooms")
    .insert({
      title: input.title,
      description: input.description,
      kp_id: input.kpId,
      status: "open",
      has_password: input.hasPassword,
      type: input.type,
    })
    .select()
    .single();
}

export async function updateRoomDetails(
  roomId: string,
  details: { title: string; description: string | null }
) {
  return supabase.from("rooms").update(details).eq("id", roomId);
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
}) {
  return supabase.rpc("join_room", {
    p_room_id: input.roomId,
    p_character_id: input.characterId,
    p_password: input.password || null,
  });
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
  return supabase.from("messages").insert({
    room_id: roomId,
    user_id: userId,
    character_id: characterId,
    type: "system",
    content,
  });
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

