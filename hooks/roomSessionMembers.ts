import type { Character } from "../types";
import type { RoomMembership } from "../services/roomAuthority";
import {
  applyRoomMemberRemovedLocally,
  buildRoomActionFailureResult,
  buildRoomCharacterRemovedMessage,
  buildRoomMemberKickedMessage,
  type RoomSessionActionResult,
} from "./roomSessionModel";

type AddSystemMessage = (input: {
  roomId: string;
  userId: string;
  type: "system";
  content: string;
  meta?: Record<string, any>;
}) => Promise<unknown>;

interface RoomSessionMemberActionContext {
  roomId: string | null;
  userId?: string;
  activeCharId: string;
  characters: Character[];
  roomMembers: RoomMembership[];
}

interface RemoveRoomCharacterAdapters {
  kickRoomMember: (roomId: string, userId: string) => Promise<unknown>;
  removeCharacterFromRoom: (
    characterId: string
  ) => Promise<{ error?: { message?: string } | null }>;
  addMessage: AddSystemMessage;
}

interface KickRoomMemberAdapters {
  kickRoomMember: (roomId: string, userId: string) => Promise<unknown>;
  addMessage: AddSystemMessage;
}

export interface RoomMemberActionResult extends RoomSessionActionResult {
  nextState?: ReturnType<typeof applyRoomMemberRemovedLocally>;
}

export async function removeRoomCharacterFromSession({
  characterId,
  context,
  adapters,
}: {
  characterId: string;
  context: RoomSessionMemberActionContext;
  adapters: RemoveRoomCharacterAdapters;
}): Promise<RoomMemberActionResult> {
  if (!characterId || !context.roomId || !context.userId) return { ok: false };

  const character = context.characters.find((item) => item.id === characterId);
  if (!character) return { ok: false };

  if (character.user_id) {
    try {
      await adapters.kickRoomMember(context.roomId, character.user_id);
    } catch (error: any) {
      console.error("移出失败:", error);
      return buildRoomActionFailureResult("移出失败", error);
    }

    await adapters.addMessage({
      roomId: context.roomId,
      userId: context.userId,
      type: "system",
      content: buildRoomCharacterRemovedMessage(character.name),
      meta: { type: "kick", userId: character.user_id },
    });
  } else {
    const { error } = await adapters.removeCharacterFromRoom(characterId);

    if (error) {
      console.error("移出失败:", error);
      return buildRoomActionFailureResult("移出失败", error);
    }
  }

  return {
    ok: true,
    nextState: applyRoomMemberRemovedLocally({
      characters: context.characters,
      roomMembers: context.roomMembers,
      activeCharId: context.activeCharId,
      removedCharacterId: characterId,
      removedUserId: character.user_id,
    }),
  };
}

export async function kickRoomMemberFromSession({
  memberUserId,
  context,
  adapters,
}: {
  memberUserId: string;
  context: RoomSessionMemberActionContext;
  adapters: KickRoomMemberAdapters;
}): Promise<RoomMemberActionResult> {
  if (!memberUserId || !context.roomId || !context.userId) return { ok: false };

  const membership = context.roomMembers.find(
    (item) => item.user_id === memberUserId && item.status === "active"
  );
  if (!membership || membership.role === "keeper") return { ok: false };

  const character = membership.character_id
    ? context.characters.find((item) => item.id === membership.character_id)
    : undefined;

  try {
    await adapters.kickRoomMember(context.roomId, memberUserId);
  } catch (error: any) {
    console.error("移出失败:", error);
    return buildRoomActionFailureResult("移出失败", error);
  }

  await adapters.addMessage({
    roomId: context.roomId,
    userId: context.userId,
    type: "system",
    content: buildRoomMemberKickedMessage(character?.name),
    meta: { type: "kick", userId: memberUserId },
  });

  return {
    ok: true,
    nextState: applyRoomMemberRemovedLocally({
      characters: context.characters,
      roomMembers: context.roomMembers,
      activeCharId: context.activeCharId,
      removedCharacterId: character?.id,
      removedUserId: memberUserId,
    }),
  };
}
