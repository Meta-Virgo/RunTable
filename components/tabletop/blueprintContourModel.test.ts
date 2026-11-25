import { describe, expect, it } from "vitest";
import type { TabletopMapTile, TabletopState } from "../../types";
import {
  convertLegacyTilesToBlueprintShapes,
  extractBlueprintContours,
} from "./blueprintContourModel";
import {
  getCurvatureFromCurveMidpoint,
  getLineCurveControlPoint,
  sampleEllipsePoints,
} from "./tabletopCanvasModel";

describe("blueprintContourModel", () => {
  it("groups rectangular floor islands into clean rounded blueprint rooms and ignores wall blocks", () => {
    const tiles: TabletopMapTile[] = [
      // Room 1: 2x2 floor block
      { x: 1, y: 1, kind: "floor", revealed: true },
      { x: 2, y: 1, kind: "floor", revealed: true },
      { x: 1, y: 2, kind: "floor", revealed: true },
      { x: 2, y: 2, kind: "floor", revealed: true },
      // Door bridging to Room 2
      { x: 3, y: 1, kind: "door", revealed: true },
      // Room 2: 2x2 floor block
      { x: 4, y: 1, kind: "floor", revealed: true },
      { x: 5, y: 1, kind: "floor", revealed: true },
      { x: 4, y: 2, kind: "floor", revealed: true },
      { x: 5, y: 2, kind: "floor", revealed: true },
      // Surrounding wall tiles should not generate rooms
      { x: 0, y: 0, kind: "wall", revealed: true },
      { x: 3, y: 2, kind: "wall", revealed: true },
    ];

    const result = extractBlueprintContours(tiles, 40, true);
    expect(result.rooms).toHaveLength(2);
    expect(result.rooms[0]).toMatchObject({
      x: 40,
      y: 40,
      width: 80,
      height: 80,
      revealed: true,
    });
    expect(result.rooms[1]).toMatchObject({
      x: 160,
      y: 40,
      width: 80,
      height: 80,
      revealed: true,
    });
    expect(result.doors).toHaveLength(1);
    expect(result.doors[0].orientation).toBe("horizontal");
  });

  it("hides unrevealed rooms from non-keeper players", () => {
    const tiles: TabletopMapTile[] = [
      { x: 1, y: 1, kind: "floor", revealed: false },
      { x: 2, y: 1, kind: "floor", revealed: false },
    ];

    expect(extractBlueprintContours(tiles, 40, false).rooms).toHaveLength(0);
    expect(extractBlueprintContours(tiles, 40, true).rooms).toHaveLength(1);
  });

  it("upgrades legacy tile rooms into editable vector shapes and clears legacy floor tiles", () => {
    const state: TabletopState = {
      roomId: "room-1",
      activeSceneId: "scene-1",
      scenes: [
        {
          id: "scene-1",
          title: "列车",
          description: null,
          map: {
            config: {
              seed: "train",
              width: 10,
              height: 6,
              gridSize: 40,
              roomCount: 1,
              corridorDensity: 0,
              theme: "facility",
            },
            tiles: [
              { x: 1, y: 1, kind: "floor", revealed: true },
              { x: 2, y: 1, kind: "floor", revealed: true },
              { x: 3, y: 1, kind: "door", revealed: true },
              { x: 4, y: 1, kind: "floor", revealed: true },
            ],
          },
          createdAt: "2026-11-24T00:00:00.000Z",
          updatedAt: "2026-11-24T00:00:00.000Z",
        },
      ],
      tokens: [],
      shapes: [],
      fogRegions: [],
      updatedAt: "2026-11-24T00:00:00.000Z",
    };

    const upgraded = convertLegacyTilesToBlueprintShapes(state, "scene-1");
    expect(upgraded.shapes.filter((s) => s.kind === "rect")).toHaveLength(2);
    expect(upgraded.shapes.filter((s) => s.kind === "line")).toHaveLength(1);
    expect(
      upgraded.scenes[0].map.tiles.some((t) => t.kind !== "void")
    ).toBe(false);
  });

  it("samples true ellipses and round-trips quadratic curve curvature", () => {
    const pts = sampleEllipsePoints(100, 50, 100, 30, 32);
    expect(pts).toHaveLength(64);
    expect(Math.round(pts[0])).toBe(200);
    expect(Math.round(pts[1])).toBe(50);

    const { apexX, apexY } = getLineCurveControlPoint(0, 0, 200, 0, 48);
    expect(Math.round(apexX)).toBe(100);
    expect(Math.round(apexY)).toBe(48);
    expect(getCurvatureFromCurveMidpoint(0, 0, 200, 0, apexX, apexY)).toBe(48);
  });
});
