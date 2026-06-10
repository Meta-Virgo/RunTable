import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Character, Room } from "../types";
import { getCurrentUser } from "../services/auth";
import {
  fetchRoomActivityCounts,
  fetchRoomMemberUserIds,
  fetchVisibleRooms,
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

export function useLobbyCatalog({
  currentUserId,
  characters,
  onlineUsers,
}: UseLobbyCatalogOptions) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");
  const [sortMode, setSortMode] = useState<LobbySortMode>("activity");
  const characterRoomIds = useMemo(
    () => getLobbyCharacterRoomIds(characters),
    [characters]
  );

  const refreshRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    const {
      data: { user },
    } = await getCurrentUser();
    const { data, error } = await fetchVisibleRooms(user?.id);

    if (data) {
      setRooms(await processRooms(data));
    }

    if (error) console.error("Error fetching rooms:", error);
    setIsLoadingRooms(false);
  }, []);

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
    searchQuery,
    setSearchQuery,
    roomFilter,
    setRoomFilter,
    sortMode,
    setSortMode,
    refreshRooms,
  };
}
