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

export type TabletopDraftTool = "rect" | "circle" | "line" | "reveal" | "hide";

export type TabletopDraftRect = {
  kind: "rect" | "circle" | "line";
  mode: "shape" | "reveal" | "hide";
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[];
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

export function createMapBoundsFittedTabletopViewport(input: {
  viewport: TabletopViewportSize;
  map: TabletopViewportSize;
  padding?: number;
}): TabletopStageState | null {
  if (
    !input.viewport.width ||
    !input.viewport.height ||
    !input.map.width ||
    !input.map.height
  ) {
    return null;
  }

  const padding = Math.max(0, input.padding ?? 0);
  const availableWidth = Math.max(1, input.viewport.width - padding * 2);
  const availableHeight = Math.max(1, input.viewport.height - padding * 2);
  const scale = Math.min(
    availableWidth / input.map.width,
    availableHeight / input.map.height
  );

  return {
    scale,
    x: Math.round((input.viewport.width - input.map.width * scale) / 2),
    y: Math.round((input.viewport.height - input.map.height * scale) / 2),
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

  if (input.tool === "line") {
    const dx = input.end.x - input.start.x;
    const dy = input.end.y - input.start.y;
    return {
      kind: "line",
      mode: "shape",
      x: input.start.x,
      y: input.start.y,
      width: Math.max(1, Math.abs(dx)),
      height: Math.max(1, Math.abs(dy)),
      points: [0, 0, dx, dy],
    };
  }

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

export function sampleEllipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments = 64
): number[] {
  const safeRx = Math.max(1, rx);
  const safeRy = Math.max(1, ry);
  const points: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      cx + Math.cos(angle) * safeRx,
      cy + Math.sin(angle) * safeRy
    );
  }
  return points;
}

export function getLineCurveControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature = 0
) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  // Unit normal perpendicular to line
  const nx = -dy / length;
  const ny = dx / length;
  // Quadratic Bezier control point (at 2x curvature so the curve apex at t=0.5 passes through mid + curvature * normal)
  const cx = midX + nx * curvature * 2;
  const cy = midY + ny * curvature * 2;
  const apexX = midX + nx * curvature;
  const apexY = midY + ny * curvature;
  return { cx, cy, apexX, apexY, nx, ny };
}

export function getCurvatureFromCurveMidpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  handleX: number,
  handleY: number
): number {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const projection = (handleX - midX) * nx + (handleY - midY) * ny;
  return Math.round(Math.max(-320, Math.min(320, projection)));
}

export function sampleQuadraticCurvePoints(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  segments = 28
): number[] {
  const points: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const inv = 1 - t;
    const px = inv * inv * x1 + 2 * inv * t * cx + t * t * x2;
    const py = inv * inv * y1 + 2 * inv * t * cy + t * t * y2;
    points.push(px, py);
  }
  return points;
}

export function getArrowHeadPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size = 11
): number[] {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const spread = Math.PI / 6.5;
  const lx = toX - size * Math.cos(angle - spread);
  const ly = toY - size * Math.sin(angle - spread);
  const rx = toX - size * Math.cos(angle + spread);
  const ry = toY - size * Math.sin(angle + spread);
  return [lx, ly, toX, toY, rx, ry];
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
