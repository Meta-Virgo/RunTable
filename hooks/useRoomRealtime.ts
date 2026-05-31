import { Dispatch, MutableRefObject, SetStateAction, useEffect } from "react";
import { supabase } from "../supabase";
import { Character, Log, ModuleInfo } from "../types";
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
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setLogs: Dispatch<SetStateAction<Log[]>>;
  setHasMoreLogs: Dispatch<SetStateAction<boolean>>;
  setModuleInfo: Dispatch<SetStateAction<ModuleInfo>>;
  setBgMusicUrl: Dispatch<SetStateAction<string | null>>;
  setIsMusicPlaying: Dispatch<SetStateAction<boolean>>;
  setMusicTrackIndex: Dispatch<SetStateAction<number>>;
  setOnlineUsers: Dispatch<SetStateAction<Set<string>>>;
  onKicked: () => void;
  onRoomDeleted: () => void;
}

export function useRoomRealtime({
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
  onKicked,
  onRoomDeleted,
}: UseRoomRealtimeOptions) {
  useEffect(() => {
    if (!currentRoomId || !userId) return;

    const fetchCharacters = async () => {
      const { data: chars } = await fetchRoomCharacters(currentRoomId);
      if (chars) {
        setCharacters(chars.map(mapCharacterRow));
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

      if (msgs && msgs.length > 0) {
        msgs.reverse();
        const formattedLogs = await mapMessagesToLogs(msgs, userId);
        setHasMoreLogs(msgs.length === pageSize);
        setLogs(formattedLogs);
      } else {
        setLogs([]);
        setHasMoreLogs(false);
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
          const msg = payload.new as any;

          if (
            msg.type === "system" &&
            msg.meta?.type === "kick" &&
            msg.meta?.userId === userId
          ) {
            alert("你已被移出房间");
            onKicked();
            return;
          }

          const newLog = await mapRealtimeMessageToLog(
            msg,
            userId,
            charactersRef.current
          );

          setLogs((prev) => {
            if (prev.some((log) => log.id === newLog.id)) return prev;
            return [...prev, newLog];
          });
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
          const newChar = payload.new as any;
          setCharacters((prev) => {
            if (prev.find((character) => character.id === newChar.id)) {
              return prev;
            }
            return [...prev, mapCharacterRow(newChar)];
          });
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
          const newChar = payload.new as any;
          const exists = charactersRef.current.some(
            (character) => character.id === newChar.id
          );

          if (exists) {
            setCharacters((prev) =>
              prev.map((character) =>
                character.id === newChar.id
                  ? mergeCharacterRow(character, newChar)
                  : character
              )
            );
          } else {
            setCharacters((prev) => [...prev, mapCharacterRow(newChar)]);
          }
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
          const deletedId = payload.old.id;
          setLogs((prev) => prev.filter((log) => log.id !== deletedId));
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
          const newRoom = payload.new as any;
          if (newRoom.bg_music_url !== undefined) {
            setBgMusicUrl(newRoom.bg_music_url);
          }
          if (newRoom.is_music_playing !== undefined) {
            setIsMusicPlaying(newRoom.is_music_playing);
          }
          if (newRoom.music_track_index !== undefined) {
            setMusicTrackIndex(newRoom.music_track_index);
          }
          setModuleInfo((prev) => ({
            ...prev,
            title: newRoom.title !== undefined ? newRoom.title : prev.title,
            description:
              newRoom.description !== undefined
                ? newRoom.description
                : prev.description,
          }));
        }
      )
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const userIds = new Set<string>();
        for (const id in newState) {
          (newState[id] as any[]).forEach((presence) => {
            if (presence.user_id) userIds.add(presence.user_id);
          });
        }
        setOnlineUsers(userIds);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            nickname: userNickname || "User",
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    charactersRef,
    currentRoomId,
    onKicked,
    onRoomDeleted,
    pageSize,
    setBgMusicUrl,
    setCharacters,
    setHasMoreLogs,
    setIsMusicPlaying,
    setLogs,
    setModuleInfo,
    setMusicTrackIndex,
    setOnlineUsers,
    userId,
    userNickname,
  ]);
}
