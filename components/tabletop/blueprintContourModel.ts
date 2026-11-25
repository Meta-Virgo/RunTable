import type {
  TabletopMapTile,
  TabletopShape,
  TabletopState,
} from "../../types";
import {
  createEmptyTabletopMap,
  createTabletopShape,
  normalizeTabletopState,
} from "../../services/tabletopModel";

export interface BlueprintRoomRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  revealed: boolean;
}

export interface BlueprintPolygonSegment {
  id: string;
  points: [number, number, number, number];
  revealed: boolean;
}

export interface BlueprintDoorBridge {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: "horizontal" | "vertical";
  revealed: boolean;
}

export interface BlueprintContourResult {
  rooms: BlueprintRoomRect[];
  irregularTiles: Array<{
    id: string;
    x: number;
    y: number;
    size: number;
    revealed: boolean;
  }>;
  irregularEdges: BlueprintPolygonSegment[];
  doors: BlueprintDoorBridge[];
}

/**
 * Converts legacy grid-based floor/wall/door tiles into clean minimalist
 * architectural blueprint rooms (rounded rectangles for rectangular chambers,
 * outer-perimeter-only contours for irregular corridors, subtle doorway links,
 * and zero bulky wall square blocks).
 */
export function extractBlueprintContours(
  tiles: TabletopMapTile[],
  gridSize: number,
  isKeeper: boolean
): BlueprintContourResult {
  const floorByKey = new Map<string, TabletopMapTile>();
  const doors: BlueprintDoorBridge[] = [];

  for (const tile of tiles) {
    if (!isKeeper && !tile.revealed) continue;
    if (tile.kind === "floor") {
      floorByKey.set(`${tile.x}:${tile.y}`, tile);
    } else if (tile.kind === "door") {
      doors.push({
        id: `door-${tile.x}-${tile.y}`,
        x: tile.x * gridSize,
        y: tile.y * gridSize,
        width: gridSize,
        height: gridSize,
        orientation: "horizontal",
        revealed: tile.revealed,
      });
    }
  }

  // Refine door orientation based on adjacent floor tiles
  for (const door of doors) {
    const gx = Math.round(door.x / gridSize);
    const gy = Math.round(door.y / gridSize);
    const hasLeftRight =
      floorByKey.has(`${gx - 1}:${gy}`) || floorByKey.has(`${gx + 1}:${gy}`);
    const hasTopBottom =
      floorByKey.has(`${gx}:${gy - 1}`) || floorByKey.has(`${gx}:${gy + 1}`);
    door.orientation = hasLeftRight && !hasTopBottom ? "horizontal" : "vertical";
  }

  const visited = new Set<string>();
  const rooms: BlueprintRoomRect[] = [];
  const irregularTiles: BlueprintContourResult["irregularTiles"] = [];
  const irregularEdges: BlueprintPolygonSegment[] = [];

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let componentIndex = 0;

  for (const [startKey, startTile] of floorByKey) {
    if (visited.has(startKey)) continue;
    componentIndex += 1;

    const queue: TabletopMapTile[] = [startTile];
    const component: TabletopMapTile[] = [];
    visited.add(startKey);

    let minX = startTile.x;
    let maxX = startTile.x;
    let minY = startTile.y;
    let maxY = startTile.y;
    let revealedCount = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      if (current.x < minX) minX = current.x;
      if (current.x > maxX) maxX = current.x;
      if (current.y < minY) minY = current.y;
      if (current.y > maxY) maxY = current.y;
      if (current.revealed) revealedCount += 1;

      for (const [dx, dy] of dirs) {
        const nextKey = `${current.x + dx}:${current.y + dy}`;
        if (visited.has(nextKey)) continue;
        const neighbor = floorByKey.get(nextKey);
        if (!neighbor) continue;
        visited.add(nextKey);
        queue.push(neighbor);
      }
    }

    const bboxCols = maxX - minX + 1;
    const bboxRows = maxY - minY + 1;
    const fillRatio = component.length / (bboxCols * bboxRows);
    const isRevealed = revealedCount > 0;

    if (fillRatio >= 0.9) {
      const width = bboxCols * gridSize;
      const height = bboxRows * gridSize;
      rooms.push({
        id: `bp-room-${componentIndex}`,
        x: minX * gridSize,
        y: minY * gridSize,
        width,
        height,
        cornerRadius: Math.min(28, Math.round(Math.min(width, height) * 0.2)),
        revealed: isRevealed,
      });
    } else {
      const memberKeys = new Set(component.map((t) => `${t.x}:${t.y}`));
      for (const tile of component) {
        const px = tile.x * gridSize;
        const py = tile.y * gridSize;
        irregularTiles.push({
          id: `bp-tile-${tile.x}-${tile.y}`,
          x: px,
          y: py,
          size: gridSize,
          revealed: tile.revealed,
        });

        if (!memberKeys.has(`${tile.x}:${tile.y - 1}`)) {
          irregularEdges.push({
            id: `e-t-${tile.x}-${tile.y}`,
            points: [px, py, px + gridSize, py],
            revealed: tile.revealed,
          });
        }
        if (!memberKeys.has(`${tile.x}:${tile.y + 1}`)) {
          irregularEdges.push({
            id: `e-b-${tile.x}-${tile.y}`,
            points: [px, py + gridSize, px + gridSize, py + gridSize],
            revealed: tile.revealed,
          });
        }
        if (!memberKeys.has(`${tile.x - 1}:${tile.y}`)) {
          irregularEdges.push({
            id: `e-l-${tile.x}-${tile.y}`,
            points: [px, py, px, py + gridSize],
            revealed: tile.revealed,
          });
        }
        if (!memberKeys.has(`${tile.x + 1}:${tile.y}`)) {
          irregularEdges.push({
            id: `e-r-${tile.x}-${tile.y}`,
            points: [px + gridSize, py, px + gridSize, py + gridSize],
            revealed: tile.revealed,
          });
        }
      }
    }
  }

  return { rooms, irregularTiles, irregularEdges, doors };
}

