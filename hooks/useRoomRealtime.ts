import { MutableRefObject, useEffect } from "react";
import { supabase } from "../supabase";
import { Character, Log } from "../types";
import { mapCharacterRow, mergeCharacterRow } from "../utils/characterMapper";
import {
  fetchLatestMessages,
  mapMessagesToLogs,
  mapRealtimeMessageToLog,
} from "../services/messages";
import { fetchRoomCharacters } from "../services/rooms";

const RECONNECT_DELAYS_MS = [2000, 4000, 8000, 15000];
const FALLBACK_POLL_INTERVAL_MS = 4000;

interface UseRoomRealtimeOptions {
  currentRoomId: string | null;
  userId?: string;
  userNickname: string;
  pageSize: number;
  skipInitialFetch?: boolean;
  charactersRef: MutableRefObject<Character[]>;
  adapter: RoomRealtimeAdapter;
  onKicked: () => void;
  onRoomDeleted: () => void;
}

export interface RoomRealtimeAdapter {
  replaceCharacters: (characters: Character[]) => void;
  upsertCharacter: (character: Character) => void;
  mergeCharacter: (row: any) => void;
  replaceLogs: (logs: Log[]) => void;
  mergeLogs: (logs: Log[]) => void;
  appendLog: (log: Log) => void;
  removeLog: (logId: string) => void;
  setHasMoreLogs: (hasMore: boolean) => void;
  applyRoomPatch: (room: any) => void;
  syncPresence: (userIds: Set<string>) => void;
}

export function isKickMessageForUser(message: any, userId: string) {
  return (
    message.type === "system" &&
    message.meta?.type === "kick" &&
    message.meta?.userId === userId
  );
}

export function createRealtimeLifecycleGuard() {
  let active = true;

  return {
    isActive: () => active,
    cancel: () => {
      active = false;
    },
  };
}

export function getRealtimeReconnectDelayMs(attempt: number) {
  const index = Math.min(
    Math.max(0, attempt),
    RECONNECT_DELAYS_MS.length - 1
  );
  return RECONNECT_DELAYS_MS[index];
}

