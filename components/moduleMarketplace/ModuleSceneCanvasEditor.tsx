import React from "react";
import {
  Check,
  Eye,
  EyeOff,
  MousePointer2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type {
  Character,
  FogRegion,
  TabletopMapTile,
  TabletopShape,
  TabletopState,
} from "../../types";
import {
  applyRevealedRect,
  createEmptyTabletopMap,
  createInitialTabletopScene,
  createTabletopShape,
  createTokenFromCharacter,
  generateTabletopMap,
  getActiveTabletopScene,
  getDefaultTokenPositionForScene,
  normalizeTabletopState,
  removeTabletopShapeLocally,
  removeTabletopTokenLocally,
  upsertTabletopTokenLocally,
  upsertTabletopShapeLocally,
  updateTabletopMapTileLocally,
} from "../../services/tabletopModel";
import { cn } from "../UI";
import { TabletopCanvas } from "../tabletop/TabletopCanvas";
export {
  createModuleSceneTabletopState,
  getModuleSceneFormFromTabletopState,
} from "./moduleSceneModel";
import {
  tabletopMapBrushes,
  tabletopShapeTools,
  type TabletopMapBrush,
  type TabletopTool,
} from "../tabletop/tabletopTools";

interface ModuleSceneCanvasEditorProps {
  value: TabletopState;
  characters?: Character[];
  disabled: boolean;
  onChange: (state: TabletopState) => void;
}

export const ModuleSceneCanvasEditor: React.FC<ModuleSceneCanvasEditorProps> = ({
  value,
  characters = [],
  disabled,
  onChange,
}) => {
  const [tool, setTool] = React.useState<TabletopTool>("select");
  const [mapBrush, setMapBrush] = React.useState<TabletopMapBrush>("floor");
  const [fitRequest, setFitRequest] = React.useState(0);
  const [scale, setScale] = React.useState(1);
  const activeScene = getActiveTabletopScene(value);
  const activeToolLabel =
    tabletopShapeTools.find((item) => item.id === tool)?.label || "选择 / 拖动";
  const activeBrushLabel =
    tabletopMapBrushes.find((brush) => brush.id === mapBrush)?.label || "地板";
  const charactersById = React.useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );
  const activeSceneTokens = React.useMemo(
    () =>
      value.tokens.filter((token) => token.sceneId === activeScene?.id),
    [activeScene?.id, value.tokens]
  );
  const placedCharacterIds = React.useMemo(
    () => new Set(activeSceneTokens.map((token) => token.characterId)),
    [activeSceneTokens]
  );

  const updateState = React.useCallback(
    (updater: (current: TabletopState) => TabletopState) => {
      onChange(normalizeTabletopState(updater(value)));
    },
    [onChange, value]
  );

  const updateActiveScene = React.useCallback(
    (patch: { title?: string; description?: string | null }) => {
      if (!activeScene) return;
      updateState((current) => ({
        ...current,
        scenes: current.scenes.map((scene) =>
          scene.id === activeScene.id
            ? {
                ...scene,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : scene
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [activeScene, updateState]
  );

  const addScene = React.useCallback(() => {
    if (disabled) return;
    updateState((current) => {
      const scene = createInitialTabletopScene(
        `场景 ${current.scenes.length + 1}`,
        {
          seed: `module-scene-${Date.now()}`,
        }
      );
      scene.map = createEmptyTabletopMap(scene.map.config);
      return {
        ...current,
        activeSceneId: scene.id,
        scenes: [...current.scenes, scene],
        updatedAt: new Date().toISOString(),
      };
    });
    setTool("select");
  }, [disabled, updateState]);

  const selectScene = React.useCallback(
    (sceneId: string) => {
      updateState((current) => ({
        ...current,
        activeSceneId: sceneId,
        updatedAt: new Date().toISOString(),
      }));
      setTool("select");
    },
    [updateState]
  );

  const deleteActiveScene = React.useCallback(() => {
    if (!activeScene || disabled || value.scenes.length <= 1) return;
    updateState((current) => {
      const remainingScenes = current.scenes.filter(
        (scene) => scene.id !== activeScene.id
      );
      return {
        ...current,
        activeSceneId: remainingScenes[0]?.id || null,
        scenes: remainingScenes,
        shapes: current.shapes.filter(
          (shape) => shape.sceneId !== activeScene.id
        ),
        fogRegions: current.fogRegions.filter(
          (region) => region.sceneId !== activeScene.id
        ),
        updatedAt: new Date().toISOString(),
      };
    });
    setTool("select");
  }, [activeScene, disabled, updateState, value.scenes.length]);

  const createShape = React.useCallback(
    async (shape: {
      kind: TabletopShape["kind"];
      x: number;
      y: number;
      width: number;
      height: number;
      text?: string;
    }) => {
      if (!activeScene || disabled) return;
      const nextShape = createTabletopShape({
        sceneId: activeScene.id,
        ...shape,
      });
      updateState((current) => upsertTabletopShapeLocally(current, nextShape));
    },
    [activeScene, disabled, updateState]
  );

  const updateShape = React.useCallback(
    async (shape: TabletopShape) => {
      if (!activeScene || disabled) return;
      updateState((current) =>
        upsertTabletopShapeLocally(current, {
          ...shape,
          updatedAt: new Date().toISOString(),
        })
      );
    },
    [activeScene, disabled, updateState]
  );

  const deleteShape = React.useCallback(
    async (shapeId: string) => {
      if (disabled) return;
      updateState((current) => removeTabletopShapeLocally(current, shapeId));
    },
    [disabled, updateState]
  );

  const addCharacterToken = React.useCallback(
    (character: Character) => {
      if (!activeScene || disabled) return;
      if (placedCharacterIds.has(character.id)) return;
      const position = getDefaultTokenPositionForScene(activeScene);
      const token = createTokenFromCharacter({
        roomId: value.roomId,
        sceneId: activeScene.id,
        character,
        x: position.x,
        y: position.y,
        hidden: character.type !== "investigator",
      });
      updateState((current) => upsertTabletopTokenLocally(current, token));
    },
    [activeScene, disabled, placedCharacterIds, updateState, value.roomId]
  );

  const deleteToken = React.useCallback(
    async (tokenId: string) => {
      if (disabled) return;
      updateState((current) => removeTabletopTokenLocally(current, tokenId));
    },
    [disabled, updateState]
  );

  const updateMapTile = React.useCallback(
    async (tile: Pick<TabletopMapTile, "x" | "y" | "kind">) => {
      if (!activeScene || disabled) return;
      updateState((current) =>
        updateTabletopMapTileLocally(current, activeScene.id, tile)
      );
    },
    [activeScene, disabled, updateState]
  );

  const applyFogRect = React.useCallback(
    async (
      rect: { x: number; y: number; width: number; height: number },
      reveal: boolean
    ) => {
      if (!activeScene || disabled) return;
      updateState((current) => {
        const region: FogRegion = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `fog-${Date.now()}`,
          sceneId: activeScene.id,
          shape: "rect",
          points: [rect.x, rect.y, rect.width, rect.height],
          mode: reveal ? "revealed" : "hidden",
        };
        const next = applyRevealedRect({
          state: current,
          sceneId: activeScene.id,
          rect,
          reveal,
        });
        return {
          ...next,
          fogRegions: [...next.fogRegions, region],
        };
      });
    },
    [activeScene, disabled, updateState]
  );

  const randomizeMap = React.useCallback(() => {
    if (!activeScene || disabled) return;
    updateState((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === activeScene.id
          ? {
              ...scene,
              map: generateTabletopMap({
                ...scene.map.config,
                seed: `${scene.id}-${Date.now()}`,
              }),
              updatedAt: new Date().toISOString(),
            }
          : scene
      ),
      shapes: current.shapes.filter((shape) => shape.sceneId !== activeScene.id),
      fogRegions: current.fogRegions.filter(
        (region) => region.sceneId !== activeScene.id
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, [activeScene, disabled, updateState]);

  const clearMap = React.useCallback(() => {
    if (!activeScene || disabled) return;
    updateState((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === activeScene.id
          ? {
              ...scene,
              map: createEmptyTabletopMap(scene.map.config),
              updatedAt: new Date().toISOString(),
            }
          : scene
      ),
      shapes: current.shapes.filter((shape) => shape.sceneId !== activeScene.id),
      fogRegions: current.fogRegions.filter(
        (region) => region.sceneId !== activeScene.id
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, [activeScene, disabled, updateState]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {value.scenes.map((scene, index) => {
            const isActive = scene.id === activeScene?.id;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
                className={cn(
                  "h-8 rounded-md border px-3 text-left text-xs font-semibold transition-colors",
                  isActive
                    ? "border-dicecho-primary/55 bg-dicecho-primary/18 text-white"
                    : "border-dicecho-border/35 bg-dicecho-panel/55 text-dicecho-muted hover:text-white"
                )}
              >
                <span>{scene.title || `场景 ${index + 1}`}</span>
                {index === 0 && (
                  <span className="ml-1 text-[10px] text-dicecho-primary">起始</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={addScene}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-dicecho-border/40 bg-dicecho-panel/60 px-2.5 text-xs font-bold text-slate-200 transition-colors hover:border-dicecho-primary/50 hover:text-white disabled:opacity-40"
        >
          <Plus size={14} />
          新增场景
        </button>
        <label className="flex h-8 min-w-[12rem] max-w-full items-center gap-2 rounded-md border border-dicecho-border/35 bg-dicecho-panel/55 px-2.5 text-xs text-dicecho-muted">
          <span className="shrink-0 font-semibold">名称</span>
          <input
            value={activeScene?.title || ""}
            disabled={disabled}
            onChange={(event) => updateActiveScene({ title: event.target.value })}
            placeholder="候车大厅"
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-dicecho-muted disabled:opacity-60"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-dicecho-border/45 bg-[#0d1322]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dicecho-border/35 bg-dicecho-card/70 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-dicecho-border/35 bg-dicecho-panel/55 p-1">
            {tabletopShapeTools.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  setTool((current) => (current === item.id ? "select" : item.id))
                }
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors disabled:opacity-40",
                  tool === item.id
                    ? "bg-dicecho-primary/24 text-white"
                    : "text-dicecho-muted hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon size={15} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-dicecho-primary/14 px-2.5 py-1 text-xs font-semibold text-dicecho-primary sm:inline-flex">
              {tool === "map" ? activeBrushLabel : activeToolLabel}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={randomizeMap}
              className="flex h-8 items-center gap-1.5 rounded-full border border-dicecho-border/40 bg-dicecho-panel/60 px-2.5 text-xs font-bold text-slate-200 transition-colors hover:border-dicecho-primary/50 hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={13} />
              随机生成
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearMap}
              className="flex h-8 items-center gap-1.5 rounded-full border border-dicecho-border/40 bg-dicecho-panel/60 px-2.5 text-xs font-bold text-slate-200 transition-colors hover:border-dicecho-primary/50 hover:text-white disabled:opacity-40"
            >
              清空地图
            </button>
            <button
              type="button"
              onClick={() => setFitRequest((request) => request + 1)}
              className="h-8 rounded-full border border-dicecho-border/40 bg-dicecho-panel/60 px-2.5 text-xs font-bold text-slate-200 transition-colors hover:border-dicecho-primary/50 hover:text-white"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              disabled={disabled || value.scenes.length <= 1}
              onClick={deleteActiveScene}
              className="flex h-8 items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 text-xs font-bold text-red-200 transition-colors hover:border-red-400/45 hover:text-white disabled:opacity-40"
            >
              <Trash2 size={13} />
              删除场景
            </button>
          </div>
        </div>

        {characters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-dicecho-border/30 bg-dicecho-panel/35 px-3 py-2">
            <span className="text-xs font-bold text-white">放入地图</span>
            {characters.map((character) => {
              const isPlaced = placedCharacterIds.has(character.id);
              return (
                <button
                  key={character.id}
                  type="button"
                  disabled={disabled || isPlaced}
                  onClick={() => addCharacterToken(character)}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-full border px-2.5 text-xs font-bold transition-colors disabled:opacity-50",
                    isPlaced
                      ? "border-dicecho-primary/35 bg-dicecho-primary/14 text-dicecho-primary"
                      : "border-dicecho-border/35 bg-dicecho-card/55 text-dicecho-muted hover:border-dicecho-primary/50 hover:text-white"
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-white/25"
                    style={{
                      backgroundColor:
                        character.theme_color ||
                        (character.type === "monster" ? "#fb7185" : "#22d3ee"),
                    }}
                  />
                  {character.name}
                  {isPlaced && <span className="text-[10px]">已放置</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="relative aspect-[3/2] max-h-[calc(90vh-17rem)] min-h-[28rem] w-full">
          {tool === "map" && (
            <div className="pointer-events-auto absolute left-3 top-3 z-20 w-44 rounded-2xl border border-dicecho-border/45 bg-dicecho-card/90 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold text-white">地图编辑</span>
                <span className="rounded-full bg-dicecho-primary/18 px-2 py-0.5 text-[10px] font-bold text-dicecho-primary">
                  {activeBrushLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {tabletopMapBrushes.map((brush) => (
                  <button
                    key={brush.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setMapBrush(brush.id);
                      setTool("map");
                    }}
                    title={brush.label}
                    aria-label={brush.label}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-bold transition-colors disabled:opacity-40",
                      mapBrush === brush.id
                        ? "bg-dicecho-primary/24 text-white ring-1 ring-dicecho-primary/60"
                        : "text-dicecho-muted hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded-[4px] border border-white/25",
                        brush.className
                      )}
                    />
                    <span>{brush.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <TabletopCanvas
            state={value}
            scene={activeScene}
            characters={charactersById}
            isKeeper={!disabled}
            selectedTokenId={null}
            tool={disabled ? "select" : tool}
            mapBrush={mapBrush}
            onToolChange={setTool}
            onSelectedTokenChange={() => undefined}
            canMoveToken={() => false}
            onTokenMove={async () => undefined}
            onCreateShape={createShape}
            onUpdateShape={updateShape}
            onDeleteShape={deleteShape}
            onUpdateMapTile={updateMapTile}
            onDeleteToken={deleteToken}
            onToggleTokenHidden={async () => undefined}
            onRevealRect={(rect) => applyFogRect(rect, true)}
            onHideRect={(rect) => applyFogRect(rect, false)}
            fitRequest={fitRequest}
            onScaleChange={setScale}
            fitToSceneBounds
            persistViewport={false}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-dicecho-border/30 bg-dicecho-card/60 px-3 py-2 text-xs text-dicecho-muted">
          <span className="inline-flex items-center gap-1.5">
            <MousePointer2 size={13} /> 拖动画布移动，滚轮缩放
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check size={13} /> 地图、图形和可见范围会随模组保存
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye size={13} /> 揭示
          </span>
          <span className="inline-flex items-center gap-1.5">
            <EyeOff size={13} /> 遮蔽
          </span>
        </div>
      </div>
    </div>
  );
};
