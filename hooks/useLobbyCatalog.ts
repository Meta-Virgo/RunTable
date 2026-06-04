import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { Room } from "../types";
import { getCurrentUser } from "../services/auth";
import {
  fetchRoomActivityCounts,
  fetchVisibleRooms,
} from "../services/rooms";

export type RoomFilter = "all" | "mine" | "created" | "kp_online";

interface UseLobbyCatalogOptions {
  currentUserId: string | null;
  characterRoomIds: Set<string | null | undefined>;
  onlineUsers: Set<string>;
}

const processRooms = async (rooms: any[]) => {
  const activityCounts = await fetchRoomActivityCounts(
    rooms.map((room) => room.id)
  );
  const now = Date.now();

  const processed = rooms.map((room) => {
    const activity = activityCounts.get(room.id);
    const characterCount =
      activity?.character_count ?? room.characters?.[0]?.count ?? 2;
    const messageCount = activity?.message_count ?? room.messages?.[0]?.count ?? 5;
    const createdAt = new Date(room.created_at).getTime();
    const lastActive = room.last_active_at
      ? new Date(room.last_active_at).getTime()
      : createdAt;
    const isZombie =
      now - createdAt > 24 * 60 * 60 * 1000 &&
      characterCount <= 1 &&
      messageCount < 5;
    const isArchived = now - lastActive > 7 * 24 * 60 * 60 * 1000;

    return {
      ...room,
      isZombie,
      isArchived,
      last_active_at: room.last_active_at || room.created_at,
    };
  });

  processed.sort((a, b) => {
    if (a.isZombie !== b.isZombie) return a.isZombie ? 1 : -1;
    return (
      new Date(b.last_active_at).getTime() -
      new Date(a.last_active_at).getTime()
    );
  });

  return processed;
};

export function useLobbyCatalog({
  currentUserId,
  characterRoomIds,
  onlineUsers,
}: UseLobbyCatalogOptions) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");

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
          if (payload.eventType === "INSERT") {
            const newRoom = payload.new as Room;
            if (newRoom.status === "open") {
              setRooms((prev) => [newRoom, ...prev]);
            }
          } else if (payload.eventType === "DELETE") {
            setRooms((prev) => prev.filter((room) => room.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            const updatedRoom = payload.new as Room;
            if (updatedRoom.status !== "open") {
              setRooms((prev) =>
                prev.filter((room) => room.id !== updatedRoom.id)
              );
            } else {
              setRooms((prev) => {
                const exists = prev.find((room) => room.id === updatedRoom.id);
                if (exists) {
                  return prev.map((room) =>
                    room.id === updatedRoom.id
                      ? { ...room, ...updatedRoom }
                      : room
                  );
                }
                return [updatedRoom, ...prev];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshRooms]);

  const filteredRooms = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return rooms.filter((room: any) => {
      const matchesSearch =
        room.title.toLowerCase().includes(query) ||
        (room.description && room.description.toLowerCase().includes(query)) ||
        (room.room_number && String(room.room_number).includes(query)) ||
        (room.room_number && `#${room.room_number}`.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      if (roomFilter === "all") return !room.isArchived;
      if (roomFilter === "mine") return characterRoomIds.has(room.id);
      if (roomFilter === "created") return room.kp_id === currentUserId;
      if (roomFilter === "kp_online") return onlineUsers.has(room.kp_id);

      return true;
    });
  }, [characterRoomIds, currentUserId, onlineUsers, roomFilter, rooms, searchQuery]);

  return {
    rooms,
    filteredRooms,
    isLoadingRooms,
    searchQuery,
    setSearchQuery,
    roomFilter,
    setRoomFilter,
    refreshRooms,
  };
}