export function mergeFetchedLogs(previous: Log[], incoming: Log[]): Log[] {
  if (incoming.length === 0) return previous;
  if (previous.length === 0) return incoming;

  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = previous.map((item) => incomingById.get(item.id) || item);
  const existingIds = new Set(previous.map((item) => item.id));

  let hasAdditions = false;
  for (const item of incoming) {
    if (!existingIds.has(item.id)) {
      merged.push(item);
      hasAdditions = true;
    }
  }

  if (!hasAdditions) {
    return previous;
  }

  return merged.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

export function useRoomRealtime({
  currentRoomId,
  userId,
  userNickname,
  pageSize,
  skipInitialFetch = false,
  charactersRef,
  adapter,
  onKicked,
  onRoomDeleted,
}: UseRoomRealtimeOptions) {
  useEffect(() => {
    if (!currentRoomId || !userId) return;

    const lifecycle = createRealtimeLifecycleGuard();
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;
    let hasSubscribedOnce = false;
    let isChannelHealthy = false;
    let isSyncingMessages = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const stopFallbackPolling = () => {
      if (fallbackPollTimer !== null) {
        clearInterval(fallbackPollTimer);
        fallbackPollTimer = null;
      }
    };

    const fetchCharacters = async () => {
      const { data: chars } = await fetchRoomCharacters(currentRoomId);
      if (!lifecycle.isActive()) return;
      if (chars) {
        adapter.replaceCharacters(chars.map(mapCharacterRow));
      }
    };

    const syncLatestMessages = async (mode: "replace" | "merge") => {
      if (isSyncingMessages || !lifecycle.isActive()) return;
      isSyncingMessages = true;

      try {
        const { data: msgs, error: msgError } = await fetchLatestMessages(
          currentRoomId,
          pageSize
        );

        if (msgError) {
          console.error("Error fetching messages:", msgError);
          return;
        }

        if (!lifecycle.isActive()) return;

        if (msgs && msgs.length > 0) {
          const ordered = [...msgs].reverse();
          const formattedLogs = await mapMessagesToLogs(ordered, userId);
          if (!lifecycle.isActive()) return;
          if (mode === "replace") {
            adapter.setHasMoreLogs(msgs.length === pageSize);
            adapter.replaceLogs(formattedLogs);
          } else {
            adapter.mergeLogs(formattedLogs);
          }
        } else if (mode === "replace") {
          adapter.replaceLogs([]);
          adapter.setHasMoreLogs(false);
        }
      } finally {
        isSyncingMessages = false;
      }
    };

    const startFallbackPolling = () => {
      if (fallbackPollTimer !== null || !lifecycle.isActive()) return;
      fallbackPollTimer = setInterval(() => {
        if (
          !lifecycle.isActive() ||
          isChannelHealthy ||
          (typeof document !== "undefined" &&
            document.visibilityState === "hidden")
        ) {
          return;
        }
        void syncLatestMessages("merge");
      }, FALLBACK_POLL_INTERVAL_MS);
    };

    if (!skipInitialFetch) {
      void fetchCharacters();
      void syncLatestMessages("replace");
    }

    const scheduleReconnect = () => {
      if (!lifecycle.isActive() || reconnectTimer !== null) return;
      const delay = getRealtimeReconnectDelayMs(reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!lifecycle.isActive()) return;
        subscribeToRoomChannel();
      }, delay);
    };

    const subscribeToRoomChannel = () => {
      if (!lifecycle.isActive()) return;

      if (currentChannel) {
        const staleChannel = currentChannel;
        currentChannel = null;
        void supabase.removeChannel(staleChannel);
      }

      const channel = supabase
        .channel(`room:${currentRoomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${currentRoomId}`,
          },
          async (payload) => {
            if (!lifecycle.isActive()) return;
            const msg = payload.new as any;

            if (isKickMessageForUser(msg, userId)) {
              alert("你已被移出房间");
              onKicked();
              return;
            }

            const newLog = await mapRealtimeMessageToLog(
              msg,
              userId,
              charactersRef.current
            );

            if (!lifecycle.isActive()) return;
            adapter.appendLog(newLog);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "characters",
            filter: `room_id=eq.${currentRoomId}`,
          },
          (payload) => {
            if (!lifecycle.isActive()) return;
            const newChar = payload.new as any;
            adapter.upsertCharacter(mapCharacterRow(newChar));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "characters",
            filter: `room_id=eq.${currentRoomId}`,
          },
          (payload) => {
            if (!lifecycle.isActive()) return;
            const newChar = payload.new as any;
            adapter.mergeCharacter(newChar);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${currentRoomId}`,
          },
          (payload) => {
            if (!lifecycle.isActive()) return;
            const deletedId = payload.old.id;
            adapter.removeLog(deletedId);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${currentRoomId}`,
          },
          () => {
            if (!lifecycle.isActive()) return;
            alert("房间已被房主解散");
            onRoomDeleted();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${currentRoomId}`,
          },
          (payload) => {
            if (!lifecycle.isActive()) return;
            const newRoom = payload.new as any;
            adapter.applyRoomPatch(newRoom);
          }
        )
        .on("presence", { event: "sync" }, () => {
          if (!lifecycle.isActive()) return;
          const newState = channel.presenceState();
          const userIds = new Set<string>();
          for (const id in newState) {
            (newState[id] as any[]).forEach((presence) => {
              if (presence.user_id) userIds.add(presence.user_id);
            });
          }
          adapter.syncPresence(userIds);
        })
        .subscribe(async (status) => {
          if (!lifecycle.isActive() || currentChannel !== channel) return;

          if (status === "SUBSCRIBED") {
            const isReconnect = hasSubscribedOnce;
            hasSubscribedOnce = true;
            isChannelHealthy = true;
            reconnectAttempt = 0;
            clearReconnectTimer();
            stopFallbackPolling();

            await channel.track({
              user_id: userId,
              nickname: userNickname || "User",
            });

            if (isReconnect) {
              void syncLatestMessages("merge");
              void fetchCharacters();
            }
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            isChannelHealthy = false;
            startFallbackPolling();
            scheduleReconnect();
          }
        });

      currentChannel = channel;
    };

    subscribeToRoomChannel();

    const handleResumeSync = () => {
      if (!lifecycle.isActive()) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      void syncLatestMessages("merge");
      if (!isChannelHealthy) {
        clearReconnectTimer();
        subscribeToRoomChannel();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleResumeSync);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleResumeSync);
    }

    return () => {
      lifecycle.cancel();
      clearReconnectTimer();
      stopFallbackPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleResumeSync);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleResumeSync);
      }
      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
        currentChannel = null;
      }
    };
  }, [
    adapter,
    charactersRef,
    currentRoomId,
    onKicked,
    onRoomDeleted,
    pageSize,
    skipInitialFetch,
    userId,
    userNickname,
  ]);
}

export function createRoomRealtimeAdapter(input: {
  getCharacters: () => Character[];
  replaceCharacters: (updater: (previous: Character[]) => Character[]) => void;
  replaceLogs: (updater: (previous: Log[]) => Log[]) => void;
  setHasMoreLogs: (hasMore: boolean) => void;
  updateModuleInfo: (updater: (previous: any) => any) => void;
  setBgMusicUrl: (url: string | null) => void;
  setIsMusicPlaying: (isPlaying: boolean) => void;
  setMusicTrackIndex: (trackIndex: number) => void;
  syncPresence: (userIds: Set<string>) => void;
}): RoomRealtimeAdapter {
  return {
    replaceCharacters: (characters) => input.replaceCharacters(() => characters),
    upsertCharacter: (character) => {
      input.replaceCharacters((previous) => {
        if (previous.some((item) => item.id === character.id)) return previous;
        return [...previous, character];
      });
    },
    mergeCharacter: (row) => {
      const exists = input
        .getCharacters()
        .some((character) => character.id === row.id);

      if (exists) {
        input.replaceCharacters((previous) =>
          previous.map((character) =>
            character.id === row.id ? mergeCharacterRow(character, row) : character
          )
        );
        return;
      }

      input.replaceCharacters((previous) => [...previous, mapCharacterRow(row)]);
    },
    replaceLogs: (logs) => input.replaceLogs(() => logs),
    mergeLogs: (logs) => {
      input.replaceLogs((previous) => mergeFetchedLogs(previous, logs));
    },
    appendLog: (log) => {
      input.replaceLogs((previous) => {
        if (previous.some((item) => item.id === log.id)) return previous;
        return [...previous, log];
      });
    },
    removeLog: (logId) => {
      input.replaceLogs((previous) => previous.filter((log) => log.id !== logId));
    },
    setHasMoreLogs: input.setHasMoreLogs,
    applyRoomPatch: (room) => {
      if (room.bg_music_url !== undefined) {
        input.setBgMusicUrl(room.bg_music_url);
      }
      if (room.is_music_playing !== undefined) {
        input.setIsMusicPlaying(room.is_music_playing);
      }
      if (room.music_track_index !== undefined) {
        input.setMusicTrackIndex(room.music_track_index);
      }
      input.updateModuleInfo((previous) => ({
        ...previous,
        title: room.title !== undefined ? room.title : previous.title,
        description:
          room.description !== undefined ? room.description : previous.description,
        coverImageUrl:
          room.cover_image_url !== undefined
            ? room.cover_image_url
            : previous.coverImageUrl,
      }));
    },
    syncPresence: input.syncPresence,
  };
}
