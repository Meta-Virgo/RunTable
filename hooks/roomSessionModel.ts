import type { Dispatch, SetStateAction } from "react";
import { EMPTY_MODULE_INFO } from "../constants/appState";
import type { Character, Log, ModuleInfo, Room } from "../types";
import type {
  RoomMembership,
  RoomMemberRole,
  RoomMemberStatus,
  RoomMemberPanelItem,
} from "../services/roomAuthority";

export type VoiceConnectionStatus =
  | "idle"
  | "requesting-token"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type RoomSessionRoom = Pick<
  Room,
  | "id"
  | "kp_id"
  | "title"
  | "description"
  | "type"
  | "bg_music_url"
  | "cover_image_url"
> & {
  is_music_playing?: boolean | null;
  music_track_index?: number | null;
};

export interface JoinRoomSessionInput {
  roomId: string;
  charId: string;
  password?: string | null;
  isRestoring?: boolean;
  invitationId?: string;
  inviteToken?: string;
}

export interface RoomSessionActionResult {
  ok: boolean;
  message?: string;
  cancelled?: boolean;
}

export type JoinRoomSessionResult = RoomSessionActionResult;

export interface RoomStoryResult extends RoomSessionActionResult {
  story?: string;
}

export function shouldClearRestoredRoomUrl(result: JoinRoomSessionResult) {
  return !result.ok && !result.cancelled;
}

export interface RoomSessionSnapshot {
  currentRoomId: string | null;
  roomType: "text" | "voice";
  token: string;
  voiceConnectionStatus: VoiceConnectionStatus;
  voiceError: string | null;
  characters: Character[];
  derivedCharacters: Character[];
  logs: Log[];
  hasMoreLogs: boolean;
  isLoadingMore: boolean;
  moduleInfo: ModuleInfo;
  roomPassword: string;
  activeCharId: string;
  isKP: boolean;
  roomRole: RoomMemberRole;
  roomMembershipStatus: RoomMemberStatus | "unknown";
  roomMemberItems: RoomMemberPanelItem[];
  kpId: string | null;
  onlineUsers: Set<string>;
  bgMusicUrl: string | null;
  isMusicPlaying: boolean;
  musicTrackIndex: number;
}

export interface RoomVoiceState {
  token: string;
  voiceConnectionStatus: VoiceConnectionStatus;
  voiceError: string | null;
}

export interface RoomSessionActions {
  restoreRoomFromUrl: () => Promise<void>;
  joinRoomSession: (
    input: JoinRoomSessionInput
  ) => Promise<JoinRoomSessionResult>;
  leaveCurrentRoom: () => Promise<RoomSessionActionResult>;
  addLog: (
    type: Log["type"],
    content: string,
    customCharId?: string,
    recipientId?: string | null,
    meta?: Record<string, any>
  ) => Promise<void>;
  deleteCurrentRoom: () => Promise<RoomSessionActionResult>;
  clearCurrentRoomChat: () => Promise<RoomSessionActionResult>;
  deleteCurrentRoomMessage: (
    messageId: string
  ) => Promise<RoomSessionActionResult>;
  buildCurrentRoomStory: () => Promise<RoomStoryResult>;
  removeRoomCharacter: (characterId: string) => Promise<RoomSessionActionResult>;
  kickRoomMemberByUserId: (
    memberUserId: string
  ) => Promise<RoomSessionActionResult>;
  concludeCurrentRoom: (
    outcomes: Record<string, string>
  ) => Promise<RoomSessionActionResult>;
  updateModuleSettings: (
    info: ModuleInfo,
    password?: string
  ) => Promise<RoomSessionActionResult>;
  updateMusicUrl: (url: string) => Promise<void>;
  updateMusicState: (isPlaying: boolean, trackIndex: number) => Promise<void>;
  loadMoreLogs: () => Promise<void>;
  clearRoomSession: () => void;
}

export interface RoomSessionLocalUpdates {
  replaceCharacters: (update: SetStateAction<Character[]>) => void;
  selectActiveCharacter: Dispatch<SetStateAction<string>>;
  markVoiceConnected: () => void;
  markVoiceReconnecting: () => void;
  markVoiceDisconnected: (message: string) => void;
  markVoiceError: (message: string) => void;
}

