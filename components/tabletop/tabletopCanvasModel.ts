import { clampTabletopScale } from "../../services/tabletopModel";
import type { TabletopShape } from "../../types";

export type TabletopStageState = {
  scale: number;
  x: number;
  y: number;
};

export type TabletopPoint = {
  x: number;
  y: number;
};

export type TabletopViewportSize = {
  width: number;
  height: number;
};

export type TabletopDraftTool = "rect" | "circle" | "reveal" | "hide";

export type TabletopDraftRect = {
  kind: "rect" | "circle";
  mode: "shape" | "reveal" | "hide";
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getTabletopViewportStorageKey(
  roomId: string,
  sceneId: string | null | undefined
) {
  return `tabletop-viewport:${roomId}:${sceneId || "none"}`;
}

export function parseSavedTabletopViewport(
  saved: string | null
): TabletopStageState | null {
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<TabletopStageState>;
    const x = parsed.x;
    const y = parsed.y;
    const scale = parsed.scale;
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof scale === "number" &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(scale)
    ) {
      return {
        x,
        y,
        scale: clampTabletopScale(scale),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function createFittedTabletopViewport(
  size: TabletopViewportSize
): TabletopStageState | null {
  if (!size.width || !size.height) return null;
  return {
    scale: 1,
    x: size.width / 2,
    y: size.height / 2,
  };
}

export function projectViewportPointToWorld(
  point: TabletopPoint,
  viewport: TabletopStageState
) {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function createZoomedTabletopViewport(input: {
  viewport: TabletopStageState;
  pointer: TabletopPoint;
  deltaY: number;
  scaleBy?: number;
}): TabletopStageState {
  const scaleBy = input.scaleBy ?? 1.08;
  const oldScale = input.viewport.scale;
  const mousePointTo = projectViewportPointToWorld(input.pointer, input.viewport);
  const nextScale = clampTabletopScale(
    input.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
  );

  return {
    scale: nextScale,
    x: input.pointer.x - mousePointTo.x * nextScale,
    y: input.pointer.y - mousePointTo.y * nextScale,
  };
}

export function createTextShapeDraft(
  point: TabletopPoint,
  textDraft: string
): Pick<TabletopShape, "kind" | "x" | "y" | "width" | "height" | "text"> {
  const text = textDraft.trim() || "文本";
  const length = Array.from(text).length;
  return {
    kind: "text",
    x: point.x,
    y: point.y,
    width: Math.min(480, Math.max(96, length * 18)),
    height: Math.max(34, Math.ceil(length / 22) * 30),
    text,
  };
}

export function createTabletopDraftRect(input: {
  start: TabletopPoint | null;
  end: TabletopPoint | null;
  tool: TabletopDraftTool;
}): TabletopDraftRect | null {
  if (!input.start || !input.end) return null;

  const isFogTool = input.tool === "reveal" || input.tool === "hide";
  const kind: "rect" | "circle" = isFogTool
    ? "rect"
    : input.tool === "circle"
      ? "circle"
      : "rect";
  let mode: TabletopDraftRect["mode"] = "shape";
  if (input.tool === "reveal") mode = "reveal";
  if (input.tool === "hide") mode = "hide";
  return {
    kind,
    mode,
    x: Math.min(input.start.x, input.end.x),
    y: Math.min(input.start.y, input.end.y),
    width: Math.abs(input.end.x - input.start.x),
    height: Math.abs(input.end.y - input.start.y),
  };
}

export function getMapTileAtWorldPoint(input: {
  point: TabletopPoint | null;
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
}) {
  if (!input.point) return null;
  const x = Math.floor(input.point.x / input.gridSize);
  const y = Math.floor(input.point.y / input.gridSize);
  if (x < 0 || y < 0 || x >= input.mapWidth || y >= input.mapHeight) {
    return null;
  }
  return { x, y };
}
