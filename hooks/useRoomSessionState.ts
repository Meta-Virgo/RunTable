import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_MODULE_INFO } from "../constants/appState";
import { Character, Log, ModuleInfo, Room } from "../types";
import { getCurrentUser } from "../services/auth";
import {
  addRoomSystemMessage,
  concludeRoom,
  deleteRoom,
  fetchProfileNickname,
  fetchRoomById,
  fetchRoomCharacters,
  joinRoom as joinRoomRpc,
  kickRoomMember,
  updateRoomMusicState,
  updateRoomMusicUrl,
} from "../services/rooms";
import {
  addMessage,
  deleteMessage,
  deleteRoomMessages,
  fetchMessagesBefore,
  fetchMessagesPage,
  mapMessagesToLogs,
} from "../services/messages";
import { removeCharacterFromRoom } from "../services/characters";
import { mapCharacterRow } from "../utils/characterMapper";
import { buildStoryReport } from "../utils/storyReport";
import { useRoomRealtime } from "./useRoomRealtime";
import {
  ensureMicrophonePermission,
  getVoiceParticipantName,
  requestVoiceToken,
} from "../services/livekit";

export type VoiceConnectionStatus =
  | "idle"
  | "requesting-token"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type RoomSessionRoom = Pick<
  Room,
  "id" | "kp_id" | "title" | "description" | "type" | "bg_music_url"
> & {
  is_music_playing?: boolean | null;
  music_track_index?: number | null;
};

interface JoinRoomSessionInput {
  roomId: string;
  charId: string;
  password?: string | null;
  isRestoring?: boolean;
}

interface JoinRoomSessionResult {
  ok: boolean;
  message?: string;
}

interface RoomSessionActionResult {
  ok: boolean;
  message?: string;
}

