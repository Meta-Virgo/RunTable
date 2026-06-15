import { describe, expect, it } from "vitest";
import { createEmptyTabletopState } from "./tabletopModel";
import {
  applyTabletopUpdateBase64,
  createTabletopDoc,
  encodeTabletopDoc,
  encodeTabletopUpdate,
  getTabletopDocState,
  setTabletopDocState,
} from "./tabletopYjs";

const scene = {
  id: "scene-1",
  title: "Scene",
  description: null,
  map: {
    config: {
      seed: "seed",
      width: 10,
      height: 8,
      gridSize: 48,
      roomCount: 2,
      corridorDensity: 0.2,
      theme: "stone" as const,
    },
    tiles: [],
  },
  createdAt: "2026-06-14T00:00:00.000Z",
  updatedAt: "2026-06-14T00:00:00.000Z",
};

describe("tabletop yjs helpers", () => {
  it("encodes and applies full document snapshots to an empty document", () => {
    const state = {
      ...createEmptyTabletopState("room-1"),
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const source = createTabletopDoc(state);
    const snapshot = encodeTabletopDoc(source);
    const target = createTabletopDoc();

    applyTabletopUpdateBase64(target, snapshot);

    expect(getTabletopDocState(target, "room-1")).toEqual(state);
  });

  it("encodes incremental Yjs updates", () => {
    const source = createTabletopDoc();
    const updates: string[] = [];
    source.on("update", (update: Uint8Array) => {
      updates.push(encodeTabletopUpdate(update));
    });

    setTabletopDocState(source, {
      ...createEmptyTabletopState("room-1"),
      scenes: [scene],
      activeSceneId: "scene-1",
    });

    const target = createTabletopDoc();
    for (const update of updates) {
      applyTabletopUpdateBase64(target, update);
    }
    expect(getTabletopDocState(target, "room-1").activeSceneId).toBe("scene-1");
    expect(updates.length).toBeGreaterThan(0);
  });

  it("supports explicit state replacement for redacted public snapshots", () => {
    const target = createTabletopDoc(createEmptyTabletopState("room-1"));
    setTabletopDocState(target, {
      ...createEmptyTabletopState("room-1"),
      scenes: [scene],
      activeSceneId: "scene-1",
    });

    expect(getTabletopDocState(target, "room-1").activeSceneId).toBe("scene-1");
  });
});
