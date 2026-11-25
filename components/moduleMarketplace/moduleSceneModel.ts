import type { TabletopState } from "../../types";
import {
  createEmptyTabletopMap,
  createEmptyTabletopState,
  createInitialTabletopScene,
  getActiveTabletopScene,
  normalizeTabletopState,
} from "../../services/tabletopModel";

const MODULE_TABLETOP_ROOM_ID = "module-template";

function stripNumericDriftSuffix(characterId: string) {
  return characterId.replace(/(?:-\d+)+$/, "");
}

export function createModuleSceneTabletopState(input: {
  title?: string;
  description?: string | null;
  state?: TabletopState | null;
  characterIds?: string[];
}) {
  if (input.state?.scenes?.length) {
    const validIds = input.characterIds || [];
    const exactIdSet = new Set(validIds);
    const baseIdMap = new Map<string, string>();
    for (const id of validIds) {
      const base = stripNumericDriftSuffix(id);
      if (!baseIdMap.has(base)) {
        baseIdMap.set(base, id);
      }
    }

    const reconciledTokens = exactIdSet.size
      ? input.state.tokens.flatMap((token) => {
          if (exactIdSet.has(token.characterId)) {
            return [token];
          }
          const healedId = baseIdMap.get(
            stripNumericDriftSuffix(token.characterId)
          );
          if (healedId) {
            return [{ ...token, characterId: healedId }];
          }
          return [];
        })
      : input.state.tokens;

    return normalizeTabletopState({
      ...input.state,
      roomId: input.state.roomId || MODULE_TABLETOP_ROOM_ID,
      tokens: reconciledTokens,
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
