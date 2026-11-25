import React from "react";
import {
  Check,
  Circle,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Type,
  Users,
} from "lucide-react";
import type {
  Character,
  FogRegion,
  TabletopMapTile,
  TabletopShape,
  TabletopState,
  TabletopToken,
} from "../../types";
import {
  applyBlueprintFogRect,
  createEmptyTabletopMap,
  createInitialTabletopScene,
  createTabletopShape,
  createTokenFromCharacter,
  getActiveTabletopScene,
  getDefaultTokenPositionForScene,
  normalizeTabletopState,
  removeTabletopFogRegionLocally,
  removeTabletopShapeLocally,
  removeTabletopTokenLocally,
  upsertTabletopFogRegionLocally,
  upsertTabletopShapeLocally,
  upsertTabletopTokenLocally,
  updateTabletopMapTileLocally,
} from "../../services/tabletopModel";
import { cn } from "../UI";
import { TabletopCanvas } from "../tabletop/TabletopCanvas";
import { convertLegacyTilesToBlueprintShapes } from "../tabletop/blueprintContourModel";
export {
  createModuleSceneTabletopState,
  getModuleSceneFormFromTabletopState,
} from "./moduleSceneModel";
import type { TabletopTool } from "../tabletop/tabletopTools";

interface ModuleSceneCanvasEditorProps {
  value: TabletopState;
  characters?: Character[];
  disabled: boolean;
  onChange: (state: TabletopState) => void;
}

const EDITOR_TOOLS: Array<{
  id: TabletopTool;
  label: string;
  hint: string;
  icon: typeof MousePointer2;
}> = [
  {
    id: "select",
    label: "拖动 / 选择",
    hint: "点击选中任意图形、连线、文字或迷雾；可拖四角缩放、调曲率或按 Delete 删除",
    icon: MousePointer2,
  },
  {
    id: "rect",
    label: "矩形",
    hint: "拖出矩形空间（按住 Shift 锁定正方形），选中后可调圆角曲率（直角到胶囊）",
    icon: Square,
  },
  {
    id: "circle",
    label: "椭圆",
    hint: "自由拖出椭圆形区域（按住 Shift 锁定正圆，可连续绘制）",
    icon: Circle,
  },
  {
    id: "line",
    label: "连线 / 曲线",
    hint: "拖出直线或通道连线，选中后拖动中间紫点或用滑块自由调节曲率",
    icon: Minus,
  },
  {
    id: "text",
    label: "文字",
    hint: "点击画布放置房间名或线索标注，选中后可直接修改文本",
    icon: Type,
  },
  {
    id: "hide",
    label: "遮蔽迷雾",
    hint: "拖出迷雾遮蔽区；切回「拖动 / 选择」点击遮蔽区并删除，角色即可看到该区域",
    icon: EyeOff,
  },
];

function getCharacterBeaconColor(character: Character, hidden = false) {
  if (hidden) return "#94a3b8";
  if (character.theme_color) return character.theme_color;
  if (character.type === "monster") return "#f43f5e";
  if (character.type === "npc") return "#f59e0b";
  return "#9396f7";
}

