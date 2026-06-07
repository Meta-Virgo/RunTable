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