interface RoomStoryResult extends RoomSessionActionResult {
  story?: string;
}

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
}: UseRoomSessionStateOptions) {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomType, setRoomType] = useState<"text" | "voice">("text");
  const [token, setToken] = useState("");
  const [voiceConnectionStatus, setVoiceConnectionStatus] =
    useState<VoiceConnectionStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moduleInfo, setModuleInfo] =
    useState<ModuleInfo>(EMPTY_MODULE_INFO);
  const [roomPassword, setRoomPassword] = useState("");
  const [activeCharId, setActiveCharId] = useState("pc");
  const [isKP, setIsKP] = useState(false);
  const [kpId, setKpId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicTrackIndex, setMusicTrackIndex] = useState(0);

  const charactersRef = useRef(characters);
  const hasWarnedMusicSchemaRef = useRef(false);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  const applyRoomSnapshot = useCallback(
    (room: RoomSessionRoom, activeCharacterId: string, userIsKP: boolean) => {
      setModuleInfo({
        title: room.title,
        description: room.description || "",
        notes: "",
      });
      setRoomType(room.type || "text");
      setRoomPassword("");
      setActiveCharId(activeCharacterId);
      setIsKP(userIsKP);
      setKpId(room.kp_id);
      setBgMusicUrl(room.bg_music_url || null);
      setIsMusicPlaying(room.is_music_playing || false);
      setMusicTrackIndex(room.music_track_index || 0);
      setCurrentRoomId(room.id);
    },
    []
  );

  const joinRoomSession = useCallback(
    async ({
      roomId,
      charId,
      password,
      isRestoring = false,
    }: JoinRoomSessionInput): Promise<JoinRoomSessionResult> => {
      const { data: room } = await fetchRoomById(roomId);
      if (!room) return { ok: false };

      const {
        data: { user },
      } = await getCurrentUser();
      const userIsKP = user?.id === room.kp_id;

      if (!charId) {
        return { ok: false, message: "请选择角色！" };
      }

      if (charId === "pc" && !userIsKP) {
        return {
          ok: false,
          message: "权限不足：只有房主才能以守秘人身份进入！",
        };
      }

      const { error: joinError } = await joinRoomRpc({
        roomId,
        characterId: charId === "pc" ? null : charId,
        password,
      });

      if (joinError) {
        console.error("Failed to join room:", joinError);
        const message = joinError.message.includes("Invalid room password")
          ? "密码错误"
          : joinError.message;
        return { ok: false, message: `加入房间失败：${message}` };
      }

      applyRoomSnapshot(room, charId, userIsKP);

      if (!isRestoring) {
        const url = new URL(window.location.href);
        url.searchParams.set("room", roomId);
        window.history.pushState({}, "", url);
      }

      const { data: chars } = await fetchRoomCharacters(roomId);
      if (!chars) return { ok: true };

      const mappedChars = chars.map(mapCharacterRow);
      setCharacters(mappedChars);

      if (!isRestoring && user) {
        const userName = (await fetchProfileNickname(user.id)) || "User";
        const enterMessage =
          charId === "pc"
            ? `${userName} (守秘人) 进入了房间`
            : (() => {
                const myChar = mappedChars.find(
                  (character) => character.id === charId
                );
                return myChar
                  ? `${userName} (${myChar.name}) 进入了房间`
                  : "";
              })();

        if (enterMessage) {
          const { error: msgError } = await addRoomSystemMessage(
            roomId,
            user.id,
            enterMessage,
            charId === "pc" ? null : charId
          );
          if (msgError) {
            console.error("Failed to send enter message:", msgError);
          }
        }
      }

      return { ok: true };
    },
    [applyRoomSnapshot]
  );

  const restoreRoomFromUrl = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");

    if (!roomId) return;

    const { data: room, error } = await fetchRoomById(roomId);
    if (error || !room) {
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    setKpId(room.kp_id);
    setBgMusicUrl(room.bg_music_url || null);
    setRoomType(room.type || "text");
    setIsMusicPlaying(room.is_music_playing || false);
    setMusicTrackIndex(room.music_track_index || 0);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const clearRoomSession = useCallback(() => {
    setCurrentRoomId(null);
    setCharacters([]);
    setLogs([]);
    setModuleInfo(EMPTY_MODULE_INFO);
    setIsKP(false);
    setActiveCharId("pc");
    setBgMusicUrl(null);
    setOnlineUsers(new Set());
    setToken("");
    setVoiceConnectionStatus("idle");
    setVoiceError(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const leaveCurrentRoom =
    useCallback(async (): Promise<RoomSessionActionResult> => {
      if (!currentRoomId || !userId) {
        clearRoomSession();
        return { ok: true };
      }

      const {
        error: userError,
        data: { user },
      } = await getCurrentUser();

      if (user && !userError) {
        const activeCharacter =
          activeCharId === "pc"
            ? null
            : charactersRef.current.find(
                (character) => character.id === activeCharId
              );
        let leaveMessage = "";

        if (isKP) {
          leaveMessage = `${userNickname || "守秘人"} (守秘人) 离开了房间`;
        } else if (activeCharId === "pc") {
          leaveMessage = `${userNickname || "玩家"} 离开了房间`;
        } else if (activeCharacter) {
          leaveMessage = `${userNickname || "某人"} (${activeCharacter.name}) 离开了房间`;
        }

        if (leaveMessage) {
          const { error: msgError } = await addMessage({
            roomId: currentRoomId,
            userId: user.id,
            characterId: !isKP && activeCharId !== "pc" ? activeCharId : null,
            type: "system",
            content: leaveMessage,
          });
          if (msgError) console.error("Failed to send leave message:", msgError);
        }
      }

      clearRoomSession();
      return { ok: true };
    }, [
      activeCharId,
      clearRoomSession,
      currentRoomId,
      isKP,
      userId,
      userNickname,
    ]);

  const addLog = useCallback(
    async (
      type: Log["type"],
      content: string,
      customCharId?: string,
      recipientId?: string | null,
      meta?: Record<string, any>
    ) => {
      if (!content.trim() || !currentRoomId || !userId) return;

      const targetId = customCharId || activeCharId;
      const characterId = targetId === "pc" ? null : targetId;

      const { error } = await addMessage({
        roomId: currentRoomId,
        userId,
        characterId,
        type,
        content,
        recipientId,
        meta,
      });

      if (error) {
        console.error("Failed to send message:", error);
      }
    },
    [activeCharId, currentRoomId, userId]
  );

  const deleteCurrentRoom =
    useCallback(async (): Promise<RoomSessionActionResult> => {
      if (!currentRoomId) return { ok: false };

      const { error } = await deleteRoom(currentRoomId);

      if (error) {
        console.error("Failed to delete room:", error);
        return { ok: false, message: "删除房间失败: " + error.message };
      }

      clearRoomSession();
      return { ok: true };
    }, [clearRoomSession, currentRoomId]);

  const clearCurrentRoomChat =
    useCallback(async (): Promise<RoomSessionActionResult> => {
      if (!currentRoomId) return { ok: false };

      const { error } = await deleteRoomMessages(currentRoomId);

      if (error) {
        console.error("清空聊天记录失败:", error);
        return { ok: false, message: "清空聊天记录失败: " + error.message };
      }

      setLogs([]);
      await addLog("system", "守秘人已清空聊天记录");
      return { ok: true };
    }, [addLog, currentRoomId]);

  const deleteCurrentRoomMessage =
    useCallback(
      async (messageId: string): Promise<RoomSessionActionResult> => {
        const { error } = await deleteMessage(messageId);

        if (error) {
          console.error("撤回消息失败:", error);
          return { ok: false, message: "撤回消息失败: " + error.message };
        }

        setLogs((prev) => prev.filter((log) => log.id !== messageId));
        return { ok: true };
      },
      []
    );

  const buildCurrentRoomStory =
    useCallback(async (): Promise<RoomStoryResult> => {
      if (!currentRoomId) return { ok: false };

      try {
        let allMessages: any[] = [];
        let page = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await fetchMessagesPage(
            currentRoomId,
            page,
            batchSize
          );

          if (error) throw error;

          if (data && data.length > 0) {
            allMessages = [...allMessages, ...data];
            if (data.length < batchSize) hasMore = false;
            page++;
          } else {
            hasMore = false;
          }
        }

        const formattedLogs = await mapMessagesToLogs(allMessages, userId);
        return { ok: true, story: buildStoryReport(formattedLogs) };
      } catch (error) {
        console.error("Error generating story:", error);
        return { ok: false, message: "生成战报失败，请重试。" };
      }
    }, [currentRoomId, userId]);

  const removeRoomCharacter = useCallback(
    async (characterId: string): Promise<RoomSessionActionResult> => {
      if (!characterId || !currentRoomId || !userId) return { ok: false };

      const character = charactersRef.current.find(
        (item) => item.id === characterId
      );
      if (!character) return { ok: false };

      if (character.user_id) {
        try {
          await kickRoomMember(currentRoomId, character.user_id);
        } catch (error: any) {
          console.error("移出失败:", error);
          return { ok: false, message: "移出失败: " + error.message };
        }
      } else {
        const { error } = await removeCharacterFromRoom(characterId);

        if (error) {
          console.error("移出失败:", error);
          return { ok: false, message: "移出失败: " + error.message };
        }
      }

      if (character.user_id) {
        await addMessage({
          roomId: currentRoomId,
          userId,
          type: "system",
          content: `守秘人将 [${character.name}] 移出了房间`,
          meta: { type: "kick", userId: character.user_id },
        });
      }

      setCharacters((prev) => prev.filter((item) => item.id !== characterId));
      if (activeCharId === characterId) setActiveCharId("pc");
      return { ok: true };
    },
    [activeCharId, currentRoomId, userId]
  );

  const concludeCurrentRoom = useCallback(
    async (
      outcomes: Record<string, string>
    ): Promise<RoomSessionActionResult> => {
      if (!currentRoomId || !isKP) return { ok: false };

      const { error } = await concludeRoom(currentRoomId, outcomes);

      if (error) {
        console.error("Error concluding game:", error);
        return { ok: false, message: "结团失败: " + error.message };
      }

      clearRoomSession();
      return { ok: true };
    },
    [clearRoomSession, currentRoomId, isKP]
  );

  const updateMusicUrl = useCallback(
    async (url: string) => {
      if (!currentRoomId || !isKP) return;

      const { error } = await updateRoomMusicUrl(currentRoomId, url);
      if (error) {
        console.error("Failed to update background music:", error);
        alert(
          `更新背景音乐失败: ${error.message || JSON.stringify(error)}`
        );
      }
    },
    [currentRoomId, isKP]
  );

  const updateMusicState = useCallback(
    async (isPlaying: boolean, trackIndex: number) => {
      if (!currentRoomId || !isKP) return;

      const { error } = await updateRoomMusicState(
        currentRoomId,
        isPlaying,
        trackIndex
      );

      if (error) {
        console.error("Failed to update music state:", error);
        if (error.code === "PGRST204") {
          console.warn(
            "PGRST204 Error: The 'is_music_playing' column is missing in Supabase schema cache. Please reload the schema cache in Supabase Dashboard."
          );
          if (!hasWarnedMusicSchemaRef.current) {
            alert(
              "【系统警告】检测到数据库配置未同步，背景音乐同步功能失效。\n请前往 Supabase 后台刷新 Schema Cache (Settings -> API -> Reload schema cache)。"
            );
            hasWarnedMusicSchemaRef.current = true;
          }
        }
      }
    },
    [currentRoomId, isKP]
  );

  const loadMoreLogs = useCallback(async () => {
    if (isLoadingMore || !hasMoreLogs || logs.length === 0 || !currentRoomId) {
      return;
    }

    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(a.createdAt || a.timestamp).getTime() -
        new Date(b.createdAt || b.timestamp).getTime()
    );
    const oldestLog = sortedLogs[0];

    if (!oldestLog) return;

    setIsLoadingMore(true);
    const oldestTime = oldestLog.createdAt;

    if (!oldestTime) {
      console.error("Missing createdAt for log:", oldestLog);
      setIsLoadingMore(false);
      return;
    }

    try {
      const { data: msgs, error: msgError } = await fetchMessagesBefore(
        currentRoomId,
        oldestTime,
        pageSize
      );

      if (msgError) throw msgError;

      if (msgs && msgs.length > 0) {
        msgs.reverse();
        const formattedLogs = await mapMessagesToLogs(msgs, userId);
        setLogs((prev) => [...formattedLogs, ...prev]);

        if (msgs.length < pageSize) {
          setHasMoreLogs(false);
        }
      } else {
        setHasMoreLogs(false);
      }
    } catch (error) {
      console.error("Error loading more logs:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    currentRoomId,
    hasMoreLogs,
    isLoadingMore,
    logs,
    pageSize,
    userId,
  ]);

  const voiceParticipantName = useMemo(
    () => getVoiceParticipantName(activeCharId, userNickname, characters),
    [activeCharId, characters, userNickname]
  );

  useEffect(() => {
    if (roomType === "voice" && currentRoomId && voiceAccessToken) {
      let cancelled = false;

      (async () => {
        setToken("");
        setVoiceConnectionStatus("requesting-token");
        setVoiceError(null);

        try {
          await ensureMicrophonePermission();
          if (cancelled) return;

          const voiceToken = await requestVoiceToken({
            accessToken: voiceAccessToken,
            roomId: currentRoomId,
            activeCharId,
            participantName: voiceParticipantName,
          });
          if (cancelled) return;
          setToken(voiceToken);
          setVoiceConnectionStatus("connecting");
        } catch (e) {
          if (cancelled) return;
          const message =
            e instanceof Error ? e.message : "无法获取语音房间凭证";
          console.error(e);
          console.warn("voice setup failed", {
            roomId: currentRoomId,
            activeCharId,
            message,
          });
          setToken("");
          setVoiceConnectionStatus("error");
          setVoiceError(message);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    setToken("");
    setVoiceConnectionStatus("idle");
    setVoiceError(null);
  }, [
    activeCharId,
    currentRoomId,
    roomType,
    voiceAccessToken,
    voiceParticipantName,
  ]);

  useRoomRealtime({
    currentRoomId,
    userId,
    userNickname,
    pageSize,
    charactersRef,
    setCharacters,
    setLogs,
    setHasMoreLogs,
    setModuleInfo,
    setBgMusicUrl,
    setIsMusicPlaying,
    setMusicTrackIndex,
    setOnlineUsers,
    onKicked: clearRoomSession,
    onRoomDeleted: clearRoomSession,
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

  return {
    currentRoomId,
    setCurrentRoomId,
    roomType,
    setRoomType,
    token,
    setToken,
    voiceConnectionStatus,
    setVoiceConnectionStatus,
    voiceError,
    setVoiceError,
    characters,
    setCharacters,
    charactersRef,
    derivedCharacters,
    logs,
    setLogs,
    hasMoreLogs,
    isLoadingMore,
    loadMoreLogs,
    moduleInfo,
    setModuleInfo,
    roomPassword,
    setRoomPassword,
    activeCharId,
    setActiveCharId,
    isKP,
    setIsKP,
    kpId,
    setKpId,
    onlineUsers,
    setOnlineUsers,
    bgMusicUrl,
    setBgMusicUrl,
    isMusicPlaying,
    setIsMusicPlaying,
    musicTrackIndex,
    setMusicTrackIndex,
    applyRoomSnapshot,
    restoreRoomFromUrl,
    joinRoomSession,
    leaveCurrentRoom,
    addLog,
    deleteCurrentRoom,
    clearCurrentRoomChat,
    deleteCurrentRoomMessage,
    buildCurrentRoomStory,
    removeRoomCharacter,
    concludeCurrentRoom,
    updateMusicUrl,
    updateMusicState,
    clearRoomSession,
  };
}
