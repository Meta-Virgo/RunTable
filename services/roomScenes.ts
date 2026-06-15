import { supabase } from "../supabase";
import type {
  Character,
  MoveOwnSceneMarkerInput,
  RoomScene,
  RoomSceneMarker,
  RoomSceneMarkerDragPayload,
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

export const SCENE_WORLD_WIDTH = 1600;
export const SCENE_WORLD_HEIGHT = 1000;
export const SCENE_MARKER_DRAG_EVENT = "scene-marker-drag";
export const SCENE_MIN_SCALE = 0.35;
export const SCENE_MAX_SCALE = 3;

export function clampSceneCoordinate(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function clampSceneScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(SCENE_MAX_SCALE, Math.max(SCENE_MIN_SCALE, value));
}

export function getRoomSceneDragChannelName(roomId: string) {
  return `room-scenes-drag:${roomId}`;
}

export function scenePercentToWorld(position: { x: number; y: number }) {
  return {
    x: (clampSceneCoordinate(position.x) / 100) * SCENE_WORLD_WIDTH,
    y: (clampSceneCoordinate(position.y) / 100) * SCENE_WORLD_HEIGHT,
  };
}

export function sceneWorldToPercent(position: { x: number; y: number }) {
  return {
    x: clampSceneCoordinate((position.x / SCENE_WORLD_WIDTH) * 100),
    y: clampSceneCoordinate((position.y / SCENE_WORLD_HEIGHT) * 100),
  };
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

export function canMoveSceneMarker(input: {
  marker: RoomSceneMarker;
  character?: Pick<Character, "user_id" | "type">;
  isKeeper: boolean;
  currentUserId?: string;
}) {
  return (
    input.isKeeper ||
    isOwnInvestigatorMarker({
      marker: input.marker,
      characterUserId: input.character?.user_id,
      characterType: input.character?.type,
      currentUserId: input.currentUserId,
    })
  );
}

export function buildSceneMarkerDragPayload(input: {
  marker: RoomSceneMarker;
  roomId: string;
  userId: string;
  position: { x: number; y: number };
  sentAt?: string;
}): RoomSceneMarkerDragPayload {
  return {
    roomId: input.roomId,
    sceneId: input.marker.scene_id,
    markerId: input.marker.id,
    characterId: input.marker.character_id,
    userId: input.userId,
    x: clampSceneCoordinate(input.position.x),
    y: clampSceneCoordinate(input.position.y),
    sentAt: input.sentAt || new Date().toISOString(),
  };
}

export function isSceneMarkerDragPayload(input: unknown) {
  const payload = input as Partial<RoomSceneMarkerDragPayload> | null;
  return Boolean(
    payload &&
      typeof payload.roomId === "string" &&
      typeof payload.sceneId === "string" &&
      typeof payload.markerId === "string" &&
      typeof payload.characterId === "string" &&
      typeof payload.userId === "string" &&
      typeof payload.x === "number" &&
      typeof payload.y === "number" &&
      typeof payload.sentAt === "string"
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
