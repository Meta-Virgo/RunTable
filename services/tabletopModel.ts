import type {
  Character,
  GeneratedMapConfig,
  RoomScene,
  RoomSceneMarker,
  TabletopGeneratedMap,
  TabletopMapTheme,
  TabletopMapTile,
  TabletopScene,
  TabletopShape,
  TabletopState,
  TabletopToken,
} from "../types";

export const TABLETOP_WORLD_DEFAULTS = {
  width: 30,
  height: 20,
  gridSize: 48,
  roomCount: 6,
  corridorDensity: 0.32,
  theme: "stone" as TabletopMapTheme,
};

export const TABLETOP_TOKEN_SIZE = 42;
export const TABLETOP_MIN_SCALE = 0.55;
export const TABLETOP_MAX_SCALE = 3.2;

interface RectRoom {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export function clampTabletopCoordinate(
  value: number,
  min = -100000,
  max = 100000
) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampTabletopScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(TABLETOP_MAX_SCALE, Math.max(TABLETOP_MIN_SCALE, value));
}

export function createSeed(prefix = "map") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGeneratedMapConfig(
  partial: Partial<GeneratedMapConfig> = {}
): GeneratedMapConfig {
  return {
    seed: partial.seed || createSeed(),
    width: clampTabletopCoordinate(
      partial.width || TABLETOP_WORLD_DEFAULTS.width,
      16,
      80
    ),
    height: clampTabletopCoordinate(
      partial.height || TABLETOP_WORLD_DEFAULTS.height,
      12,
      60
    ),
    gridSize: clampTabletopCoordinate(
      partial.gridSize || TABLETOP_WORLD_DEFAULTS.gridSize,
      28,
      80
    ),
    roomCount: clampTabletopCoordinate(
      partial.roomCount || TABLETOP_WORLD_DEFAULTS.roomCount,
      1,
      24
    ),
    corridorDensity: Math.min(
      0.9,
      Math.max(0, partial.corridorDensity ?? TABLETOP_WORLD_DEFAULTS.corridorDensity)
    ),
    theme: partial.theme || TABLETOP_WORLD_DEFAULTS.theme,
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createPrng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function rectsOverlap(left: RectRoom, right: RectRoom) {
  return !(
    left.x + left.width + 1 < right.x ||
    right.x + right.width + 1 < left.x ||
    left.y + left.height + 1 < right.y ||
    right.y + right.height + 1 < left.y
  );
}

function carveRoom(
  tileMap: Map<string, TabletopMapTile>,
  room: RectRoom,
  revealed: boolean
) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      const key = `${x}:${y}`;
      tileMap.set(key, { x, y, kind: "floor", roomId: room.id, revealed });
    }
  }
}

function carveCorridor(
  tileMap: Map<string, TabletopMapTile>,
  from: RectRoom,
  to: RectRoom,
  config: GeneratedMapConfig,
  random: () => number,
  revealed: boolean
) {
  const horizontalFirst = random() > 0.5;
  const drawPoint = (x: number, y: number, kind: TabletopMapTile["kind"]) => {
    if (x <= 0 || y <= 0 || x >= config.width - 1 || y >= config.height - 1) {
      return;
    }
    tileMap.set(`${x}:${y}`, { x, y, kind, revealed });
  };
  const drawHorizontal = (x1: number, x2: number, y: number) => {
    const min = Math.min(x1, x2);
    const max = Math.max(x1, x2);
    for (let x = min; x <= max; x += 1) drawPoint(x, y, "floor");
  };
  const drawVertical = (y1: number, y2: number, x: number) => {
    const min = Math.min(y1, y2);
    const max = Math.max(y1, y2);
    for (let y = min; y <= max; y += 1) drawPoint(x, y, "floor");
  };

  if (horizontalFirst) {
    drawHorizontal(from.centerX, to.centerX, from.centerY);
    drawVertical(from.centerY, to.centerY, to.centerX);
  } else {
    drawVertical(from.centerY, to.centerY, from.centerX);
    drawHorizontal(from.centerX, to.centerX, to.centerY);
  }
  drawPoint(from.centerX, from.centerY, "door");
  drawPoint(to.centerX, to.centerY, "door");
}

