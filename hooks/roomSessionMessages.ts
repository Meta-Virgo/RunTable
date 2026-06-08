import type { Character, Log } from "../types";
import {
  buildRoomActionFailureResult,
  buildRoomLeaveMessage,
  getOldestLog,
  getRoomLeaveCharacterId,
  shouldLoadMoreRoomLogs,
  type RoomSessionActionResult,
} from "./roomSessionModel";

type AddRoomMessage = (input: {
  roomId: string;
  userId: string;
  characterId?: string | null;
  type: Log["type"] | "system";
  content: string;
  recipientId?: string | null;
  meta?: Record<string, any>;
}) => Promise<{ error?: { message?: string } | null }>;

type DeleteRoomMessage = (
  messageId: string
) => Promise<{ error?: { message?: string } | null }>;

type FetchMessagesBefore = (
  roomId: string,
  before: string,
  limit: number
) => Promise<{ data?: any[] | null; error?: any }>;

type MapMessagesToLogs = (
  messages: any[],
  currentUserId?: string
) => Promise<Log[]>;

type GetCurrentUser = () => Promise<{
  error?: unknown;
  data: { user?: { id: string } | null };
}>;

interface RoomMessageContext {
  roomId: string | null;
  userId?: string;
  activeCharId: string;
}

export async function sendRoomSessionLog(input: {
  context: RoomMessageContext;
  type: Log["type"];
  content: string;
  customCharId?: string;
  recipientId?: string | null;
  meta?: Record<string, any>;
  addMessage: AddRoomMessage;
}) {
  if (!input.content.trim() || !input.context.roomId || !input.context.userId) {
    return;
  }

  const targetId = input.customCharId || input.context.activeCharId;
  const characterId = targetId === "pc" ? null : targetId;

  const { error } = await input.addMessage({
    roomId: input.context.roomId,
    userId: input.context.userId,
    characterId,
    type: input.type,
    content: input.content,
    recipientId: input.recipientId,
    meta: input.meta,
  });

  if (error) {
    console.error("Failed to send message:", error);
  }
}

export async function sendRoomLeaveMessage(input: {
  context: RoomMessageContext & {
    isKeeper: boolean;
    userNickname: string;
    characters: Character[];
  };
  adapters: {
    getCurrentUser: GetCurrentUser;
    addMessage: AddRoomMessage;
  };
}) {
  if (!input.context.roomId || !input.context.userId) return;

  const {
    error: userError,
    data: { user },
  } = await input.adapters.getCurrentUser();

  if (!user || userError) return;

  const activeCharacter =
    input.context.activeCharId === "pc"
      ? null
      : input.context.characters.find(
          (character) => character.id === input.context.activeCharId
        );
  const leaveMessage = buildRoomLeaveMessage({
    userNickname: input.context.userNickname,
    isKP: input.context.isKeeper,
    activeCharId: input.context.activeCharId,
    activeCharacterName: activeCharacter?.name,
  });

  if (!leaveMessage) return;

  const { error: msgError } = await input.adapters.addMessage({
    roomId: input.context.roomId,
    userId: user.id,
    characterId: getRoomLeaveCharacterId({
      isKP: input.context.isKeeper,
      activeCharId: input.context.activeCharId,
    }),
    type: "system",
    content: leaveMessage,
  });

  if (msgError) console.error("Failed to send leave message:", msgError);
}

export interface DeleteRoomSessionMessageResult
  extends RoomSessionActionResult {
  deletedMessageId?: string;
}

export async function deleteRoomSessionMessage(input: {
  messageId: string;
  deleteMessage: DeleteRoomMessage;
}): Promise<DeleteRoomSessionMessageResult> {
  const { error } = await input.deleteMessage(input.messageId);

  if (error) {
    console.error("撤回消息失败:", error);
    return buildRoomActionFailureResult("撤回消息失败", error);
  }

  return { ok: true, deletedMessageId: input.messageId };
}

export type OlderRoomLogsRequest =
  | {
      shouldLoad: true;
      roomId: string;
      before: string;
      pageSize: number;
    }
  | { shouldLoad: false };

export function prepareOlderRoomLogsRequest(input: {
  roomId: string | null;
  logs: Log[];
  isLoadingMore: boolean;
  hasMoreLogs: boolean;
  pageSize: number;
}): OlderRoomLogsRequest {
  if (
    !shouldLoadMoreRoomLogs({
      isLoadingMore: input.isLoadingMore,
      hasMoreLogs: input.hasMoreLogs,
      logCount: input.logs.length,
      currentRoomId: input.roomId,
    })
  ) {
    return { shouldLoad: false };
  }

  const oldestLog = getOldestLog(input.logs);
  if (!oldestLog) return { shouldLoad: false };

  if (!oldestLog.createdAt) {
    console.error("Missing createdAt for log:", oldestLog);
    return { shouldLoad: false };
  }

  return {
    shouldLoad: true,
    roomId: input.roomId!,
    before: oldestLog.createdAt,
    pageSize: input.pageSize,
  };
}

export interface OlderRoomLogsResult extends RoomSessionActionResult {
  logs?: Log[];
  hasMoreLogs?: boolean;
}

export async function fetchOlderRoomSessionLogs(input: {
  request: Extract<OlderRoomLogsRequest, { shouldLoad: true }>;
  currentUserId?: string;
  fetchMessagesBefore: FetchMessagesBefore;
  mapMessagesToLogs: MapMessagesToLogs;
}): Promise<OlderRoomLogsResult> {
  try {
    const { data: messages, error } = await input.fetchMessagesBefore(
      input.request.roomId,
      input.request.before,
      input.request.pageSize
    );

    if (error) throw error;

    if (!messages || messages.length === 0) {
      return { ok: true, logs: [], hasMoreLogs: false };
    }

    const logs = await input.mapMessagesToLogs(
      [...messages].reverse(),
      input.currentUserId
    );

    return {
      ok: true,
      logs,
      hasMoreLogs: messages.length === input.request.pageSize,
    };
  } catch (error) {
    console.error("Error loading more logs:", error);
    return { ok: false };
  }
}
