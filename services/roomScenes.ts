import { supabase } from "../supabase";
import type {
  MoveOwnSceneMarkerInput,
  RoomScene,
  RoomSceneMarker,
  UpsertRoomSceneMarkerInput,
  CreateRoomSceneInput,
  UpdateRoomSceneInput,
} from "../types";

export const ROOM_SCENE_SELECT =
  "id, room_id, title, description, background_color, background_pattern, is_active, created_by_user_id, created_at, updated_at";

export const ROOM_SCENE_MARKER_SELECT =
  "id, room_id, scene_id, character_id, x, y, is_hidden, label, created_at, updated_at";

export const SCENE_BACKGROUND_COLORS = [
  "#182033",
  "#20302b",
  "#30263a",
  "#332625",
  "#253244",
  "#2e3041",
] as const;

export const SCENE_BACKGROUND_PATTERNS = [
  "plain",
  "grid",
  "dots",
  "mist",
] as const;

export function clampSceneCoordinate(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function isOwnInvestigatorMarker(input: {
  marker: RoomSceneMarker;
  characterUserId?: string | null;
  characterType?: string;
  currentUserId?: string;
}) {
  return (
    Boolean(input.currentUserId) &&
    input.characterUserId === input.currentUserId &&
    input.characterType === "investigator"
  );
}

export function isVisibleSceneMarker(input: {
  marker: RoomSceneMarker;
  isKeeper: boolean;
}) {
  return input.isKeeper || !input.marker.is_hidden;
}

export async function fetchRoomScenes(roomId: string) {
  return supabase
    .from("room_scenes")
    .select(ROOM_SCENE_SELECT)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .returns<RoomScene[]>();
}

export async function fetchRoomSceneMarkers(roomId: string) {
  return supabase
    .from("room_scene_markers")
    .select(ROOM_SCENE_MARKER_SELECT)
    .eq("room_id", roomId)
    .returns<RoomSceneMarker[]>();
}

export async function createRoomScene(input: CreateRoomSceneInput) {
  return supabase
    .rpc("create_room_scene", {
      p_room_id: input.roomId,
      p_title: input.title,
      p_description: input.description || null,
      p_background_color: input.backgroundColor || SCENE_BACKGROUND_COLORS[0],
      p_background_pattern: input.backgroundPattern || "plain",
    })
    .returns<RoomScene>();
}

export async function updateRoomScene(input: UpdateRoomSceneInput) {
  return supabase
    .rpc("update_room_scene", {
      p_scene_id: input.sceneId,
      p_title: input.title,
      p_description: input.description || null,
      p_background_color: input.backgroundColor || SCENE_BACKGROUND_COLORS[0],
      p_background_pattern: input.backgroundPattern || "plain",
    })
    .returns<RoomScene>();
}

export async function setActiveRoomScene(sceneId: string) {
  return supabase
    .rpc("set_active_room_scene", { p_scene_id: sceneId })
    .returns<RoomScene>();
}

export async function deleteRoomScene(sceneId: string) {
  return supabase.rpc("delete_room_scene", { p_scene_id: sceneId });
}

export async function upsertRoomSceneMarker(input: UpsertRoomSceneMarkerInput) {
  return supabase
    .rpc("upsert_room_scene_marker", {
      p_scene_id: input.sceneId,
      p_character_id: input.characterId,
      p_x: clampSceneCoordinate(input.x),
      p_y: clampSceneCoordinate(input.y),
      p_is_hidden: input.isHidden || false,
      p_label: input.label || null,
    })
    .returns<RoomSceneMarker>();
}

export async function moveOwnSceneMarker(input: MoveOwnSceneMarkerInput) {
  return supabase
    .rpc("move_own_scene_marker", {
      p_marker_id: input.markerId,
      p_x: clampSceneCoordinate(input.x),
      p_y: clampSceneCoordinate(input.y),
    })
    .returns<RoomSceneMarker>();
}

export async function deleteRoomSceneMarker(markerId: string) {
  return supabase.rpc("delete_room_scene_marker", { p_marker_id: markerId });
}

export function getRoomSceneErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as { message?: string } | null;
  return maybeError?.message ? `${fallback}: ${maybeError.message}` : fallback;
}
