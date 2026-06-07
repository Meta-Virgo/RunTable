import { supabase } from "../supabase";
import type { Character } from "../types";
import type { RoomMemberRole, RoomMembership } from "./roomAuthority";

export interface RoomMemberPanelItem {
  userId: string;
  role: RoomMemberRole;
  status: "active";
  isOnline: boolean;
  canKick: boolean;
  kickUserId: string | null;
  displayName: string;
  roleLabel: string;
  characterId: string | null;
  characterName: string | null;
}

interface BuildRoomMemberPanelItemsInput {
  memberships: RoomMembership[];
  characters: Character[];
  onlineUsers: Set<string>;
}

export function buildRoomMemberPanelItems({
  memberships,
  characters,
  onlineUsers,
}: BuildRoomMemberPanelItemsInput): RoomMemberPanelItem[] {
  const charactersById = new Map(
    characters.map((character) => [character.id, character])
  );

  return memberships
    .filter((membership) => membership.status === "active")
    .map((membership) => {
      const character = membership.character_id
        ? charactersById.get(membership.character_id)
        : undefined;
      const isKeeper = membership.role === "keeper";
      const characterName = character?.name || null;
      const roleLabel =
        membership.role === "keeper"
          ? "Keeper"
          : membership.role === "observer"
            ? "Observer"
            : "Player";

      return {
        userId: membership.user_id,
        role: membership.role,
        status: "active" as const,
        isOnline: onlineUsers.has(membership.user_id),
        canKick: !isKeeper,
        kickUserId: isKeeper ? null : membership.user_id,
        displayName: isKeeper ? "Keeper" : characterName || roleLabel,
        roleLabel,
        characterId: membership.character_id,
        characterName,
      };
    })
    .sort((a, b) => {
      if (a.role === b.role) return a.displayName.localeCompare(b.displayName);
      if (a.role === "keeper") return -1;
      if (b.role === "keeper") return 1;
      return 0;
    });
}

export function removeRoomMemberByUserId(
  memberships: RoomMembership[],
  userId: string
) {
  return memberships.filter((membership) => membership.user_id !== userId);
}

export async function fetchRoomMembers(roomId: string) {
  return supabase
    .from("room_members")
    .select("room_id, user_id, character_id, role, status")
    .eq("room_id", roomId);
}
