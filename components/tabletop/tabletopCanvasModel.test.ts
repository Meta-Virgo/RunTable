import { describe, expect, it } from "vitest";
import {
  createFittedTabletopViewport,
  createTabletopDraftRect,
  createTextShapeDraft,
  createZoomedTabletopViewport,
  getMapTileAtWorldPoint,
  getTabletopViewportStorageKey,
  parseSavedTabletopViewport,
  projectViewportPointToWorld,
} from "./tabletopCanvasModel";

describe("tabletop canvas model", () => {
  it("builds stable per-scene viewport cache keys", () => {
    expect(getTabletopViewportStorageKey("room-1", "scene-1")).toBe(
      "tabletop-viewport:room-1:scene-1"
    );
    expect(getTabletopViewportStorageKey("room-1", null)).toBe(
      "tabletop-viewport:room-1:none"
    );
  });

  it("parses saved viewport state and clamps stale scale values", () => {
    expect(
      parseSavedTabletopViewport(JSON.stringify({ x: 12, y: -8, scale: 99 }))
    ).toEqual({ x: 12, y: -8, scale: 3.2 });
    expect(parseSavedTabletopViewport("{broken")).toBeNull();
    expect(parseSavedTabletopViewport(JSON.stringify({ x: "12", y: 0, scale: 1 })))
      .toBeNull();
  });

  it("fits and projects viewport coordinates through one interface", () => {
    const viewport = createFittedTabletopViewport({ width: 800, height: 600 });

    expect(viewport).toEqual({ x: 400, y: 300, scale: 1 });
    expect(
      projectViewportPointToWorld({ x: 520, y: 420 }, { x: 400, y: 300, scale: 2 })
    ).toEqual({ x: 60, y: 60 });
  });

  it("zooms around the pointer without moving the world point under it", () => {
    const viewport = { x: 100, y: 80, scale: 1 };
    const pointer = { x: 180, y: 140 };
    const worldBefore = projectViewportPointToWorld(pointer, viewport);
    const zoomed = createZoomedTabletopViewport({
      viewport,
      pointer,
      deltaY: -1,
      scaleBy: 2,
    });

    expect(zoomed.scale).toBe(2);
    expect(projectViewportPointToWorld(pointer, zoomed)).toEqual(worldBefore);
  });

  it("creates text and drawn-shape drafts without involving Konva", () => {
    expect(createTextShapeDraft({ x: 10, y: 20 }, "  hello  ")).toMatchObject({
      kind: "text",
      x: 10,
      y: 20,
      width: 96,
      height: 34,
      text: "hello",
    });
    expect(
      createTabletopDraftRect({
        start: { x: 100, y: 80 },
        end: { x: 40, y: 140 },
        tool: "reveal",
      })
    ).toEqual({
      kind: "rect",
      mode: "reveal",
      x: 40,
      y: 80,
      width: 60,
      height: 60,
    });
  });

  it("maps world points to bounded generated-map tiles", () => {
    expect(
      getMapTileAtWorldPoint({
        point: { x: 95, y: 121 },
        gridSize: 48,
        mapWidth: 3,
        mapHeight: 3,
      })
    ).toEqual({ x: 1, y: 2 });
    expect(
      getMapTileAtWorldPoint({
        point: { x: 200, y: 121 },
        gridSize: 48,
        mapWidth: 3,
        mapHeight: 3,
      })
    ).toBeNull();
  });
});
