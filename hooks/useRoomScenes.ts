import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { RoomScene, RoomSceneMarker } from "../types";
import {
  fetchRoomSceneMarkers,
  fetchRoomScenes,
  isVisibleSceneMarker,
} from "../services/roomScenes";

export function useRoomScenes(input: {
  roomId: string | null;
  isKeeper: boolean;
}) {
  const { roomId, isKeeper } = input;
  const [scenes, setScenes] = useState<RoomScene[]>([]);
  const [markers, setMarkers] = useState<RoomSceneMarker[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const replaceScene = useCallback((scene: RoomScene) => {
    setScenes((previous) =>
      previous.some((item) => item.id === scene.id)
        ? previous.map((item) => (item.id === scene.id ? scene : item))
        : [...previous, scene].sort((left, right) =>
            left.created_at.localeCompare(right.created_at)
          )
    );
  }, []);

  const replaceMarker = useCallback((marker: RoomSceneMarker) => {
    setMarkers((previous) =>
      previous.some((item) => item.id === marker.id)
        ? previous.map((item) => (item.id === marker.id ? marker : item))
        : [...previous, marker]
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!roomId) {
      setScenes([]);
      setMarkers([]);
      return;
    }

    setIsLoading(true);
    const [{ data: sceneRows }, { data: markerRows }] = await Promise.all([
      fetchRoomScenes(roomId),
      fetchRoomSceneMarkers(roomId),
    ]);
    setScenes(sceneRows || []);
    setMarkers(markerRows || []);
    setIsLoading(false);
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-scenes:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_scenes",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldScene = payload.old as { id?: string };
            setScenes((previous) =>
              previous.filter((scene) => scene.id !== oldScene.id)
            );
            setMarkers((previous) =>
              previous.filter((marker) => marker.scene_id !== oldScene.id)
            );
            return;
          }

          replaceScene(payload.new as RoomScene);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_scene_markers",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldMarker = payload.old as { id?: string };
            setMarkers((previous) =>
              previous.filter((marker) => marker.id !== oldMarker.id)
            );
            return;
          }

          replaceMarker(payload.new as RoomSceneMarker);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [replaceMarker, replaceScene, roomId]);

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.is_active) || scenes[0] || null,
    [scenes]
  );

  const visibleMarkers = useMemo(
    () =>
      markers.filter(
        (marker) =>
          marker.scene_id === activeScene?.id &&
          isVisibleSceneMarker({ marker, isKeeper })
      ),
    [activeScene?.id, isKeeper, markers]
  );

  return {
    scenes,
    markers,
    activeScene,
    visibleMarkers,
    isLoading,
    refresh,
  };
}
