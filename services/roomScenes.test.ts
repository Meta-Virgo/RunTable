import { describe, expect, it, vi } from "vitest";
import {
  clampSceneCoordinate,
  createRoomScene,
  isOwnInvestigatorMarker,
  isVisibleSceneMarker,
  moveOwnSceneMarker,
  upsertRoomSceneMarker,
} from "./roomScenes";
import { supabase } from "../supabase";
import type { RoomSceneMarker } from "../types";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const marker = {
  id: "marker-1",
  room_id: "room-1",
  scene_id: "scene-1",
  character_id: "char-1",
  x: 25,
  y: 75,
  is_hidden: false,
  label: null,
  created_at: "2026-06-13T00:00:00.000Z",
  updated_at: "2026-06-13T00:00:00.000Z",
} satisfies RoomSceneMarker;

describe("room scene model helpers", () => {
  it("clamps scene coordinates to the board bounds", () => {
    expect(clampSceneCoordinate(-10)).toBe(0);
    expect(clampSceneCoordinate(120)).toBe(100);
    expect(clampSceneCoordinate(42.26)).toBe(42.3);
    expect(clampSceneCoordinate(Number.NaN)).toBe(50);
  });

  it("allows users to move only their own investigator marker", () => {
    expect(
      isOwnInvestigatorMarker({
        marker,
        characterUserId: "user-1",
        characterType: "investigator",
        currentUserId: "user-1",
      })
    ).toBe(true);
    expect(
      isOwnInvestigatorMarker({
        marker,
        characterUserId: "user-2",
        characterType: "investigator",
        currentUserId: "user-1",
      })
    ).toBe(false);
    expect(
      isOwnInvestigatorMarker({
        marker,
        characterUserId: "user-1",
        characterType: "npc",
        currentUserId: "user-1",
      })
    ).toBe(false);
  });

  it("filters hidden markers for non-keepers", () => {
    expect(
      isVisibleSceneMarker({
        marker: { ...marker, is_hidden: true },
        isKeeper: true,
      })
    ).toBe(true);
    expect(
      isVisibleSceneMarker({
        marker: { ...marker, is_hidden: true },
        isKeeper: false,
      })
    ).toBe(false);
  });
});

describe("room scene service rpc parameters", () => {
  it("creates scenes through the scene rpc", async () => {
    const returns = vi.fn();
    vi.mocked(supabase.rpc).mockReturnValue({ returns } as any);

    await createRoomScene({
      roomId: "room-1",
      title: "Old Hall",
      description: "A dark room",
      backgroundColor: "#20302b",
      backgroundPattern: "dots",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("create_room_scene", {
      p_room_id: "room-1",
      p_title: "Old Hall",
      p_description: "A dark room",
      p_background_color: "#20302b",
      p_background_pattern: "dots",
    });
    expect(returns).toHaveBeenCalled();
  });

  it("upserts marker positions after clamping coordinates", async () => {
    const returns = vi.fn();
    vi.mocked(supabase.rpc).mockReturnValue({ returns } as any);

    await upsertRoomSceneMarker({
      sceneId: "scene-1",
      characterId: "char-1",
      x: -1,
      y: 101,
      isHidden: true,
      label: "Door",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("upsert_room_scene_marker", {
      p_scene_id: "scene-1",
      p_character_id: "char-1",
      p_x: 0,
      p_y: 100,
      p_is_hidden: true,
      p_label: "Door",
    });
  });

  it("moves own markers through the restricted player rpc", async () => {
    const returns = vi.fn();
    vi.mocked(supabase.rpc).mockReturnValue({ returns } as any);

    await moveOwnSceneMarker({
      markerId: "marker-1",
      x: 33.33,
      y: 66.66,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("move_own_scene_marker", {
      p_marker_id: "marker-1",
      p_x: 33.3,
      p_y: 66.7,
    });
  });
});
