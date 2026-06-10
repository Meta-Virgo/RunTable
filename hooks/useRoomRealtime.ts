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

interface UseRoomRealtimeOptions {
  currentRoomId: string | null;
  userId?: string;
  userNickname: string;
  pageSize: number;
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

export function useRoomRealtime({
  currentRoomId,
  userId,
  userNickname,
  pageSize,
  charactersRef,
  adapter,
  onKicked,
  onRoomDeleted,
}: UseRoomRealtimeOptions) {
  useEffect(() => {
    if (!currentRoomId || !userId) return;

    const lifecycle = createRealtimeLifecycleGuard();

    const fetchCharacters = async () => {
      const { data: chars } = await fetchRoomCharacters(currentRoomId);
      if (!lifecycle.isActive()) return;
      if (chars) {
        adapter.replaceCharacters(chars.map(mapCharacterRow));
      }
    };
    fetchCharacters();

    const fetchMessages = async () => {
      const { data: msgs, error: msgError } = await fetchLatestMessages(
        currentRoomId,
        pageSize
      );

      if (msgError) {
        console.error("Error fetching messages:", msgError);
      }

      if (!lifecycle.isActive()) return;

      if (msgs && msgs.length > 0) {
        msgs.reverse();
        const formattedLogs = await mapMessagesToLogs(msgs, userId);
        if (!lifecycle.isActive()) return;
        adapter.setHasMoreLogs(msgs.length === pageSize);
        adapter.replaceLogs(formattedLogs);
      } else {
        adapter.replaceLogs([]);
        adapter.setHasMoreLogs(false);
      }
    };
    fetchMessages();

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
        if (!lifecycle.isActive()) return;
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            nickname: userNickname || "User",
          });
        }
      });

    return () => {
      lifecycle.cancel();
      supabase.removeChannel(channel);
    };
  }, [
    adapter,
    charactersRef,
    currentRoomId,
    onKicked,
    onRoomDeleted,
    pageSize,
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
