import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Log } from "../types";
import {
  clearRoomSessionChat,
  concludeRoomSession,
  deleteRoomSession,
  updateRoomSessionModuleSettings,
  updateRoomSessionMusicState,
  updateRoomSessionMusicUrl,
} from "./roomSessionActions";
import { joinRoomSessionAction } from "./roomSessionJoin";
import {
  kickRoomMemberFromSession,
  removeRoomCharacterFromSession,
} from "./roomSessionMembers";
import {
  deleteRoomSessionMessage,
  fetchOlderRoomSessionLogs,
  prepareOlderRoomLogsRequest,
  sendRoomLeaveMessage,
  sendRoomSessionLog,
} from "./roomSessionMessages";
import { restoreRoomSessionFromUrl } from "./roomSessionRestore";
import {
  createInitialRoomSessionState,
  createRoomSessionStateDispatchers,
  roomSessionReducer,
  type RoomSessionState,
} from "./roomSessionReducer";
import { buildRoomStory } from "./roomSessionStory";
import { createRoomSessionRemoteAdapters } from "./roomSessionRemoteAdapters";
import {
  createRoomRealtimeAdapter,
  useRoomRealtime,
} from "./useRoomRealtime";
import {
  buildRoomMemberPanelItems,
  type RoomMemberRole,
  type RoomMemberStatus,
  type RoomMemberPanelItem,
} from "../services/roomAuthority";
import { useRoomVoiceSession } from "./useRoomVoiceSession";
import {
  buildAppliedRoomSnapshotState,
  buildClearedRoomSessionState,
  buildRoomChatClearedMessage,
  createRoomJoinSequence,
  prependOlderRoomLogs,
  removeRoomLogById,
  type JoinRoomSessionInput,
  type JoinRoomSessionResult,
  type RoomSessionActionResult,
  type RoomSessionActions,
  type RoomSessionLocalUpdates,
  type RoomSessionSnapshot,
  type RoomStoryResult,
  type UseRoomSessionStateResult,
} from "./roomSessionModel";
export type { VoiceConnectionStatus } from "./roomSessionModel";

interface UseRoomSessionStateOptions {
  userId?: string;
  userNickname: string;
  pageSize: number;
  voiceAccessToken?: string;
}

