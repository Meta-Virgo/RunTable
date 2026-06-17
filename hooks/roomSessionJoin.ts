import type { Character, Log } from "../types";
import type { RoomMembership } from "../services/roomAuthority";
import {
  deriveRoomAuthority,
  type RoomAuthority,
} from "../services/roomAuthority";
import {
  getJoinRoomBlockMessage,
  getJoinRoomFailureMessage,
} from "../services/roomJoinFeedback";
import { formatMessageTimestamp } from "../services/messages";
import {
  buildRoomEnterMessage,
  type JoinRoomSessionInput,
  type JoinRoomSessionResult,
  type RoomSessionBootstrapSnapshot,
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
    invitationId?: string;
    inviteToken?: string;
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
  joinRoomSessionBootstrap?: (input: {
    roomId: string;
    characterId: string | null;
    password?: string | null;
    invitationId?: string;
    inviteToken?: string;
    pageSize: number;
  }) => Promise<{ data?: RoomSessionBootstrapSnapshot | null; error?: { code?: string; message?: string } | null }>;
  isMissingRoomSessionBootstrapError?: (error: unknown) => boolean;
}

export interface RoomJoinSessionResult extends JoinRoomSessionResult {
  room?: RoomSessionRoom;
  authority?: RoomAuthority;
  characters?: Character[];
  roomMembers?: RoomMembership[];
  logs?: RoomSessionBootstrapSnapshot["logs"];
  hasMoreLogs?: boolean;
}

function normalizeBootstrapLogs(
  logs: RoomSessionBootstrapSnapshot["logs"] | undefined
) {
  return (logs || []).map((log) => ({
    ...log,
    timestamp: log.createdAt
      ? formatMessageTimestamp(log.createdAt)
      : log.timestamp,
  }));
}

export async function joinRoomSessionAction({
  input,
  adapters,
  isCurrent,
  pageSize = 50,
}: {
  input: JoinRoomSessionInput;
  adapters: JoinRoomAdapters;
  isCurrent: () => boolean;
  pageSize?: number;
}): Promise<RoomJoinSessionResult> {
  const { roomId, charId, password, isRestoring = false } = input;
  const cancelIfStale = () =>
    isCurrent() ? null : ({ ok: false, cancelled: true } as const);

  if (adapters.joinRoomSessionBootstrap) {
    const { data: snapshot, error: bootstrapError } =
      await adapters.joinRoomSessionBootstrap({
        roomId,
        characterId: charId === "pc" ? null : charId,
        password,
        invitationId: input.invitationId,
        inviteToken: input.inviteToken,
        pageSize,
      });
    const staleAfterBootstrap = cancelIfStale();
    if (staleAfterBootstrap) return staleAfterBootstrap;

    if (bootstrapError) {
      if (!adapters.isMissingRoomSessionBootstrapError?.(bootstrapError)) {
        console.error("Failed to join room:", bootstrapError);
        return {
          ok: false,
          message: getJoinRoomFailureMessage(bootstrapError.message),
        };
      }
    } else if (snapshot?.room && snapshot?.membership) {
      const authority = deriveRoomAuthority({
        userId: snapshot.user_id || snapshot.membership.user_id,
        requestedCharacterId: charId,
        room: snapshot.room,
        membership: snapshot.membership,
      });
      const characters = (snapshot.characters || []).map(adapters.mapCharacterRow);
      let logs = normalizeBootstrapLogs(snapshot.logs);

      if (!isRestoring && snapshot.user_id) {
        const userName =
          snapshot.user_nickname ||
          (await adapters.fetchProfileNickname(snapshot.user_id)) ||
          "User";
        const staleAfterProfile = cancelIfStale();
        if (staleAfterProfile) return staleAfterProfile;

        const myChar = characters.find((character) => character.id === charId);
        const enterMessage = buildRoomEnterMessage({
          userName,
          requestedCharacterId: charId,
          characterName: myChar?.name,
        });

        if (enterMessage) {
          const { data: enterMessageRow, error: msgError } =
            (await adapters.addRoomSystemMessage(
              snapshot.room.id,
              snapshot.user_id,
              enterMessage,
              charId === "pc" ? null : charId
            )) as {
              data?: any;
              error?: { message?: string } | null;
            };
          if (msgError) {
            console.error("Failed to send enter message:", msgError);
          } else if (enterMessageRow) {
            const enterLog: Log = {
              id: enterMessageRow.id,
              timestamp: formatMessageTimestamp(enterMessageRow.created_at),
              createdAt: enterMessageRow.created_at,
              userId: snapshot.user_id,
              charId: charId === "pc" ? "pc" : charId,
              charName: myChar?.name || userName,
              charRole: charId === "pc" ? "Keeper" : myChar?.role || "Player",
              charAvatar: myChar?.avatar_url,
              type: "system",
              content: enterMessage,
              isMine: true,
              recipientId: null,
            };
            logs = [...logs, enterLog];
          }

          const staleAfterEnterMessage = cancelIfStale();
          if (staleAfterEnterMessage) return staleAfterEnterMessage;
        }
      }

      return {
        ok: true,
        room: snapshot.room,
        authority,
        characters,
        roomMembers: snapshot.room_members || [],
        logs,
        hasMoreLogs: Boolean(snapshot.has_more_logs),
      };
    }
  }

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
    invitationId: input.invitationId,
    inviteToken: input.inviteToken,
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
