import { supabase } from "../supabase";

export const ROOM_SELECT =
  "id, created_at, kp_id, title, description, status, room_number, has_password, last_active_at, bg_music_url, type, is_music_playing, music_track_index";

export const ROOM_WITH_COUNTS_SELECT = `${ROOM_SELECT}, characters(count), messages(count)`;

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

export async function assignCharacterToRoom(
  characterId: string,
  roomId: string,
  userId: string
) {
  return supabase
    .from("characters")
    .update({
      room_id: roomId,
      user_id: userId,
    })
    .eq("id", characterId)
    .select();
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

export async function verifyRoomPassword(
  roomId: string,
  password: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_room_password", {
    p_room_id: roomId,
    p_password: password,
  });

  if (error) {
    throw error;
  }

  return data === true;
}
