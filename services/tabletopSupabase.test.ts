import { describe, expect, it } from "vitest";
import {
  getTabletopRealtimeConnection,
  mapTabletopTokenRow,
} from "./tabletopSupabase";

describe("tabletop Supabase realtime helpers", () => {
  it("does not report terminal subscription failures as reconnecting", () => {
    expect(getTabletopRealtimeConnection({ status: "SUBSCRIBED" })).toEqual({
      status: "connected",
      detail: null,
    });
    expect(getTabletopRealtimeConnection({ status: "CLOSED" }).status).toBe(
      "reconnecting"
    );
    expect(getTabletopRealtimeConnection({ status: "TIMED_OUT" }).status).toBe(
      "error"
    );
    expect(
      getTabletopRealtimeConnection({
        status: "CHANNEL_ERROR",
        error: new Error("private channel denied"),
      })
    ).toEqual({
      status: "error",
      detail: "实时连接失败：private channel denied",
    });
  });

  it("maps Supabase token rows to the tabletop token interface", () => {
    expect(
      mapTabletopTokenRow({
        id: "token-1",
        room_id: "room-1",
        scene_id: "scene-1",
        character_id: "char-1",
        x: 12.4,
        y: 24.8,
        size: 36,
        rotation: 90,
        z_index: 2,
        is_hidden: true,
        is_locked: false,
        label: "",
        updated_at: "2026-06-24T00:00:00.000Z",
      })
    ).toEqual({
      id: "token-1",
      roomId: "room-1",
      sceneId: "scene-1",
      characterId: "char-1",
      x: 12.4,
      y: 24.8,
      size: 36,
      rotation: 90,
      zIndex: 2,
      isHidden: true,
      isLocked: false,
      label: null,
      updatedAt: "2026-06-24T00:00:00.000Z",
    });
  });
});