export function generateTabletopMap(
  input: Partial<GeneratedMapConfig> = {}
): TabletopGeneratedMap {
  const config = createGeneratedMapConfig(input);
  const random = createPrng(config.seed);
  const tileMap = new Map<string, TabletopMapTile>();
  const rooms: RectRoom[] = [];
  const attempts = config.roomCount * 14;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (rooms.length >= config.roomCount) break;
    const width = 4 + Math.floor(random() * 6);
    const height = 4 + Math.floor(random() * 5);
    const x = 1 + Math.floor(random() * Math.max(1, config.width - width - 2));
    const y = 1 + Math.floor(random() * Math.max(1, config.height - height - 2));
    const room: RectRoom = {
      id: `room-${rooms.length + 1}`,
      x,
      y,
      width,
      height,
      centerX: x + Math.floor(width / 2),
      centerY: y + Math.floor(height / 2),
    };
    if (rooms.some((existing) => rectsOverlap(existing, room))) continue;
    rooms.push(room);
    carveRoom(tileMap, room, rooms.length === 1);
  }

  for (let index = 1; index < rooms.length; index += 1) {
    carveCorridor(tileMap, rooms[index - 1], rooms[index], config, random, index <= 1);
  }

  for (let index = 0; index < rooms.length; index += 1) {
    for (let target = index + 2; target < rooms.length; target += 1) {
      if (random() <= config.corridorDensity / rooms.length) {
        carveCorridor(tileMap, rooms[index], rooms[target], config, random, false);
      }
    }
  }

  const tiles: TabletopMapTile[] = [];
  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      const tile = tileMap.get(`${x}:${y}`);
      tiles.push(tile || { x, y, kind: "wall", revealed: false });
    }
  }

  return { config, tiles };
}

export function createEmptyTabletopMap(
  input: Partial<GeneratedMapConfig> = {}
): TabletopGeneratedMap {
  const config = createGeneratedMapConfig({
    ...input,
    roomCount: input.roomCount ?? 1,
  });
  const tiles: TabletopMapTile[] = [];
  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      tiles.push({ x, y, kind: "void", revealed: false });
    }
  }
  return { config, tiles };
}