export function useRoomSessionState({
  userId,
  userNickname,
  pageSize,
  voiceAccessToken,
}: UseRoomSessionStateOptions): UseRoomSessionStateResult {
  const [state, dispatch] = useReducer(
    roomSessionReducer,
    undefined,
    createInitialRoomSessionState
  );
  const stateDispatchers = useMemo(
    () => createRoomSessionStateDispatchers(dispatch),
    []
  );
  const remoteAdapters = useMemo(() => createRoomSessionRemoteAdapters(), []);
  const {
    currentRoomId,
    roomType,
    characters,
    logs,
    hasMoreLogs,
    isLoadingMore,
    moduleInfo,
    roomPassword,
    activeCharId,
    isKP,
    roomRole,
    roomMembershipStatus,
    roomMembers,
    kpId,
    onlineUsers,
    bgMusicUrl,
    isMusicPlaying,
    musicTrackIndex,
  } = state;

  const charactersRef = useRef(characters);
  const hasWarnedMusicSchemaRef = useRef(false);
  const joinSequenceRef = useRef(createRoomJoinSequence());
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  const applyRoomSessionState = useCallback(
    (nextState: RoomSessionState) => {
      stateDispatchers.replace(nextState);
    },
    [stateDispatchers]
  );

  const applyRoomSnapshot = useCallback(
    (
      room: Parameters<typeof buildAppliedRoomSnapshotState>[0],
      activeCharacterId: string,
      userIsKP: boolean,
      role: RoomMemberRole = userIsKP ? "keeper" : "player",
      membershipStatus: RoomMemberStatus | "unknown" = "unknown"
    ) => {
      const nextState = buildAppliedRoomSnapshotState(
        room,
        activeCharacterId,
        userIsKP,
        role,
        membershipStatus
      );
      applyRoomSessionState(nextState);
    },
    [applyRoomSessionState]
  );

  const joinRoomSession = useCallback(
    async ({
      roomId,
      charId,
      password,
      isRestoring = false,
    }: JoinRoomSessionInput): Promise<JoinRoomSessionResult> => {
      const joinSequence = joinSequenceRef.current.begin();
      const result = await joinRoomSessionAction({
        input: { roomId, charId, password, isRestoring },
        isCurrent: () => joinSequenceRef.current.isCurrent(joinSequence),
        adapters: remoteAdapters.join,
      });

      if (!result.ok) return result;
      if (!result.room || !result.authority) return { ok: false };

      applyRoomSnapshot(
        result.room,
        result.authority.activeCharacterId,
        result.authority.isKP,
        result.authority.role,
        result.authority.membershipStatus
      );

      if (!isRestoring) {
        const url = new URL(window.location.href);
        url.searchParams.set("room", roomId);
        window.history.pushState({}, "", url);
      }

      stateDispatchers.patch({
        roomMembers: result.roomMembers || [],
        characters: result.characters || [],
      });

      return { ok: true };
    },
    [applyRoomSnapshot, remoteAdapters, stateDispatchers]
  );

  const restoreRoomFromUrl = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");

    const result = await restoreRoomSessionFromUrl({
      roomId,
      adapters: {
        ...remoteAdapters.restore,
        joinRoomSession,
      },
    });

    if (result.action === "clear-url" || result.action === "restored") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [joinRoomSession, remoteAdapters]);

  const clearRoomSession = useCallback(() => {
    joinSequenceRef.current.invalidate();
    const nextState = buildClearedRoomSessionState();
    applyRoomSessionState(nextState);
    window.history.replaceState(null, "", window.location.pathname);
  }, [applyRoomSessionState]);

  const leaveCurrentRoom =
    useCallback(async (): Promise<RoomSessionActionResult> => {
      if (!currentRoomId || !userId) {
        clearRoomSession();
        return { ok: true };
      }

      await sendRoomLeaveMessage({
        context: {
          roomId: currentRoomId,
          userId,
          activeCharId,
          isKeeper: isKP,
          userNickname,
          characters: charactersRef.current,
        },
        adapters: remoteAdapters.leaveMessage,
      });

      clearRoomSession();
      return { ok: true };
    }, [
      activeCharId,
      clearRoomSession,
      currentRoomId,
      isKP,
      userId,
      userNickname,
      remoteAdapters,
    ]);

  const addLog = useCallback(
    async (
      type: Log["type"],
      content: string,
      customCharId?: string,
      recipientId?: string | null,
      meta?: Record<string, any>
    ) => {
      await sendRoomSessionLog({
        context: {
          roomId: currentRoomId,
          userId,
          activeCharId,
        },
        type,
        content,
        customCharId,
        recipientId,
        meta,
        addMessage: remoteAdapters.addLog.addMessage,
      });
    },
    [activeCharId, currentRoomId, remoteAdapters, userId]
  );

  const deleteCurrentRoom =
    useCallback(async (): Promise<RoomSessionActionResult> => {
      const result = await deleteRoomSession({
        roomId: currentRoomId,
        deleteRoom: remoteAdapters.deleteRoom.deleteRoom,
      });

      if (!result.ok) return result;
      clearRoomSession();
      return { ok: true };
    }, [clearRoomSession, currentRoomId, remoteAdapters]);

  const clearCurrentRoomChat =
    useCallback(async (): Promise<RoomSessionActionResult> => {
      const result = await clearRoomSessionChat({
        roomId: currentRoomId,
        deleteRoomMessages: remoteAdapters.clearChat.deleteRoomMessages,
      });

      if (!result.ok) return result;
      stateDispatchers.replaceLogs([]);
      await addLog("system", buildRoomChatClearedMessage());
      return { ok: true };
    }, [addLog, currentRoomId, remoteAdapters, stateDispatchers]);

  const deleteCurrentRoomMessage =
    useCallback(
      async (messageId: string): Promise<RoomSessionActionResult> => {
        const result = await deleteRoomSessionMessage({
          messageId,
          deleteMessage: remoteAdapters.deleteMessage.deleteMessage,
        });

        if (!result.ok) return result;
        stateDispatchers.replaceLogs((prev) =>
          removeRoomLogById(prev, result.deletedMessageId!)
        );
        return { ok: true };
      },
      [remoteAdapters, stateDispatchers]
    );

  const buildCurrentRoomStory =
    useCallback(async (): Promise<RoomStoryResult> => {
      return buildRoomStory({
        roomId: currentRoomId,
        currentUserId: userId,
        ...remoteAdapters.story,
      });
    }, [currentRoomId, remoteAdapters, userId]);

  const removeRoomCharacter = useCallback(
    async (characterId: string): Promise<RoomSessionActionResult> => {
      const currentCharacters = charactersRef.current;
      const result = await removeRoomCharacterFromSession({
        characterId,
        context: {
          roomId: currentRoomId,
          userId,
          activeCharId,
          characters: currentCharacters,
          roomMembers,
        },
        adapters: remoteAdapters.removeCharacter,
      });

      if (result.nextState) {
        stateDispatchers.patch({
          characters: result.nextState.characters,
          roomMembers: result.nextState.roomMembers,
          activeCharId: result.nextState.activeCharId,
        });
      }
      return { ok: result.ok, message: result.message };
    },
    [activeCharId, currentRoomId, remoteAdapters, roomMembers, stateDispatchers, userId]
  );

  const kickRoomMemberByUserId = useCallback(
    async (memberUserId: string): Promise<RoomSessionActionResult> => {
      const currentCharacters = charactersRef.current;
      const result = await kickRoomMemberFromSession({
        memberUserId,
        context: {
          roomId: currentRoomId,
          userId,
          activeCharId,
          characters: currentCharacters,
          roomMembers,
        },
        adapters: remoteAdapters.kickMember,
      });

      if (result.nextState) {
        stateDispatchers.patch({
          characters: result.nextState.characters,
          roomMembers: result.nextState.roomMembers,
          activeCharId: result.nextState.activeCharId,
        });
      }
      return { ok: result.ok, message: result.message };
    },
    [activeCharId, currentRoomId, remoteAdapters, roomMembers, stateDispatchers, userId]
  );

  const concludeCurrentRoom = useCallback(
    async (
      outcomes: Record<string, string>
    ): Promise<RoomSessionActionResult> => {
      const result = await concludeRoomSession({
        roomId: currentRoomId,
        isKeeper: isKP,
        outcomes,
        concludeRoom: remoteAdapters.conclude.concludeRoom,
      });

      if (!result.ok) return result;
      clearRoomSession();
      return { ok: true };
    },
    [clearRoomSession, currentRoomId, isKP, remoteAdapters]
  );

  const updateModuleSettings = useCallback(
    async (
      info: Parameters<RoomSessionActions["updateModuleSettings"]>[0],
      password?: string
    ): Promise<RoomSessionActionResult> => {
      const result = await updateRoomSessionModuleSettings({
        roomId: currentRoomId,
        isKeeper: isKP,
        info: {
          title: info.title,
          description: info.description,
        },
        password,
        ...remoteAdapters.moduleSettings,
      });

      if (!result.ok) return result;
      stateDispatchers.applyModuleSettings(info, password);
      return { ok: true };
    },
    [currentRoomId, isKP, remoteAdapters, stateDispatchers]
  );

  const updateMusicUrl = useCallback(
    async (url: string) => {
      const result = await updateRoomSessionMusicUrl({
        roomId: currentRoomId,
        isKeeper: isKP,
        url,
        updateRoomMusicUrl: remoteAdapters.musicUrl.updateRoomMusicUrl,
      });
      if (!result.ok && result.message) {
        alert(result.message);
      }
    },
    [currentRoomId, isKP, remoteAdapters]
  );

  const updateMusicState = useCallback(
    async (isPlaying: boolean, trackIndex: number) => {
      const result = await updateRoomSessionMusicState({
        roomId: currentRoomId,
        isKeeper: isKP,
        isPlaying,
        trackIndex,
        updateRoomMusicState: remoteAdapters.musicState.updateRoomMusicState,
      });

      if (result.missingMusicSyncSchema && !hasWarnedMusicSchemaRef.current) {
        alert(
          "【系统警告】检测到数据库配置未同步，背景音乐同步功能失效。\n请前往 Supabase 后台刷新 Schema Cache (Settings -> API -> Reload schema cache)。"
        );
        hasWarnedMusicSchemaRef.current = true;
        return;
      }

      if (!result.ok && result.message) {
        console.error(result.message);
      }
    },
    [currentRoomId, isKP, remoteAdapters]
  );

  const loadMoreLogs = useCallback(async () => {
    const request = prepareOlderRoomLogsRequest({
      roomId: currentRoomId,
      logs,
      isLoadingMore,
      hasMoreLogs,
      pageSize,
    });
    if (!request.shouldLoad) return;

    stateDispatchers.patch({ isLoadingMore: true });

    try {
      const result = await fetchOlderRoomSessionLogs({
        request,
        currentUserId: userId,
        ...remoteAdapters.olderLogs,
      });

      if (!result.ok) return;
      if (result.logs && result.logs.length > 0) {
        stateDispatchers.replaceLogs((prev) =>
          prependOlderRoomLogs(prev, result.logs!)
        );
      }
      stateDispatchers.patch({ hasMoreLogs: Boolean(result.hasMoreLogs) });
    } finally {
      stateDispatchers.patch({ isLoadingMore: false });
    }
  }, [
    currentRoomId,
    hasMoreLogs,
    isLoadingMore,
    logs,
    pageSize,
    remoteAdapters,
    stateDispatchers,
    userId,
  ]);

  const voiceSession = useRoomVoiceSession({
    roomType,
    currentRoomId,
    activeCharId,
    userNickname,
    characters,
    voiceAccessToken,
  });
  const derivedCharacters = useMemo(
    () =>
      characters.map((character) => ({
        ...character,
        isOnline: character.user_id
          ? onlineUsers.has(character.user_id)
          : false,
      })),
    [characters, onlineUsers]
  );

  const roomMemberItems: RoomMemberPanelItem[] = useMemo(
    () =>
      buildRoomMemberPanelItems({
        memberships: roomMembers,
        characters: derivedCharacters,
        onlineUsers,
      }),
    [derivedCharacters, onlineUsers, roomMembers]
  );

  const realtimeAdapter = useMemo(
    () =>
      createRoomRealtimeAdapter({
        getCharacters: () => charactersRef.current,
        replaceCharacters: stateDispatchers.replaceCharacters,
        replaceLogs: stateDispatchers.replaceLogs,
        setHasMoreLogs: (hasMoreLogs) =>
          stateDispatchers.patch({ hasMoreLogs }),
        updateModuleInfo: stateDispatchers.updateModuleInfo,
        setBgMusicUrl: (bgMusicUrl) => stateDispatchers.patch({ bgMusicUrl }),
        setIsMusicPlaying: (isMusicPlaying) =>
          stateDispatchers.patch({ isMusicPlaying }),
        setMusicTrackIndex: (musicTrackIndex) =>
          stateDispatchers.patch({ musicTrackIndex }),
        syncPresence: (onlineUsers) => stateDispatchers.patch({ onlineUsers }),
      }),
    [stateDispatchers]
  );

  useRoomRealtime({
    currentRoomId,
    userId,
    userNickname,
    pageSize,
    charactersRef,
    adapter: realtimeAdapter,
    onKicked: clearRoomSession,
    onRoomDeleted: clearRoomSession,
  });

  const snapshot: RoomSessionSnapshot = {
    currentRoomId,
    roomType,
    token: voiceSession.token,
    voiceConnectionStatus: voiceSession.voiceConnectionStatus,
    voiceError: voiceSession.voiceError,
    characters,
    derivedCharacters,
    logs,
    hasMoreLogs,
    isLoadingMore,
    moduleInfo,
    roomPassword,
    activeCharId,
    isKP,
    roomRole,
    roomMembershipStatus,
    roomMemberItems,
    kpId,
    onlineUsers,
    bgMusicUrl,
    isMusicPlaying,
    musicTrackIndex,
  };

  const actions: RoomSessionActions = {
    restoreRoomFromUrl,
    joinRoomSession,
    leaveCurrentRoom,
    addLog,
    deleteCurrentRoom,
    clearCurrentRoomChat,
    deleteCurrentRoomMessage,
    buildCurrentRoomStory,
    removeRoomCharacter,
    kickRoomMemberByUserId,
    concludeCurrentRoom,
    updateModuleSettings,
    updateMusicUrl,
    updateMusicState,
    loadMoreLogs,
    clearRoomSession,
  };

  const localUpdates: RoomSessionLocalUpdates = {
    replaceCharacters: stateDispatchers.replaceCharacters,
    selectActiveCharacter: stateDispatchers.selectActiveCharacter,
    markVoiceConnected: voiceSession.actions.markConnected,
    markVoiceReconnecting: voiceSession.actions.markReconnecting,
    markVoiceDisconnected: voiceSession.actions.markDisconnected,
    markVoiceError: voiceSession.actions.markError,
  };

  return {
    snapshot,
    actions,
    localUpdates,
  };
}
