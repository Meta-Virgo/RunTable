import type { Character, Room } from "../types";

export type RoomFilter = "all" | "mine" | "created" | "kp_online";
export type LobbySortMode = "activity" | "room_number";

export interface LobbyRoomActivityCount {
  room_id: string;
  character_count: number;
  message_count: number;
}

export type LobbyRoom = Room & {
  isZombie?: boolean;
  isArchived?: boolean;
  characterCount?: number;
  messageCount?: number;
  activeMemberCount?: number;
  activeMemberIds?: string[];
  characters?: Array<{ count?: number }>;
  messages?: Array<{ count?: number }>;
};

export function sortLobbyCatalogRooms(
  rooms: LobbyRoom[],
  sortMode: LobbySortMode
) {
  return [...rooms].sort((a, b) => {
    if (a.isZombie !== b.isZombie) return a.isZombie ? 1 : -1;

    if (sortMode === "room_number") {
      const aRoomNumber =
        typeof a.room_number === "number"
          ? a.room_number
          : Number.POSITIVE_INFINITY;
      const bRoomNumber =
        typeof b.room_number === "number"
          ? b.room_number
          : Number.POSITIVE_INFINITY;

      if (aRoomNumber !== bRoomNumber) {
        return aRoomNumber - bRoomNumber;
      }
    }

    const lastActiveDiff =
      new Date(b.last_active_at || b.created_at).getTime() -
      new Date(a.last_active_at || a.created_at).getTime();

    return (
      lastActiveDiff ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      a.id.localeCompare(b.id)
    );
  });
}

export function buildLobbyCatalogRooms(input: {
  rooms: LobbyRoom[];
  activityCounts: Map<string, LobbyRoomActivityCount>;
  memberUserIds?: Map<string, string[]>;
  now?: number;
}) {
  const now = input.now ?? Date.now();

  const processed = input.rooms.map((room) => {
    const activity = input.activityCounts.get(room.id);
    const characterCount =
      activity?.character_count ?? room.characters?.[0]?.count ?? 2;
    const messageCount =
      activity?.message_count ?? room.messages?.[0]?.count ?? 5;
    const activeMemberIds = input.memberUserIds?.get(room.id) ?? room.activeMemberIds;
    const activeMemberCount =
      activeMemberIds?.length ?? room.activeMemberCount ?? characterCount;
    const createdAt = new Date(room.created_at).getTime();
    const lastActive = room.last_active_at
      ? new Date(room.last_active_at).getTime()
      : createdAt;
    const isZombie =
      now - createdAt > 24 * 60 * 60 * 1000 &&
      characterCount <= 1 &&
      messageCount < 5;
    const isArchived = now - lastActive > 7 * 24 * 60 * 60 * 1000;

    return {
      ...room,
      characterCount,
      messageCount,
      activeMemberCount,
      activeMemberIds,
      isZombie,
      isArchived,
      last_active_at: room.last_active_at || room.created_at,
    };
  });

  return sortLobbyCatalogRooms(processed, "activity");
}

export function filterLobbyCatalogRooms(input: {
  rooms: LobbyRoom[];
  searchQuery: string;
  roomFilter: RoomFilter;
  characterRoomIds: Set<string | null | undefined>;
  currentUserId: string | null;
  onlineUsers: Set<string>;
}) {
  const query = input.searchQuery.toLowerCase();

  return input.rooms.filter((room) => {
    const matchesSearch =
      room.title.toLowerCase().includes(query) ||
      Boolean(room.description?.toLowerCase().includes(query)) ||
      Boolean(room.room_number && String(room.room_number).includes(query)) ||
      Boolean(
        room.room_number && `#${room.room_number}`.toLowerCase().includes(query)
      );

    if (!matchesSearch) return false;

    if (input.roomFilter === "all") return !room.isArchived;
    if (input.roomFilter === "mine") return input.characterRoomIds.has(room.id);
    if (input.roomFilter === "created") return room.kp_id === input.currentUserId;
    if (input.roomFilter === "kp_online") {
      return input.onlineUsers.has(room.kp_id);
    }

    return true;
  });
}

export function getLobbyCharacterRoomIds(
  characters: Pick<Character, "room_id">[]
) {
  return new Set(
    characters
      .map((character) => character.room_id)
      .filter(Boolean)
  ) as Set<string>;
}

export function applyLobbyCatalogRoomChange(input: {
  rooms: LobbyRoom[];
  eventType: "INSERT" | "UPDATE" | "DELETE";
  newRoom?: LobbyRoom | null;
  oldRoom?: Pick<LobbyRoom, "id"> | null;
  now?: number;
}) {
  if (input.eventType === "DELETE") {
    if (!input.oldRoom?.id) return input.rooms;
    return input.rooms.filter((room) => room.id !== input.oldRoom?.id);
  }

  if (!input.newRoom) return input.rooms;

  const nextRoom = buildLobbyCatalogRooms({
    rooms: [input.newRoom],
    activityCounts: new Map(),
    now: input.now,
  })[0];

  if (nextRoom.status !== "open") {
    return input.rooms.filter((room) => room.id !== nextRoom.id);
  }

  const exists = input.rooms.some((room) => room.id === nextRoom.id);
  const nextRooms = exists
    ? input.rooms.map((room) =>
        room.id === nextRoom.id ? { ...room, ...nextRoom } : room
      )
    : [nextRoom, ...input.rooms];

  return buildLobbyCatalogRooms({
    rooms: nextRooms,
    activityCounts: new Map(),
    now: input.now,
  });
}
