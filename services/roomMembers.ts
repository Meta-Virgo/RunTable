import { supabase } from "../supabase";
export type { RoomMemberPanelItem, RoomMembership } from "./roomAuthority";

export async function fetchRoomMembers(roomId: string) {
  return supabase
    .from("room_members")
    .select("room_id, user_id, character_id, role, status")
    .eq("room_id", roomId);
}