export interface UseRoomSessionStateResult {
  snapshot: RoomSessionSnapshot;
  actions: RoomSessionActions;
  localUpdates: RoomSessionLocalUpdates;
}

export function createRoomJoinSequence() {
  let currentSequence = 0;

  return {
    begin: () => {
      currentSequence += 1;
      return currentSequence;
    },
    invalidate: () => {
      currentSequence += 1;
    },
    isCurrent: (sequence: number) => sequence === currentSequence,
  };
}

export interface AppliedRoomSnapshotState {
  currentRoomId: string;
  characters: Character[];
  logs: Log[];
  hasMoreLogs: boolean;
  isLoadingMore: boolean;
  moduleInfo: ModuleInfo;
  roomType: "text" | "voice";
  roomPassword: string;
  activeCharId: string;
  isKP: boolean;
  roomRole: RoomMemberRole;
  roomMembershipStatus: RoomMemberStatus | "unknown";
  roomMembers: RoomMembership[];
  kpId: string | null;
  onlineUsers: Set<string>;
  bgMusicUrl: string | null;
  isMusicPlaying: boolean;
  musicTrackIndex: number;
}

export function buildAppliedRoomSnapshotState(
  room: RoomSessionRoom,
  activeCharacterId: string,
  userIsKP: boolean,
  role: RoomMemberRole = userIsKP ? "keeper" : "player",
  membershipStatus: RoomMemberStatus | "unknown" = "unknown"
): AppliedRoomSnapshotState {
  return {
    currentRoomId: room.id,
    characters: [],
    logs: [],
    hasMoreLogs: true,
    isLoadingMore: false,
    moduleInfo: {
      title: room.title,
      description: room.description || "",
      coverImageUrl: room.cover_image_url || null,
      notes: "",
    },
    roomType: room.type || "text",
    roomPassword: "",
    activeCharId: activeCharacterId,
    isKP: userIsKP,
    roomRole: role,
    roomMembershipStatus: membershipStatus,
    roomMembers: [],
    kpId: room.kp_id,
    onlineUsers: new Set(),
    bgMusicUrl: room.bg_music_url || null,
    isMusicPlaying: room.is_music_playing || false,
    musicTrackIndex: room.music_track_index || 0,
  };
}

export interface ClearedRoomSessionState {
  currentRoomId: string | null;
  roomType: "text" | "voice";
  characters: Character[];
  logs: Log[];
  hasMoreLogs: boolean;
  isLoadingMore: boolean;
  moduleInfo: ModuleInfo;
  roomPassword: string;
  isKP: boolean;
  roomRole: RoomMemberRole;
  roomMembershipStatus: RoomMemberStatus | "unknown";
  roomMembers: RoomMembership[];
  activeCharId: string;
  kpId: string | null;
  bgMusicUrl: string | null;
  isMusicPlaying: boolean;
  musicTrackIndex: number;
  onlineUsers: Set<string>;
}

export function buildClearedRoomSessionState(): ClearedRoomSessionState {
  return {
    currentRoomId: null,
    roomType: "text",
    characters: [],
    logs: [],
    hasMoreLogs: true,
    isLoadingMore: false,
    moduleInfo: EMPTY_MODULE_INFO,
    roomPassword: "",
    isKP: false,
    roomRole: "player",
    roomMembershipStatus: "unknown",
    roomMembers: [],
    activeCharId: "pc",
    kpId: null,
    bgMusicUrl: null,
    isMusicPlaying: false,
    musicTrackIndex: 0,
    onlineUsers: new Set(),
  };
}

export function buildVoiceIdleState(): RoomVoiceState {
  return {
    token: "",
    voiceConnectionStatus: "idle",
    voiceError: null,
  };
}

export function buildVoiceRequestingState(): RoomVoiceState {
  return {
    token: "",
    voiceConnectionStatus: "requesting-token",
    voiceError: null,
  };
}