export const ModuleSceneCanvasEditor: React.FC<ModuleSceneCanvasEditorProps> = ({
  value,
  characters = [],
  disabled,
  onChange,
}) => {
  const initialStateRef = React.useRef<TabletopState>(
    JSON.parse(JSON.stringify(value))
  );
  const [tool, setTool] = React.useState<TabletopTool>("select");
  const [selectedTokenId, setSelectedTokenId] = React.useState<string | null>(
    null
  );
  const [fitRequest, setFitRequest] = React.useState(0);
  const [scale, setScale] = React.useState(1);

  const activeScene = getActiveTabletopScene(value);

  // Automatically upgrade any legacy tile-based scene (e.g. 常暗列车地图) into editable vector blueprint rectangles & connectors
  React.useEffect(() => {
    if (!activeScene || disabled) return;
    const hasLegacyFloor = activeScene.map.tiles.some(
      (tile) => tile.kind === "floor" || tile.kind === "door"
    );
    if (!hasLegacyFloor) return;
    onChange(convertLegacyTilesToBlueprintShapes(value, activeScene.id));
  }, [activeScene, disabled, onChange, value]);

  const charactersById = React.useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );

  const activeSceneTokens = React.useMemo(
    () => value.tokens.filter((token) => token.sceneId === activeScene?.id),
    [activeScene?.id, value.tokens]
  );

  const tokenByCharacterId = React.useMemo(
    () =>
      new Map(activeSceneTokens.map((token) => [token.characterId, token])),
    [activeSceneTokens]
  );

  const selectedToken = React.useMemo(
    () =>
      selectedTokenId
        ? activeSceneTokens.find((t) => t.id === selectedTokenId) || null
        : null,
    [activeSceneTokens, selectedTokenId]
  );

  const activeSceneShapesCount = React.useMemo(
    () => value.shapes.filter((s) => s.sceneId === activeScene?.id).length,
    [activeScene?.id, value.shapes]
  );

  const activeSceneFogCount = React.useMemo(
    () =>
      value.fogRegions.filter(
        (region) =>
          region.sceneId === activeScene?.id && region.mode === "hidden"
      ).length,
    [activeScene?.id, value.fogRegions]
  );

  const activeToolMeta =
    EDITOR_TOOLS.find((item) => item.id === tool) || EDITOR_TOOLS[0];

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
    setSelectedTokenId(null);
    setTool("select");
  }, [disabled, updateState]);

  const selectScene = React.useCallback(
    (sceneId: string) => {
      updateState((current) => ({
        ...current,
        activeSceneId: sceneId,
        updatedAt: new Date().toISOString(),
      }));
      setSelectedTokenId(null);
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
        tokens: current.tokens.filter(
          (token) => token.sceneId !== activeScene.id
        ),
        shapes: current.shapes.filter(
          (shape) => shape.sceneId !== activeScene.id
        ),
        fogRegions: current.fogRegions.filter(
          (region) => region.sceneId !== activeScene.id
        ),
        updatedAt: new Date().toISOString(),
      };
    });
    setSelectedTokenId(null);
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
      cornerRadius?: number;
      points?: number[];
      curvature?: number;
      dashed?: boolean;
      arrowEnd?: boolean;
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
      const existing = tokenByCharacterId.get(character.id);
      if (existing) {
        setSelectedTokenId(existing.id);
        setTool("select");
        return;
      }

      // Spawn inside first blueprint room if one exists, otherwise scene center
      const sceneShapes = value.shapes.filter(
        (s) => s.sceneId === activeScene.id && s.kind !== "text"
      );
      const basePosition =
        sceneShapes.length > 0
          ? {
              x: Math.round(sceneShapes[0].x + sceneShapes[0].width / 2),
              y: Math.round(sceneShapes[0].y + sceneShapes[0].height / 2),
            }
          : getDefaultTokenPositionForScene(activeScene);

      const offsetIndex = activeSceneTokens.length;
      const token = createTokenFromCharacter({
        roomId: value.roomId,
        sceneId: activeScene.id,
        character,
        x: basePosition.x + (offsetIndex % 4) * 56,
        y: basePosition.y + Math.floor(offsetIndex / 4) * 56,
        hidden: character.type === "monster",
      });
      updateState((current) => upsertTabletopTokenLocally(current, token));
      setSelectedTokenId(token.id);
      setTool("select");
    },
    [
      activeScene,
      activeSceneTokens.length,
      disabled,
      tokenByCharacterId,
      updateState,
      value.roomId,
      value.shapes,
    ]
  );

  const moveToken = React.useCallback(
    async (token: TabletopToken, position: { x: number; y: number }) => {
      if (disabled) return;
      updateState((current) => {
        const existing = current.tokens.find((t) => t.id === token.id);
        if (!existing) return current;
        return upsertTabletopTokenLocally(current, {
          ...existing,
          x: Math.round(position.x),
          y: Math.round(position.y),
          updatedAt: new Date().toISOString(),
        });
      });
    },
    [disabled, updateState]
  );

  const toggleTokenHiddenById = React.useCallback(
    async (tokenId: string) => {
      if (disabled) return;
      updateState((current) => {
        const existing = current.tokens.find((t) => t.id === tokenId);
        if (!existing) return current;
        return upsertTabletopTokenLocally(current, {
          ...existing,
          isHidden: !existing.isHidden,
          updatedAt: new Date().toISOString(),
        });
      });
    },
    [disabled, updateState]
  );

  const toggleTokenHidden = React.useCallback(
    async (token: TabletopToken) => {
      await toggleTokenHiddenById(token.id);
    },
    [toggleTokenHiddenById]
  );

  const deleteToken = React.useCallback(
    async (tokenId: string) => {
      if (disabled) return;
      if (selectedTokenId === tokenId) {
        setSelectedTokenId(null);
      }
      updateState((current) => removeTabletopTokenLocally(current, tokenId));
    },
    [disabled, selectedTokenId, updateState]
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
      updateState((current) =>
        applyBlueprintFogRect({
          state: current,
          sceneId: activeScene.id,
          rect,
          reveal,
        })
      );
    },
    [activeScene, disabled, updateState]
  );

  const updateFogRegion = React.useCallback(
    async (region: FogRegion) => {
      if (disabled) return;
      updateState((current) => upsertTabletopFogRegionLocally(current, region));
    },
    [disabled, updateState]
  );

  const deleteFogRegion = React.useCallback(
    async (regionId: string) => {
      if (disabled) return;
      updateState((current) =>
        removeTabletopFogRegionLocally(current, regionId)
      );
    },
    [disabled, updateState]
  );

  const resetToInitial = React.useCallback(() => {
    if (disabled) return;
    const restored: TabletopState = JSON.parse(
      JSON.stringify(initialStateRef.current)
    );
    onChange(normalizeTabletopState(restored));
    setSelectedTokenId(null);
    setFitRequest((request) => request + 1);
  }, [disabled, onChange]);

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
      {/* Top Scene Strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dicecho-border/45 bg-dicecho-panel/75 p-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {value.scenes.map((scene, index) => {
            const isActive = scene.id === activeScene?.id;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
                className={cn(
                  "h-8 rounded-lg border px-3 text-left text-xs font-semibold transition-colors",
                  isActive
                    ? "border-[#9396f7]/60 bg-[#9396f7]/18 text-white"
                    : "border-dicecho-border/40 bg-dicecho-card/65 text-dicecho-muted hover:text-white"
                )}
              >
                <span>{scene.title || `场景 ${index + 1}`}</span>
                {index === 0 && (
                  <span className="ml-1.5 rounded bg-[#9396f7]/25 px-1 py-0.5 text-[10px] text-[#c7d2fe]">
                    默认
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            onClick={addScene}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-dashed border-dicecho-border/55 bg-dicecho-card/40 px-2.5 text-xs font-semibold text-dicecho-muted transition-colors hover:border-[#9396f7]/55 hover:text-white disabled:opacity-40"
          >
            <Plus size={13} />
            新增场景
          </button>
        </div>

        <label className="flex h-8 min-w-[13rem] max-w-full items-center gap-2 rounded-lg border border-dicecho-border/45 bg-dicecho-bg/65 px-2.5 text-xs text-dicecho-muted">
          <span className="shrink-0 font-semibold">场景名</span>
          <input
            value={activeScene?.title || ""}
            disabled={disabled}
            onChange={(event) =>
              updateActiveScene({ title: event.target.value })
            }
            placeholder="例如：常暗列车"
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-dicecho-muted/60 disabled:opacity-60"
          />
        </label>
      </div>

      {/* Main Blueprint Studio Shell */}
      <div className="overflow-hidden rounded-xl border border-[#9396f7]/25 bg-[#242a38] shadow-xl">
        {/* Clean Minimalist Peer Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#2a3142]/95 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {EDITOR_TOOLS.map((item) => {
              const isActive = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTool(item.id)}
                  title={item.hint}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-40",
                    isActive
                      ? "border-[#9396f7]/65 bg-[#9396f7]/22 text-white shadow-sm"
                      : "border-transparent text-[#b0bccc] hover:bg-white/8 hover:text-white"
                  )}
                >
                  <item.icon size={13} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={resetToInitial}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-[#e4e5eb] transition-colors hover:border-[#9396f7]/45 hover:bg-white/10 disabled:opacity-40"
              title="恢复到打开编辑器时的初始地图与角色点位"
            >
              <RotateCcw size={12} />
              回到初始
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearMap}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-[#b0bccc] transition-colors hover:border-red-400/45 hover:text-red-200 disabled:opacity-40"
              title="清空当前场景的所有图形与迷雾（保留角色点位）"
            >
              清空
            </button>
            <button
              type="button"
              onClick={() => setFitRequest((request) => request + 1)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-[#e4e5eb] transition-colors hover:border-[#9396f7]/45 hover:text-white tabular-nums"
              title="重置视图居中显示"
            >
              <Crosshair size={12} />
              {Math.round(scale * 100)}%
            </button>
            {value.scenes.length > 1 && (
              <button
                type="button"
                disabled={disabled}
                onClick={deleteActiveScene}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/10 text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                title="删除当前场景"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Canvas + Right Character Beacon Rail */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_256px]">
          {/* Left: Pure Blueprint Canvas */}
          <div className="relative h-[470px] w-full border-b border-white/10 lg:border-b-0 lg:border-r">
            <TabletopCanvas
              state={value}
              scene={activeScene}
              characters={charactersById}
              isKeeper
              selectedTokenId={selectedTokenId}
              tool={tool}
              mapBrush="floor"
              onToolChange={setTool}
              onSelectedTokenChange={setSelectedTokenId}
              canMoveToken={() => !disabled}
              onTokenMove={moveToken}
              onCreateShape={createShape}
              onUpdateShape={updateShape}
              onDeleteShape={deleteShape}
              onUpdateMapTile={updateMapTile}
              onDeleteToken={deleteToken}
              onToggleTokenHidden={toggleTokenHidden}
              onRevealRect={(rect) => applyFogRect(rect, true)}
              onHideRect={(rect) => applyFogRect(rect, false)}
              onUpdateFogRegion={updateFogRegion}
              onDeleteFogRegion={deleteFogRegion}
              onScaleChange={setScale}
              fitRequest={fitRequest}
              fitToSceneBounds
              persistViewport={false}
            />
          </div>

          {/* Right: Minimalist Character Beacon Linkage Panel */}
          <aside className="flex h-[470px] flex-col bg-[#202634]">
            <div className="border-b border-white/10 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Users size={13} className="text-[#9396f7]" />
                  <span>角色光点布阵</span>
                </div>
                <span className="rounded-full bg-[#9396f7]/15 px-2 py-0.5 text-[10px] font-semibold text-[#c7d2fe] tabular-nums">
                  {activeSceneTokens.length} / {characters.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9aa6b8]">
                画布中的每个发光点均与下方 NPC / 怪物绑定，开团后自动带入对应位置与隐身状态。
              </p>
            </div>

            {/* Selected Beacon Inspector */}
            {selectedToken && (
              <div className="border-b border-[#9396f7]/25 bg-[#9396f7]/10 px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#c7d2fe]">
                      当前选中光点
                    </div>
                    <div className="truncate text-xs font-bold text-white">
                      {selectedToken.label ||
                        charactersById.get(selectedToken.characterId)?.name ||
                        "角色点位"}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      selectedToken.isHidden
                        ? "bg-slate-600/50 text-slate-200"
                        : "bg-emerald-500/20 text-emerald-200"
                    )}
                  >
                    {selectedToken.isHidden ? "玩家不可见" : "玩家可见"}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void toggleTokenHiddenById(selectedToken.id)}
                    className="flex-1 inline-flex h-7 items-center justify-center gap-1 rounded-md border border-white/15 bg-white/5 text-[11px] font-semibold text-[#e4e5eb] hover:border-[#9396f7]/50 hover:text-white disabled:opacity-40"
                  >
                    {selectedToken.isHidden ? (
                      <>
                        <Eye size={11} /> 设为可见
                      </>
                    ) : (
                      <>
                        <EyeOff size={11} /> 设为隐藏
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void deleteToken(selectedToken.id)}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-red-400/35 bg-red-500/12 px-2.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/22 disabled:opacity-40"
                  >
                    <Trash2 size={11} /> 移除
                  </button>
                </div>
              </div>
            )}

            {/* Character Beacon List */}
            <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5 custom-scrollbar">
              {characters.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 text-center text-[11px] leading-relaxed text-[#9aa6b8]">
                  先在下方「预设 NPC 与怪物」中添加角色，即可一键放置为画布中的发光点。
                </div>
              ) : (
                characters.map((character) => {
                  const placedToken = tokenByCharacterId.get(character.id);
                  const isSelected =
                    Boolean(placedToken) && selectedTokenId === placedToken?.id;
                  const beaconColor = getCharacterBeaconColor(
                    character,
                    Boolean(placedToken?.isHidden)
                  );
                  const isMonster = character.type === "monster";

                  return (
                    <div
                      key={character.id}
                      onClick={() => {
                        if (placedToken) {
                          setSelectedTokenId(placedToken.id);
                          setTool("select");
                        }
                      }}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                        placedToken ? "cursor-pointer" : "",
                        isSelected
                          ? "border-[#9396f7]/65 bg-[#9396f7]/14"
                          : placedToken
                            ? "border-white/10 bg-white/[0.04] hover:border-[#9396f7]/40"
                            : "border-white/[0.06] bg-white/[0.015] hover:border-white/15"
                      )}
                    >
                      {/* Mini concentric beacon matching canvas dot */}
                      <div
                        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${beaconColor}26` }}
                      >
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${beaconColor}55` }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: placedToken?.isHidden
                                ? "#cbd5e1"
                                : "#ffffff",
                            }}
                          />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-white">
                            {character.name || "未命名角色"}
                          </span>
                          <span className="shrink-0 text-[10px] text-[#9aa6b8]">
                            {isMonster ? "怪物" : "NPC"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#9aa6b8]">
                          {placedToken
                            ? placedToken.isHidden
                              ? "已在图上 · 隐藏"
                              : "已在图上 · 可见"
                            : "未放置"}
                        </div>
                      </div>

                      {placedToken ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleTokenHiddenById(placedToken.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-[#b0bccc] hover:text-white disabled:opacity-40"
                            title={
                              placedToken.isHidden ? "设为可见" : "设为隐藏"
                            }
                          >
                            {placedToken.isHidden ? (
                              <EyeOff size={11} />
                            ) : (
                              <Eye size={11} />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteToken(placedToken.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-[#b0bccc] hover:border-red-400/40 hover:text-red-200 disabled:opacity-40"
                            title="移出场景"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            addCharacterToken(character);
                          }}
                          className="shrink-0 inline-flex h-6 items-center gap-0.5 rounded-md border border-[#9396f7]/45 bg-[#9396f7]/15 px-2 text-[10px] font-semibold text-[#c7d2fe] hover:bg-[#9396f7]/25 disabled:opacity-40"
                        >
                          <Plus size={10} /> 放入
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Minimalist Role Legend & Footer */}
            <div className="border-t border-white/10 bg-[#1c212f] px-3.5 py-2.5 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#9aa6b8]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#9396f7]" />
                  调查员
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                  NPC
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
                  怪物
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-dashed border-slate-400" />
                  隐藏
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#8f9bb0]">
                <Info size={11} className="mt-0.5 shrink-0 text-[#9396f7]" />
                <span>
                  {activeToolMeta.hint}
                  {activeSceneShapesCount > 0 || activeSceneFogCount > 0
                    ? `（当前：${activeSceneShapesCount} 图形 · ${activeSceneFogCount} 迷雾）`
                    : ""}
                </span>
              </div>
              {activeSceneTokens.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-300/90">
                  <Check size={11} />
                  <span>
                    已同步关联 {activeSceneTokens.length} 个角色光点
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Scene Keeper Note */}
      <input
        value={activeScene?.description || ""}
        disabled={disabled}
        onChange={(event) =>
          updateActiveScene({ description: event.target.value || null })
        }
        placeholder="场景备注（可选）：写给 KP 的开场提示、光源氛围、机关触发条件..."
        className="w-full rounded-lg border border-dicecho-border/45 bg-dicecho-bg/65 px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-dicecho-muted/70 focus:border-[#9396f7]/60 disabled:opacity-60"
      />
    </div>
  );
};
