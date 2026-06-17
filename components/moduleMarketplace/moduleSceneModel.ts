import type { TabletopState } from "../../types";
import {
  createEmptyTabletopMap,
  createEmptyTabletopState,
  createInitialTabletopScene,
  getActiveTabletopScene,
  normalizeTabletopState,
} from "../../services/tabletopModel";

const MODULE_TABLETOP_ROOM_ID = "module-template";

export function createModuleSceneTabletopState(input: {
  title?: string;
  description?: string | null;
  state?: TabletopState | null;
  characterIds?: string[];
}) {
  if (input.state?.scenes?.length) {
    const characterIds = new Set(input.characterIds || []);
    return normalizeTabletopState({
      ...input.state,
      roomId: input.state.roomId || MODULE_TABLETOP_ROOM_ID,
      tokens: characterIds.size
        ? input.state.tokens.filter((token) => characterIds.has(token.characterId))
        : input.state.tokens,
    });
  }

  const scene = createInitialTabletopScene(input.title || "起始场景", {
    seed: `module-${input.title || "starter"}`,
  });
  scene.description = input.description || null;
  scene.map = createEmptyTabletopMap(scene.map.config);
  return normalizeTabletopState({
    ...createEmptyTabletopState(MODULE_TABLETOP_ROOM_ID),
    activeSceneId: scene.id,
    scenes: [scene],
  });
}

export function getModuleSceneFormFromTabletopState(state: TabletopState) {
  const scene = getActiveTabletopScene(state) || state.scenes[0] || null;
  return {
    title: scene?.title || "",
    description: scene?.description || "",
    backgroundColor: "#182033",
    backgroundPattern: "grid" as const,
  };
}