export function buildVoiceConnectingState(token: string): RoomVoiceState {
  return {
    token,
    voiceConnectionStatus: "connecting",
    voiceError: null,
  };
}

export function buildVoiceConnectedState(token: string): RoomVoiceState {
  return {
    token,
    voiceConnectionStatus: "connected",
    voiceError: null,
  };
}

export function buildVoiceReconnectingState(token: string): RoomVoiceState {
  return {
    token,
    voiceConnectionStatus: "connecting",
    voiceError: null,
  };
}

export function buildVoiceDisconnectedState(
  token: string,
  message: string
): RoomVoiceState {
  return {
    token,
    voiceConnectionStatus: "disconnected",
    voiceError: message,
  };
}

export function buildVoiceRuntimeErrorState(
  token: string,
  message: string
): RoomVoiceState {
  return {
    token,
    voiceConnectionStatus: "error",
    voiceError: message,
  };
}

export function buildVoiceSetupErrorState(message: string): RoomVoiceState {
  return {
    token: "",
    voiceConnectionStatus: "error",
    voiceError: message,
  };
}

export function getVoiceSetupErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to get voice room credentials";
}

export function buildRoomEnterMessage(input: {
  userName: string;
  requestedCharacterId: string;
  characterName?: string;
}) {
  if (input.requestedCharacterId === "pc") {
    return `${input.userName} (守秘人) 进入了房间`;
  }

  if (!input.characterName) return "";

  return `${input.userName} (${input.characterName}) 进入了房间`;
}

export function buildRoomLeaveMessage(input: {
  userNickname?: string;
  isKP: boolean;
  activeCharId: string;
  activeCharacterName?: string;
}) {
  if (input.isKP) {
    return `${input.userNickname || "守秘人"} (守秘人) 离开了房间`;
  }

  if (input.activeCharId === "pc") {
    return `${input.userNickname || "玩家"} 离开了房间`;
  }

  if (!input.activeCharacterName) return "";

  return `${input.userNickname || "某人"} (${input.activeCharacterName}) 离开了房间`;
}

export function getRoomLeaveCharacterId(input: {
  isKP: boolean;
  activeCharId: string;
}) {
  return !input.isKP && input.activeCharId !== "pc" ? input.activeCharId : null;
}

export function buildRoomCharacterRemovedMessage(characterName: string) {
  return `守秘人将 [${characterName}] 移出了房间`;
}

export function buildRoomMemberKickedMessage(characterName?: string) {
  return `守秘人将 [${characterName || "玩家"}] 移出了房间`;
}

export function buildRoomChatClearedMessage() {
  return "守秘人已清空聊天记录";
}

export function buildRoomActionFailureResult(
  prefix: string,
  error: { message?: string } | null | undefined
): RoomSessionActionResult {
  return {
    ok: false,
    message: buildRoomActionFailureMessage(prefix, error),
  };
}

export function buildRoomActionFailureMessage(
  prefix: string,
  error: { message?: string } | null | undefined
) {
  return `${prefix}: ${error?.message || "未知错误"}`;
}

export function removeRoomLogById(logs: Log[], messageId: string) {
  return logs.filter((log) => log.id !== messageId);
}

export function shouldWarnMissingMusicSyncSchema(error: {
  code?: string;
} | null | undefined) {
  return error?.code === "PGRST204";
}

export function getOldestLog(logs: Log[]) {
  return [...logs].sort(
    (a, b) =>
      new Date(a.createdAt || a.timestamp).getTime() -
      new Date(b.createdAt || b.timestamp).getTime()
  )[0];
}

export function shouldLoadMoreRoomLogs(input: {
  isLoadingMore: boolean;
  hasMoreLogs: boolean;
  logCount: number;
  currentRoomId: string | null;
}) {
  return (
    !input.isLoadingMore &&
    input.hasMoreLogs &&
    input.logCount > 0 &&
    Boolean(input.currentRoomId)
  );
}

export function prependOlderRoomLogs(existingLogs: Log[], olderLogs: Log[]) {
  return [...olderLogs, ...existingLogs];
}