/**
 * Upgrades legacy grid-tile scenes (e.g. old train-car tile maps) into pure
 * editable vector blueprint shapes so every room and doorway connector on the
 * canvas can be clicked, moved, resized, curved, or deleted directly.
 */
export function convertLegacyTilesToBlueprintShapes(
  state: TabletopState,
  sceneId: string
): TabletopState {
  const scene = state.scenes.find((item) => item.id === sceneId);
  if (!scene) return state;

  const hasLegacyFloor = scene.map.tiles.some(
    (tile) => tile.kind === "floor" || tile.kind === "door"
  );
  if (!hasLegacyFloor) return state;

  const gridSize = scene.map.config.gridSize || 48;
  const contours = extractBlueprintContours(scene.map.tiles, gridSize, true);
  const convertedShapes: TabletopShape[] = [];

  for (const room of contours.rooms) {
    convertedShapes.push(
      createTabletopShape({
        sceneId: scene.id,
        kind: "rect",
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        cornerRadius: room.cornerRadius,
      })
    );
  }

  // Group adjacent door tiles into clean connector lines
  for (const door of contours.doors) {
    const cx = door.x + door.width / 2;
    const cy = door.y + door.height / 2;
    const half = Math.round(door.width * 0.35);
    if (door.orientation === "horizontal") {
      convertedShapes.push(
        createTabletopShape({
          sceneId: scene.id,
          kind: "line",
          x: Math.round(cx - half),
          y: Math.round(cy),
          width: half * 2,
          height: 1,
          points: [0, 0, half * 2, 0],
          curvature: 0,
        })
      );
    } else {
      convertedShapes.push(
        createTabletopShape({
          sceneId: scene.id,
          kind: "line",
          x: Math.round(cx),
          y: Math.round(cy - half),
          width: 1,
          height: half * 2,
          points: [0, 0, 0, half * 2],
          curvature: 0,
        })
      );
    }
  }

  return normalizeTabletopState({
    ...state,
    scenes: state.scenes.map((item) =>
      item.id === scene.id
        ? {
            ...item,
            map: createEmptyTabletopMap(item.map.config),
            updatedAt: new Date().toISOString(),
          }
        : item
    ),
    shapes: [...state.shapes, ...convertedShapes],
    updatedAt: new Date().toISOString(),
  });
}
