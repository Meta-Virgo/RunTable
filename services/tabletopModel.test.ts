import { describe, expect, it } from "vitest";
import type { Character, TabletopState, TabletopToken } from "../types";
import {
  applyRevealedRect,
  canMoveTabletopToken,
  generateTabletopMap,
  getDefaultTokenPositionForScene,
  mergeTabletopTokensFromBootstrap,
  projectTabletopStateForViewer,
  removeTabletopSceneLocally,
  updateTabletopMapTileLocally,
} from "./tabletopModel";

const investigator = {
  id: "char-1",
  name: "Ada",
  role: "Investigator",
  type: "investigator",
  user_id: "user-1",
  room_id: "room-1",
  job: "",
  age: "",
  sex: "",
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 50,
  pow: 50,
  edu: 50,
  luck: 50,
  hp: 10,
  san: 50,
  mp: 10,
  notes: "",
  backstory: "",
  skills: {},
} satisfies Character;

describe("tabletop map model", () => {
  it("generates deterministic maps from the same seed", () => {
    const first = generateTabletopMap({ seed: "fixed-seed" });
    const second = generateTabletopMap({ seed: "fixed-seed" });

    expect(first).toEqual(second);
    expect(first.tiles.some((tile) => tile.kind === "floor")).toBe(true);
  });

  it("places new tokens inside generated map geometry by default", () => {
    const scene = {
      id: "scene-1",
      title: "Hall",
      description: null,
      map: generateTabletopMap({ seed: "token-spawn-seed", width: 18, height: 14 }),
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    const position = getDefaultTokenPositionForScene(scene);
    const tileX = Math.floor(position.x / scene.map.config.gridSize);
    const tileY = Math.floor(position.y / scene.map.config.gridSize);
    const tile = scene.map.tiles.find((item) => item.x === tileX && item.y === tileY);

    expect(tile?.kind).toMatch(/floor|door/);
  });

  it("updates generated map tiles for keeper map editing", () => {
    const scene = {
      id: "scene-1",
      title: "Hall",
      description: null,
      map: generateTabletopMap({ seed: "map-edit-seed", width: 18, height: 14 }),
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const state: TabletopState = {
      roomId: "room-1",
      activeSceneId: scene.id,
      scenes: [scene],
      tokens: [],
      shapes: [],
      fogRegions: [],
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    const next = updateTabletopMapTileLocally(state, scene.id, {
      x: 2,
      y: 3,
      kind: "floor",
    });
    const edited = next.scenes[0].map.tiles.find((tile) => tile.x === 2 && tile.y === 3);

    expect(edited?.kind).toBe("floor");
  });

  it("removes hidden tokens and unrevealed map geometry from public projection", () => {
    const map = generateTabletopMap({ seed: "projection-seed", width: 18, height: 14 });
    const scene = {
      id: "scene-1",
      title: "Hall",
      description: null,
      map,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const token: TabletopToken = {
      id: "token-1",
      roomId: "room-1",
      sceneId: scene.id,
      characterId: "char-1",
      x: scene.map.config.gridSize,
      y: scene.map.config.gridSize,
      size: 42,
      rotation: 0,
      zIndex: 1,
      isHidden: true,
      isLocked: false,
      label: null,
    };
    const state: TabletopState = {
      roomId: "room-1",
      activeSceneId: scene.id,
      scenes: [scene],
      tokens: [token],
      shapes: [
        {
          id: "shape-1",
          sceneId: scene.id,
          kind: "rect",
          x: 10,
          y: 10,
          width: 80,
          height: 60,
          fill: "rgba(16,185,129,0.14)",
          stroke: "#34d399",
          strokeWidth: 2,
          zIndex: 1,
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      fogRegions: [],
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    const projected = projectTabletopStateForViewer({ state, isKeeper: false });

    expect(projected.tokens).toHaveLength(0);
    expect(projected.shapes).toHaveLength(1);
    expect(
      projected.scenes[0].map.tiles.some(
        (tile) => !tile.revealed && tile.roomId !== undefined
      )
    ).toBe(false);
  });

  it("allows only KP or owning unlocked visible investigator tokens to move", () => {
    const token = {
      isHidden: false,
      isLocked: false,
      characterId: "char-1",
    };

    expect(
      canMoveTabletopToken({
        token,
        character: investigator,
        isKeeper: false,
        currentUserId: "user-1",
      })
    ).toBe(true);
    expect(
      canMoveTabletopToken({
        token: { ...token, isLocked: true },
        character: investigator,
        isKeeper: false,
        currentUserId: "user-1",
      })
    ).toBe(false);
    expect(
      canMoveTabletopToken({
        token,
        character: { user_id: "user-2", type: "investigator" },
        isKeeper: false,
        currentUserId: "user-1",
      })
    ).toBe(false);
    expect(
      canMoveTabletopToken({
        token: { ...token, isHidden: true, isLocked: true },
        character: { user_id: "user-2", type: "monster" },
        isKeeper: true,
        currentUserId: "keeper-1",
      })
    ).toBe(true);
  });

  it("removes scene-local tabletop data when deleting a scene", () => {
    const firstScene = {
      id: "scene-1",
      title: "Hall",
      description: null,
      map: generateTabletopMap({ seed: "delete-scene-1" }),
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const secondScene = {
      id: "scene-2",
      title: "Cellar",
      description: null,
      map: generateTabletopMap({ seed: "delete-scene-2" }),
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const state: TabletopState = {
      roomId: "room-1",
      activeSceneId: firstScene.id,
      scenes: [firstScene, secondScene],
      tokens: [
        {
          id: "token-1",
          roomId: "room-1",
          sceneId: firstScene.id,
          characterId: "char-1",
          x: 0,
          y: 0,
          size: 42,
          rotation: 0,
          zIndex: 1,
          isHidden: false,
          isLocked: false,
          label: null,
        },
      ],
      shapes: [
        {
          id: "shape-1",
          sceneId: firstScene.id,
          kind: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          fill: "rgba(16,185,129,0.14)",
          stroke: "#34d399",
          strokeWidth: 2,
          zIndex: 1,
          createdAt: "2026-06-14T00:00:00.000Z",
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      fogRegions: [
        {
          id: "fog-1",
          sceneId: firstScene.id,
          shape: "rect",
          points: [0, 0, 100, 100],
          mode: "revealed",
        },
      ],
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    const next = removeTabletopSceneLocally(state, firstScene.id);

    expect(next.scenes.map((scene) => scene.id)).toEqual([secondScene.id]);
    expect(next.activeSceneId).toBe(secondScene.id);
    expect(next.tokens).toHaveLength(0);
    expect(next.shapes).toHaveLength(0);
    expect(next.fogRegions).toHaveLength(0);
  });

  it("merges authoritative bootstrap token rows without duplicating characters", () => {
    const scene = {
      id: "scene-1",
      title: "Hall",
      description: null,
      map: generateTabletopMap({ seed: "bootstrap-token-scene" }),
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const state: TabletopState = {
      roomId: "room-1",
      activeSceneId: scene.id,
      scenes: [scene],
      tokens: [
        {
          id: "stale-token",
          roomId: "room-1",
          sceneId: scene.id,
          characterId: "char-1",
          x: 10,
          y: 10,
          size: 42,
          rotation: 0,
          zIndex: 1,
          isHidden: false,
          isLocked: false,
          label: null,
        },
      ],
      shapes: [],
      fogRegions: [],
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    const next = mergeTabletopTokensFromBootstrap(state, [
      {
        id: "fresh-token",
        roomId: "room-1",
        sceneId: scene.id,
        characterId: "char-1",
        x: 96,
        y: 144,
        size: 42,
        rotation: 0,
        zIndex: 3,
        isHidden: false,
        isLocked: true,
        label: "Ada",
      },
      {
        id: "other-room-token",
        roomId: "room-2",
        sceneId: scene.id,
        characterId: "char-2",
        x: 0,
        y: 0,
        size: 42,
        rotation: 0,
        zIndex: 1,
        isHidden: false,
        isLocked: false,
        label: null,
      },
    ]);

    expect(next.tokens).toHaveLength(1);
    expect(next.tokens[0]).toMatchObject({
      id: "fresh-token",
      characterId: "char-1",
      x: 96,
      y: 144,
      zIndex: 3,
      isLocked: true,
      label: "Ada",
    });
  });

  it("lets the keeper reveal and hide map areas for player projection", () => {
    const scene = {
      id: "scene-1",
      title: "Hall",
      description: null,
      map: generateTabletopMap({
        seed: "fog-control-scene",
        width: 18,
        height: 14,
        gridSize: 48,
      }),
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const state: TabletopState = {
      roomId: "room-1",
      activeSceneId: scene.id,
      scenes: [scene],
      tokens: [],
      shapes: [],
      fogRegions: [],
      updatedAt: "2026-06-14T00:00:00.000Z",
    };

    const revealed = applyRevealedRect({
      state,
      sceneId: scene.id,
      rect: { x: 0, y: 0, width: 48, height: 48 },
      reveal: true,
    });
    const playerView = projectTabletopStateForViewer({
      state: revealed,
      isKeeper: false,
    });

    expect(playerView.scenes[0].map.tiles[0].revealed).toBe(true);
    expect(playerView.scenes[0].map.tiles[0].roomId).toBe(
      revealed.scenes[0].map.tiles[0].roomId
    );

    const hiddenAgain = applyRevealedRect({
      state: revealed,
      sceneId: scene.id,
      rect: { x: 0, y: 0, width: 48, height: 48 },
      reveal: false,
    });
    const hiddenPlayerView = projectTabletopStateForViewer({
      state: hiddenAgain,
      isKeeper: false,
    });

    expect(hiddenPlayerView.scenes[0].map.tiles[0]).toMatchObject({
      revealed: false,
      kind: "wall",
      roomId: undefined,
    });
  });
});
