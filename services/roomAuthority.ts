import type { Character } from "../types";

export type RoomMemberRole = "keeper" | "player" | "observer";
export type RoomMemberStatus = "active" | "kicked" | "left";

export interface RoomMembership {
  room_id: string;
  user_id: string;
  character_id: string | null;
  role: RoomMemberRole;
  status: RoomMemberStatus;
}

interface AuthorityRoom {
  id: string;
  kp_id: string;
}

interface DeriveRoomAuthorityInput {
  userId?: string | null;
  requestedCharacterId: string;
  room: AuthorityRoom;
  membership?: RoomMembership | null;
}

export interface RoomAuthority {
  role: RoomMemberRole;
  membershipStatus: RoomMemberStatus | "unknown";
  isKP: boolean;
  canManageRoom: boolean;
  activeCharacterId: string;
}

export interface RestoredRoomEntry {
  roomId: string;
  characterId: string;
}

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

export function getRestoredRoomEntry(
  membership?: RoomMembership | null
): RestoredRoomEntry | null {
  if (!membership || membership.status !== "active") return null;
  if (membership.role === "keeper") {
    return { roomId: membership.room_id, characterId: "pc" };
  }
  if (!membership.character_id) return null;
  return {
    roomId: membership.room_id,
    characterId: membership.character_id,
  };
}

export function deriveRoomAuthority({
  userId,
  requestedCharacterId,
  room,
  membership,
}: DeriveRoomAuthorityInput): RoomAuthority {
  if (
    membership &&
    membership.room_id === room.id &&
    membership.user_id === userId
  ) {
    const isActive = membership.status === "active";
    const isKeeper = isActive && membership.role === "keeper";

    return {
      role: membership.role,
      membershipStatus: membership.status,
      isKP: isKeeper,
      canManageRoom: isKeeper,
      activeCharacterId: isActive
        ? isKeeper
          ? "pc"
          : membership.character_id || requestedCharacterId
        : "pc",
    };
  }

  const isLegacyKeeper = Boolean(userId && userId === room.kp_id);

  return {
    role: isLegacyKeeper ? "keeper" : "player",
    membershipStatus: membership?.status || "unknown",
    isKP: isLegacyKeeper,
    canManageRoom: isLegacyKeeper,
    activeCharacterId: isLegacyKeeper ? "pc" : requestedCharacterId,
  };
}

export function canKickRoomMembership(membership?: RoomMembership | null) {
  return Boolean(
    membership && membership.status === "active" && membership.role !== "keeper"
  );
}

export function findKickableRoomMembership(
  memberships: RoomMembership[],
  userId: string
) {
  const membership = memberships.find(
    (item) => item.user_id === userId && item.status === "active"
  );

  return canKickRoomMembership(membership) ? membership : null;
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

export function applyRoomMemberRemovedLocally(input: {
  characters: Character[];
  roomMembers: RoomMembership[];
  activeCharId: string;
  removedCharacterId?: string | null;
  removedUserId?: string | null;
}) {
  const nextCharacters = input.removedCharacterId
    ? input.characters.filter(
        (character) => character.id !== input.removedCharacterId
      )
    : input.characters;
  const nextRoomMembers = input.removedUserId
    ? removeRoomMemberByUserId(input.roomMembers, input.removedUserId)
    : input.roomMembers;
  const nextActiveCharId =
    input.removedCharacterId && input.activeCharId === input.removedCharacterId
      ? "pc"
      : input.activeCharId;

  return {
    characters: nextCharacters,
    roomMembers: nextRoomMembers,
    activeCharId: nextActiveCharId,
  };
}