export function createEmptyTabletopState(roomId: string): TabletopState {
  return {
    roomId,
    activeSceneId: null,
    scenes: [],
    tokens: [],
    shapes: [],
    fogRegions: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialTabletopScene(
  title = "未命名场景",
  mapConfig: Partial<GeneratedMapConfig> = {}
): TabletopScene {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : createSeed("scene");
  const now = new Date().toISOString();
  return {
    id,
    title,
    description: null,
    map: generateTabletopMap(mapConfig),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTabletopState(state: TabletopState): TabletopState {
  const scenes = Array.isArray(state.scenes) ? state.scenes : [];
  const tokens = Array.isArray(state.tokens) ? state.tokens : [];
  const shapes = Array.isArray(state.shapes) ? state.shapes : [];
  const fogRegions = Array.isArray(state.fogRegions) ? state.fogRegions : [];
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  return {
    ...state,
    activeSceneId:
      state.activeSceneId && sceneIds.has(state.activeSceneId)
        ? state.activeSceneId
        : scenes[0]?.id || null,
    scenes,
    tokens: tokens.filter((token) => sceneIds.has(token.sceneId)),
    shapes: shapes.filter((shape) => sceneIds.has(shape.sceneId)),
    fogRegions: fogRegions.filter((region) => sceneIds.has(region.sceneId)),
  };
}

export function getActiveTabletopScene(state: TabletopState) {
  return (
    state.scenes.find((scene) => scene.id === state.activeSceneId) ||
    state.scenes[0] ||
    null
  );
}

export function projectTabletopStateForViewer(input: {
  state: TabletopState;
  isKeeper: boolean;
}): TabletopState {
  const source = normalizeTabletopState(input.state);
  if (input.isKeeper) return source;

  const revealedByScene = new Map<string, Set<string>>();
  for (const scene of source.scenes) {
    revealedByScene.set(
      scene.id,
      new Set(
        scene.map.tiles
          .filter((tile) => tile.revealed)
          .map((tile) => `${tile.x}:${tile.y}`)
      )
    );
  }

  return normalizeTabletopState({
    ...source,
    scenes: source.scenes.map((scene) => ({
      ...scene,
      map: {
        ...scene.map,
        tiles: scene.map.tiles.map((tile) =>
          tile.revealed ? tile : { ...tile, kind: "wall", roomId: undefined }
        ),
      },
    })),
    tokens: source.tokens.filter((token) => {
      if (token.isHidden) return false;
      const visibleTiles = revealedByScene.get(token.sceneId);
      if (!visibleTiles) return true;
      const scene = source.scenes.find((item) => item.id === token.sceneId);
      if (!scene) return false;
      const tileX = Math.floor(token.x / scene.map.config.gridSize);
      const tileY = Math.floor(token.y / scene.map.config.gridSize);
      return visibleTiles.has(`${tileX}:${tileY}`);
    }),
    shapes: source.shapes,
    fogRegions: source.fogRegions.filter(
      (region) => region.mode === "revealed"
    ),
  });
}

export function canMoveTabletopToken(input: {
  token: Pick<TabletopToken, "isLocked" | "isHidden" | "characterId">;
  character?: Pick<Character, "user_id" | "type">;
  isKeeper: boolean;
  currentUserId?: string;
}) {
  if (input.isKeeper) return true;
  if (input.token.isLocked || input.token.isHidden) return false;
  return (
    Boolean(input.currentUserId) &&
    input.character?.user_id === input.currentUserId &&
    input.character?.type === "investigator"
  );
}

export function createTokenFromCharacter(input: {
  roomId: string;
  sceneId: string;
  character: Character;
  x: number;
  y: number;
  hidden?: boolean;
}): TabletopToken {
  const now = new Date().toISOString();
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : createSeed("token"),
    roomId: input.roomId,
    sceneId: input.sceneId,
    characterId: input.character.id,
    x: input.x,
    y: input.y,
    size: TABLETOP_TOKEN_SIZE,
    rotation: 0,
    zIndex: 1,
    isHidden: input.hidden ?? input.character.type !== "investigator",
    isLocked: false,
    label: null,
    updatedAt: now,
  };
}

export function importLegacySceneState(input: {
  roomId: string;
  scenes: RoomScene[];
  markers: RoomSceneMarker[];
}): TabletopState {
  const scenes: TabletopScene[] = input.scenes.map((scene, index) => ({
    id: scene.id,
    title: scene.title,
    description: scene.description,
    map: generateTabletopMap({
      seed: `legacy-${scene.id}`,
      theme: index % 2 === 0 ? "stone" : "mansion",
    }),
    createdAt: scene.created_at,
    updatedAt: scene.updated_at,
  }));
  const state: TabletopState = {
    roomId: input.roomId,
    activeSceneId:
      input.scenes.find((scene) => scene.is_active)?.id || input.scenes[0]?.id || null,
    scenes,
    tokens: input.markers.map((marker, index) => {
      const scene = scenes.find((item) => item.id === marker.scene_id);
      const gridSize = scene?.map.config.gridSize || TABLETOP_WORLD_DEFAULTS.gridSize;
      const width = (scene?.map.config.width || TABLETOP_WORLD_DEFAULTS.width) * gridSize;
      const height =
        (scene?.map.config.height || TABLETOP_WORLD_DEFAULTS.height) * gridSize;
      return {
        id: marker.id,
        roomId: marker.room_id,
        sceneId: marker.scene_id,
        characterId: marker.character_id,
        x: Math.round((marker.x / 100) * width),
        y: Math.round((marker.y / 100) * height),
        size: TABLETOP_TOKEN_SIZE,
        rotation: 0,
        zIndex: index + 1,
        isHidden: marker.is_hidden,
        isLocked: false,
        label: marker.label,
        updatedAt: marker.updated_at,
      };
    }),
    shapes: [],
    fogRegions: [],
    updatedAt: new Date().toISOString(),
  };

  if (state.scenes.length === 0) {
    const scene = createInitialTabletopScene("调查现场");
    state.scenes = [scene];
    state.activeSceneId = scene.id;
  }

  return normalizeTabletopState(state);
}

export function getMapPixelSize(scene: TabletopScene | null) {
  if (!scene) return { width: 0, height: 0 };
  return {
    width: scene.map.config.width * scene.map.config.gridSize,
    height: scene.map.config.height * scene.map.config.gridSize,
  };
}

export function getDefaultTokenPositionForScene(scene: TabletopScene | null) {
  if (!scene) return { x: TABLETOP_WORLD_DEFAULTS.gridSize, y: TABLETOP_WORLD_DEFAULTS.gridSize };

  const gridSize = scene.map.config.gridSize;
  const spawnTile =
    scene.map.tiles.find(
      (tile) => tile.revealed && (tile.kind === "floor" || tile.kind === "door")
    ) ||
    scene.map.tiles.find((tile) => tile.kind === "floor" || tile.kind === "door");

  if (!spawnTile) {
    return {
      x: Math.round((scene.map.config.width * gridSize) / 2),
      y: Math.round((scene.map.config.height * gridSize) / 2),
    };
  }

  return {
    x: Math.round((spawnTile.x + 0.5) * gridSize),
    y: Math.round((spawnTile.y + 0.5) * gridSize),
  };
}

export function applyRevealedRect(input: {
  state: TabletopState;
  sceneId: string;
  rect: { x: number; y: number; width: number; height: number };
  reveal: boolean;
}) {
  const nextState: TabletopState = {
    ...input.state,
    scenes: input.state.scenes.map((scene) => {
      if (scene.id !== input.sceneId) return scene;
      return {
        ...scene,
        map: {
          ...scene.map,
          tiles: scene.map.tiles.map((tile) => {
            const pixelX = tile.x * scene.map.config.gridSize;
            const pixelY = tile.y * scene.map.config.gridSize;
            const inside =
              pixelX >= input.rect.x &&
              pixelY >= input.rect.y &&
              pixelX < input.rect.x + input.rect.width &&
              pixelY < input.rect.y + input.rect.height;
            return inside ? { ...tile, revealed: input.reveal } : tile;
          }),
        },
        updatedAt: new Date().toISOString(),
      };
    }),
    updatedAt: new Date().toISOString(),
  };
  return normalizeTabletopState(nextState);
}

export function upsertTabletopTokenLocally(
  state: TabletopState,
  token: TabletopToken
) {
  return normalizeTabletopState({
    ...state,
    tokens: state.tokens.some((item) => item.id === token.id)
      ? state.tokens.map((item) => (item.id === token.id ? token : item))
      : [...state.tokens, token],
    updatedAt: new Date().toISOString(),
  });
}

export function mergeTabletopTokensFromBootstrap(
  state: TabletopState,
  tokens: TabletopToken[] = []
) {
  if (tokens.length === 0) return normalizeTabletopState(state);

  const sceneIds = new Set(state.scenes.map((scene) => scene.id));
  const normalizedTokens = tokens
    .filter((token) => token.roomId === state.roomId && sceneIds.has(token.sceneId))
    .map((token) => ({
      ...token,
      x: clampTabletopCoordinate(Number(token.x), 0),
      y: clampTabletopCoordinate(Number(token.y), 0),
      size: clampTabletopCoordinate(Number(token.size || TABLETOP_TOKEN_SIZE), 12, 180),
      rotation: clampTabletopCoordinate(Number(token.rotation || 0)),
      zIndex: clampTabletopCoordinate(Number(token.zIndex || 1), 0),
      isHidden: Boolean(token.isHidden),
      isLocked: Boolean(token.isLocked),
      label: token.label || null,
    }));

  const bootstrapKeys = new Set(
    normalizedTokens.map((token) => `${token.sceneId}:${token.characterId}`)
  );
  const bootstrapIds = new Set(normalizedTokens.map((token) => token.id));

  return normalizeTabletopState({
    ...state,
    tokens: [
      ...state.tokens.filter(
        (token) =>
          !bootstrapIds.has(token.id) &&
          !bootstrapKeys.has(`${token.sceneId}:${token.characterId}`)
      ),
      ...normalizedTokens,
    ],
    updatedAt: new Date().toISOString(),
  });
}

export function createTabletopShape(input: {
  sceneId: string;
  kind: TabletopShape["kind"];
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}): TabletopShape {
  const now = new Date().toISOString();
  const isText = input.kind === "text";
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : createSeed("shape"),
    sceneId: input.sceneId,
    kind: input.kind,
    x: clampTabletopCoordinate(input.x),
    y: clampTabletopCoordinate(input.y),
    width: clampTabletopCoordinate(input.width || (isText ? 160 : 1), 1),
    height: clampTabletopCoordinate(input.height || (isText ? 32 : 1), 1),
    text: isText ? input.text || "文本" : undefined,
    fill:
      input.kind === "text"
        ? "#e2e8f0"
        : input.kind === "circle"
        ? "rgba(59,130,246,0.16)"
        : "rgba(16,185,129,0.14)",
    stroke:
      input.kind === "text"
        ? "rgba(226,232,240,0.28)"
        : input.kind === "circle"
          ? "#60a5fa"
          : "#34d399",
    strokeWidth: isText ? 1 : 2,
    zIndex: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertTabletopShapeLocally(
  state: TabletopState,
  shape: TabletopShape
) {
  return normalizeTabletopState({
    ...state,
    shapes: (state.shapes || []).some((item) => item.id === shape.id)
      ? state.shapes.map((item) => (item.id === shape.id ? shape : item))
      : [...(state.shapes || []), shape],
    updatedAt: new Date().toISOString(),
  });
}

export function updateTabletopMapTileLocally(
  state: TabletopState,
  sceneId: string,
  tileUpdate: Pick<TabletopMapTile, "x" | "y" | "kind">
) {
  return normalizeTabletopState({
    ...state,
    scenes: state.scenes.map((scene) => {
      if (scene.id !== sceneId) return scene;
      return {
        ...scene,
        map: {
          ...scene.map,
          tiles: scene.map.tiles.map((tile) => {
            if (tile.x !== tileUpdate.x || tile.y !== tileUpdate.y) return tile;
            return {
              ...tile,
              kind: tileUpdate.kind,
              roomId:
                tileUpdate.kind === "wall" || tileUpdate.kind === "void"
                  ? undefined
                  : tile.roomId,
            };
          }),
        },
        updatedAt: new Date().toISOString(),
      };
    }),
    updatedAt: new Date().toISOString(),
  });
}

export function removeTabletopShapeLocally(state: TabletopState, shapeId: string) {
  return normalizeTabletopState({
    ...state,
    shapes: (state.shapes || []).filter((shape) => shape.id !== shapeId),
    updatedAt: new Date().toISOString(),
  });
}

export function removeTabletopSceneLocally(
  state: TabletopState,
  sceneId: string
) {
  const scenes = state.scenes.filter((scene) => scene.id !== sceneId);
  return normalizeTabletopState({
    ...state,
    scenes,
    activeSceneId:
      state.activeSceneId === sceneId
        ? scenes[0]?.id || null
        : state.activeSceneId,
    tokens: state.tokens.filter((token) => token.sceneId !== sceneId),
    shapes: state.shapes.filter((shape) => shape.sceneId !== sceneId),
    fogRegions: state.fogRegions.filter((region) => region.sceneId !== sceneId),
    updatedAt: new Date().toISOString(),
  });
}

export function removeTabletopTokenLocally(state: TabletopState, tokenId: string) {
  return normalizeTabletopState({
    ...state,
    tokens: state.tokens.filter((token) => token.id !== tokenId),
    updatedAt: new Date().toISOString(),
  });
}
