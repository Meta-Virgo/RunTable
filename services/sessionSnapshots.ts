import type { Character } from "../types";
import type { RoomMemberRole } from "./roomAuthority";

export interface SessionCharacterSnapshot {
  id: string;
  roomId: string;
  sessionId: string;
  userId: string;
  characterId: string;
  capturedAt: string;
  snapshot: Character;
}

export function createSessionSnapshots(input: {
  roomId: string;
  sessionId: string;
  endedAt: string;
  characters: Character[];
  activeMemberUserIds: Set<string>;
}): SessionCharacterSnapshot[] {
  return input.characters
    .filter((character) => character.user_id)
    .filter((character) => input.activeMemberUserIds.has(character.user_id!))
    .map((character) => ({
      id: `${input.sessionId}:${character.id}`,
      roomId: input.roomId,
      sessionId: input.sessionId,
      userId: character.user_id!,
      characterId: character.id,
      capturedAt: input.endedAt,
      snapshot: structuredClone(character),
    }));
}

export function listVisibleSnapshots(
  snapshots: SessionCharacterSnapshot[],
  viewer: { role: RoomMemberRole; userId: string }
) {
  if (viewer.role === "keeper") return snapshots;
  return snapshots.filter((snapshot) => snapshot.userId === viewer.userId);
}
