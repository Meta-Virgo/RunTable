import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { Character, Room } from "../types";
import {
  fetchLobbyCatalogBootstrap,
  fetchRoomActivityCounts,
  fetchRoomMemberUserIds,
  fetchVisibleRooms,
  isMissingLobbyBootstrapError,
} from "../services/rooms";
import {
  applyLobbyCatalogRoomChange,
  buildLobbyCatalogRooms,
  filterLobbyCatalogRooms,
  getLobbyCharacterRoomIds,
  sortLobbyCatalogRooms,
  type LobbySortMode,
  type RoomFilter,
} from "../services/lobbyCatalogModel";
export type { LobbySortMode, RoomFilter } from "../services/lobbyCatalogModel";

interface UseLobbyCatalogOptions {
  currentUserId: string | null;
  characters: Pick<Character, "room_id">[];
  onlineUsers: Set<string>;
}

const processRooms = async (rooms: any[]) => {
  const roomIds = rooms.map((room) => room.id);
  const [activityCounts, memberUserIds] = await Promise.all([
    fetchRoomActivityCounts(roomIds),
    fetchRoomMemberUserIds(roomIds),
  ]);

  return buildLobbyCatalogRooms({ rooms, activityCounts, memberUserIds });
};

function getRoomLoadErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : "";

  if (message.toLowerCase().includes("failed to fetch")) {
    return "无法连接到房间服务，请检查网络后重试。";
  }

  return message
    ? `房间列表加载失败：${message}`
    : "房间列表加载失败，请稍后重试。";
}

export function useLobbyCatalog({
  currentUserId,
  characters,
  onlineUsers,
}: UseLobbyCatalogOptions) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");
  const [sortMode, setSortMode] = useState<LobbySortMode>("activity");
  const characterRoomIds = useMemo(
    () => getLobbyCharacterRoomIds(characters),
    [characters]
  );
  const useBootstrapRef = useRef(true);

  const refreshRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomLoadError(null);

    try {
      if (useBootstrapRef.current) {
        const { data: bootstrap, error: bootstrapError } =
          await fetchLobbyCatalogBootstrap(Boolean(currentUserId));

        if (bootstrapError) {
          if (isMissingLobbyBootstrapError(bootstrapError)) {
            useBootstrapRef.current = false;
          } else {
            throw bootstrapError;
          }
        } else {
          setRooms(
            buildLobbyCatalogRooms({
              rooms: ((bootstrap as any)?.rooms || []) as Room[],
              activityCounts: new Map(),
            })
          );
          return;
        }
      }

      const { data, error } = await fetchVisibleRooms(
        currentUserId || undefined
      );

      if (error) {
        console.error("Error fetching rooms:", error);
        setRoomLoadError(getRoomLoadErrorMessage(error));
        return;
      }

      setRooms(await processRooms(data || []));
    } catch (error) {
      console.error("Error fetching rooms:", error);
      setRoomLoadError(getRoomLoadErrorMessage(error));
    } finally {
      setIsLoadingRooms(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    refreshRooms();

    const channel = supabase
      .channel("public:rooms_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        (payload) => {
          setRooms((prev) =>
            applyLobbyCatalogRoomChange({
              rooms: prev,
              eventType: payload.eventType,
              newRoom: payload.new as Room | null,
              oldRoom: payload.old as Pick<Room, "id"> | null,
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshRooms]);

  const filteredRooms = useMemo(() => {
    const nextRooms = filterLobbyCatalogRooms({
      rooms,
      searchQuery,
      roomFilter,
      characterRoomIds,
      currentUserId,
      onlineUsers,
    });

    return sortLobbyCatalogRooms(nextRooms, sortMode);
  }, [
    characterRoomIds,
    currentUserId,
    onlineUsers,
    roomFilter,
    rooms,
    searchQuery,
    sortMode,
  ]);

  return {
    rooms,
    filteredRooms,
    isLoadingRooms,
    roomLoadError,
    searchQuery,
    setSearchQuery,
    roomFilter,
    setRoomFilter,
    sortMode,
    setSortMode,
    refreshRooms,
  };
}
