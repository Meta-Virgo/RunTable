import type { Character } from "../types";
import type { RoomMembership } from "../services/roomAuthority";
import {
  deriveRoomAuthority,
  type RoomAuthority,
} from "../services/roomAuthority";
import {
  getJoinRoomBlockMessage,
  getJoinRoomFailureMessage,
} from "../services/roomJoinFeedback";
import {
  buildRoomEnterMessage,
  type JoinRoomSessionInput,
  type JoinRoomSessionResult,
  type RoomSessionRoom,
} from "./roomSessionModel";

interface JoinRoomAdapters {
  fetchRoomById: (roomId: string) => Promise<{ data?: RoomSessionRoom | null }>;
  getCurrentUser: () => Promise<{ data: { user?: { id: string } | null } }>;
  fetchCurrentRoomMembership: (
    roomId: string,
    userId: string
  ) => Promise<{ data?: RoomMembership | null }>;
  joinRoom: (input: {
    roomId: string;
    characterId: string | null;
    password?: string | null;
  }) => Promise<{ data?: RoomMembership | null; error?: { message?: string } | null }>;
  fetchRoomCharacters: (roomId: string) => Promise<{ data?: any[] | null }>;
  fetchRoomMembers: (roomId: string) => Promise<{ data?: RoomMembership[] | null }>;
  mapCharacterRow: (row: any) => Character;
  fetchProfileNickname: (userId: string) => Promise<string | null>;
  addRoomSystemMessage: (
    roomId: string,
    userId: string,
    content: string,
    characterId?: string | null
  ) => Promise<{ error?: { message?: string } | null }>;
}

export interface RoomJoinSessionResult extends JoinRoomSessionResult {
  room?: RoomSessionRoom;
  authority?: RoomAuthority;
  characters?: Character[];
  roomMembers?: RoomMembership[];
}

export async function joinRoomSessionAction({
  input,
  adapters,
  isCurrent,
}: {
  input: JoinRoomSessionInput;
  adapters: JoinRoomAdapters;
  isCurrent: () => boolean;
}): Promise<RoomJoinSessionResult> {
  const { roomId, charId, password, isRestoring = false } = input;
  const cancelIfStale = () =>
    isCurrent() ? null : ({ ok: false, cancelled: true } as const);

  const { data: room } = await adapters.fetchRoomById(roomId);
  const staleAfterRoom = cancelIfStale();
  if (staleAfterRoom) return staleAfterRoom;
  if (!room) return { ok: false };

  const {
    data: { user },
  } = await adapters.getCurrentUser();
  const staleAfterUser = cancelIfStale();
  if (staleAfterUser) return staleAfterUser;

  if (!charId) {
    return { ok: false, message: "请选择角色！" };
  }

  const { data: existingMembership } = user
    ? await adapters.fetchCurrentRoomMembership(roomId, user.id)
    : { data: null };
  const staleAfterMembership = cancelIfStale();
  if (staleAfterMembership) return staleAfterMembership;

  const blockMessage = getJoinRoomBlockMessage(existingMembership);
  if (blockMessage) {
    return { ok: false, message: blockMessage };
  }

  const { data: membership, error: joinError } = await adapters.joinRoom({
    roomId,
    characterId: charId === "pc" ? null : charId,
    password,
  });
  const staleAfterJoin = cancelIfStale();
  if (staleAfterJoin) return staleAfterJoin;

  if (joinError) {
    console.error("Failed to join room:", joinError);
    return {
      ok: false,
      message: getJoinRoomFailureMessage(joinError.message),
    };
  }

  const authority = deriveRoomAuthority({
    userId: user?.id,
    requestedCharacterId: charId,
    room,
    membership,
  });

  const { data: chars } = await adapters.fetchRoomCharacters(roomId);
  const { data: members } = await adapters.fetchRoomMembers(roomId);
  const staleAfterLists = cancelIfStale();
  if (staleAfterLists) return staleAfterLists;

  const characters = (chars || []).map(adapters.mapCharacterRow);
  const roomMembers = (members || []) as RoomMembership[];

  if (!isRestoring && user) {
    const userName = (await adapters.fetchProfileNickname(user.id)) || "User";
    const staleAfterProfile = cancelIfStale();
    if (staleAfterProfile) return staleAfterProfile;

    const myChar = characters.find((character) => character.id === charId);
    const enterMessage = buildRoomEnterMessage({
      userName,
      requestedCharacterId: charId,
      characterName: myChar?.name,
    });

    if (enterMessage) {
      const { error: msgError } = await adapters.addRoomSystemMessage(
        roomId,
        user.id,
        enterMessage,
        charId === "pc" ? null : charId
      );
      if (msgError) {
        console.error("Failed to send enter message:", msgError);
      }

      const staleAfterEnterMessage = cancelIfStale();
      if (staleAfterEnterMessage) return staleAfterEnterMessage;
    }
  }

  return {
    ok: true,
    room,
    authority,
    characters,
    roomMembers,
  };
}
