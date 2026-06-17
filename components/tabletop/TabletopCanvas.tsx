import React from "react";
import { Circle, Group, Image, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { MousePointer2, Plus } from "lucide-react";
import type {
  Character,
  TabletopScene,
  TabletopShape,
  TabletopState,
  TabletopToken,
} from "../../types";
import {
  clampTabletopCoordinate,
  getMapPixelSize,
} from "../../services/tabletopModel";
import type { TabletopMapBrush, TabletopTool } from "./tabletopTools";
import { Button, cn } from "../UI";
import {
  createFittedTabletopViewport,
  createMapBoundsFittedTabletopViewport,
  createTabletopDraftRect,
  createTextShapeDraft,
  createZoomedTabletopViewport,
  getMapTileAtWorldPoint,
  getTabletopViewportStorageKey,
  parseSavedTabletopViewport,
  projectViewportPointToWorld,
  type TabletopStageState,
} from "./tabletopCanvasModel";

const MIN_SHAPE_SIZE = 16;
const MAJOR_GRID_INTERVAL = 5;
const TOKEN_NODE_NAME = "tabletop-token";
const SHAPE_NODE_NAME = "tabletop-shape";
const HIDDEN_TOKEN_FILL = "#64748b";
const HIDDEN_TOKEN_AVATAR_OVERLAY = "rgba(100,116,139,0.46)";

const viewportMemory = new Map<string, TabletopStageState>();

function readSavedViewport(key: string): TabletopStageState | null {
  const memory = viewportMemory.get(key);
  if (memory) return memory;

  return parseSavedTabletopViewport(window.localStorage.getItem(key));
}

function writeSavedViewport(key: string, viewport: TabletopStageState) {
  viewportMemory.set(key, viewport);
  window.localStorage.setItem(key, JSON.stringify(viewport));
}

interface TabletopCanvasProps {
  state: TabletopState;
  scene: TabletopScene | null;
  characters: Map<string, Character>;
  isKeeper: boolean;
  selectedTokenId: string | null;
  tool: TabletopTool;
  mapBrush: TabletopMapBrush;
  onToolChange: (tool: TabletopTool) => void;
  onSelectedTokenChange: (tokenId: string | null) => void;
  canMoveToken: (token: TabletopToken) => boolean;
  onTokenMove: (
    token: TabletopToken,
    position: { x: number; y: number }
  ) => Promise<void>;
  onCreateShape: (shape: {
    kind: TabletopShape["kind"];
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
  }) => Promise<void>;
  onUpdateShape: (shape: TabletopShape) => Promise<void>;
  onDeleteShape: (shapeId: string) => Promise<void>;
  onUpdateMapTile: (tile: { x: number; y: number; kind: TabletopMapBrush }) => Promise<void>;
  onDeleteToken: (tokenId: string) => Promise<void>;
  onToggleTokenHidden: (token: TabletopToken) => Promise<void>;
  onRevealRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
  onHideRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
  canCreateScene?: boolean;
  onCreateScene?: () => Promise<void>;
  onScaleChange: (scale: number) => void;
  fitRequest: number;
  fitToSceneBounds?: boolean;
  persistViewport?: boolean;
}

export const TabletopCanvas: React.FC<TabletopCanvasProps> = ({
  state,
  scene,
  characters,
  isKeeper,
  selectedTokenId,
  tool,
  mapBrush,
  onToolChange,
  onSelectedTokenChange,
  canMoveToken,
  onTokenMove,
  onCreateShape,
  onUpdateShape,
  onDeleteShape,
  onUpdateMapTile,
  onDeleteToken,
  onToggleTokenHidden,
  onRevealRect,
  onHideRect,
  canCreateScene = false,
  onCreateScene,
  onScaleChange,
  fitRequest,
  fitToSceneBounds = false,
  persistViewport = true,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage>(null);
  const textInputRef = React.useRef<HTMLInputElement>(null);
  const initializedViewportKeyRef = React.useRef<string | null>(null);
  const skipNextViewportSaveRef = React.useRef(false);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [stageState, setStageState] = React.useState<TabletopStageState>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [drawStart, setDrawStart] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [drawEnd, setDrawEnd] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [selectedShapeId, setSelectedShapeId] = React.useState<string | null>(
    null
  );
  const [textDraft, setTextDraft] = React.useState("文本");
  const [isPaintingMap, setIsPaintingMap] = React.useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const lastPaintedTileRef = React.useRef<string | null>(null);

  const gridSize = scene?.map.config.gridSize || 48;
  const tokens = React.useMemo(
    () =>
      state.tokens
        .filter((token) => token.sceneId === scene?.id)
        .sort((left, right) => left.zIndex - right.zIndex),
    [scene?.id, state.tokens]
  );
  const shapes = React.useMemo(
    () =>
      (state.shapes || [])
        .filter((shape) => shape.sceneId === scene?.id)
        .sort((left, right) => left.zIndex - right.zIndex),
    [scene?.id, state.shapes]
  );
  const selectedToken = React.useMemo(
    () => tokens.find((token) => token.id === selectedTokenId) || null,
    [selectedTokenId, tokens]
  );
  const viewportStorageKey = React.useMemo(
    () => getTabletopViewportStorageKey(state.roomId, scene?.id),
    [scene?.id, state.roomId]
  );

  const fitCanvas = React.useCallback(() => {
    const width = containerRef.current?.clientWidth || size.width;
    const height = containerRef.current?.clientHeight || size.height;
    const next =
      fitToSceneBounds && scene
        ? createMapBoundsFittedTabletopViewport({
            viewport: { width, height },
            map: getMapPixelSize(scene),
          })
        : createFittedTabletopViewport({ width, height });
    if (!next) return;
    setStageState(next);
    if (persistViewport) {
      writeSavedViewport(viewportStorageKey, next);
    }
    onScaleChange(next.scale);
  }, [
    fitToSceneBounds,
    onScaleChange,
    persistViewport,
    scene,
    size.height,
    size.width,
    viewportStorageKey,
  ]);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      const animationFrame = window.requestAnimationFrame(measure);
      window.addEventListener("resize", measure);
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("resize", measure);
      };
    }

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(0, Math.floor(entry.contentRect.width)),
        height: Math.max(0, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scene?.id]);

  React.useLayoutEffect(() => {
    if (!scene || !size.width || !size.height) return;
    if (initializedViewportKeyRef.current === viewportStorageKey) return;

    const saved = persistViewport ? readSavedViewport(viewportStorageKey) : null;
    skipNextViewportSaveRef.current = true;
    initializedViewportKeyRef.current = viewportStorageKey;

    if (saved) {
      setStageState(saved);
      onScaleChange(saved.scale);
      return;
    }

    fitCanvas();
  }, [
    fitCanvas,
    onScaleChange,
    persistViewport,
    scene,
    size.height,
    size.width,
    viewportStorageKey,
  ]);

  React.useEffect(() => {
    if (fitRequest === 0) return;
    initializedViewportKeyRef.current = viewportStorageKey;
    fitCanvas();
  }, [fitCanvas, fitRequest, viewportStorageKey]);

  React.useEffect(() => {
    if (!scene) return;
    if (!persistViewport) return;
    if (initializedViewportKeyRef.current !== viewportStorageKey) return;
    if (skipNextViewportSaveRef.current) {
      skipNextViewportSaveRef.current = false;
      return;
    }
    writeSavedViewport(viewportStorageKey, stageState);
  }, [persistViewport, scene, stageState, viewportStorageKey]);

  const getWorldPointer = React.useCallback(() => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    return projectViewportPointToWorld(pointer, stageState);
  }, [stageState]);

  const createTextAtPoint = React.useCallback(
    (point: { x: number; y: number }) => {
      void onCreateShape(createTextShapeDraft(point, textDraft));
      onToolChange("select");
    },
    [onCreateShape, onToolChange, textDraft]
  );

  const createTextAtViewportCenter = React.useCallback(() => {
    if (!size.width || !size.height) return;
    createTextAtPoint(
      projectViewportPointToWorld(
        { x: size.width / 2, y: size.height / 2 },
        stageState
      )
    );
  }, [createTextAtPoint, size.height, size.width, stageState]);

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const next = createZoomedTabletopViewport({
      viewport: stageState,
      pointer,
      deltaY: event.evt.deltaY,
    });
    setStageState(next);
    if (persistViewport) {
      writeSavedViewport(viewportStorageKey, next);
    }
    onScaleChange(next.scale);
  };

  const handleStageDragPosition = React.useCallback(
    (stage: Konva.Stage) => {
      const nextX = stage.x();
      const nextY = stage.y();
      let nextViewport: TabletopStageState | null = null;
      setStageState((previous) => {
        if (previous.x === nextX && previous.y === nextY) {
          return previous;
        }
        nextViewport = {
          ...previous,
          x: nextX,
          y: nextY,
        };
        return nextViewport;
      });
      if (nextViewport && persistViewport) {
        writeSavedViewport(viewportStorageKey, nextViewport);
      }
    },
    [persistViewport, viewportStorageKey]
  );

  const isShapeDraftTool = tool === "rect" || tool === "circle";
  const isFogDraftTool = tool === "reveal" || tool === "hide";
  const isMapEditTool = isKeeper && tool === "map";
  const isMapPanModifierActive = isMapEditTool && isCtrlPressed;

  const paintMapTileAtPointer = React.useCallback(() => {
    if (!scene || !isMapEditTool) return;
    const tile = getMapTileAtWorldPoint({
      point: getWorldPointer(),
      gridSize,
      mapWidth: scene.map.config.width,
      mapHeight: scene.map.config.height,
    });
    if (!tile) return;
    const key = `${tile.x}:${tile.y}:${mapBrush}`;
    if (lastPaintedTileRef.current === key) return;
    lastPaintedTileRef.current = key;
    void onUpdateMapTile({ x: tile.x, y: tile.y, kind: mapBrush });
  }, [getWorldPointer, gridSize, isMapEditTool, mapBrush, onUpdateMapTile, scene]);

  const draftShape = React.useMemo(() => {
    if (!drawStart || !drawEnd || (!isShapeDraftTool && !isFogDraftTool)) {
      return null;
    }
    return createTabletopDraftRect({ start: drawStart, end: drawEnd, tool });
  }, [drawEnd, drawStart, isFogDraftTool, isShapeDraftTool, tool]);

  const deleteSelectedToken = React.useCallback(() => {
    if (!isKeeper || !selectedTokenId) return;
    void onDeleteToken(selectedTokenId);
    onSelectedTokenChange(null);
  }, [isKeeper, onDeleteToken, onSelectedTokenChange, selectedTokenId]);

  React.useEffect(() => {
    if (!selectedShapeId && !selectedTokenId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isKeeper) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      if (selectedShapeId) {
        void onDeleteShape(selectedShapeId);
        setSelectedShapeId(null);
        return;
      }
      if (selectedTokenId) {
        deleteSelectedToken();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    deleteSelectedToken,
    isKeeper,
    onDeleteShape,
    selectedShapeId,
    selectedTokenId,
  ]);

  React.useEffect(() => {
    const syncCtrlState = (event: KeyboardEvent) => {
      setIsCtrlPressed(event.ctrlKey);
    };
    const resetCtrlState = () => setIsCtrlPressed(false);

    window.addEventListener("keydown", syncCtrlState);
    window.addEventListener("keyup", syncCtrlState);
    window.addEventListener("blur", resetCtrlState);
    return () => {
      window.removeEventListener("keydown", syncCtrlState);
      window.removeEventListener("keyup", syncCtrlState);
      window.removeEventListener("blur", resetCtrlState);
    };
  }, []);

  React.useEffect(() => {
    if (!isKeeper || tool !== "text") return;
    const frame = window.requestAnimationFrame(() => {
      textInputRef.current?.focus();
      textInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isKeeper, tool]);

  const finishDrawing = React.useCallback(() => {
    if (!drawStart) return;
    if (
      draftShape &&
      draftShape.width >= MIN_SHAPE_SIZE &&
      draftShape.height >= MIN_SHAPE_SIZE
    ) {
      if (draftShape.mode === "reveal") {
        void onRevealRect(draftShape);
      } else if (draftShape.mode === "hide") {
        void onHideRect(draftShape);
      } else {
        void onCreateShape(draftShape);
      }
    }
    setDrawStart(null);
    setDrawEnd(null);
    onToolChange("select");
  }, [draftShape, drawStart, onCreateShape, onHideRect, onRevealRect, onToolChange]);

  if (!scene) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#101827] text-center">
        <div className="max-w-sm px-6">
          <MousePointer2 size={42} className="mx-auto mb-3 text-dicecho-primary" />
          <p className="font-bold text-white">还没有可用场景</p>
          <p className="mt-2 text-sm leading-6 text-dicecho-muted">
            创建场景后，这里会显示一张可缩放、可平移、可放置角色点位的网格桌面。
          </p>
          {canCreateScene && onCreateScene && (
            <Button
              className="mx-auto mt-4"
              icon={Plus}
              onClick={() => void onCreateScene()}
            >
              创建新场景
            </Button>
          )}
        </div>
      </div>
    );
  }

  const isDrawingTool = isKeeper && (isShapeDraftTool || isFogDraftTool);
  const isTextTool = isKeeper && tool === "text";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full min-h-[360px] flex-1 overflow-hidden bg-[#101827]",
        (isDrawingTool || isTextTool || (isMapEditTool && !isMapPanModifierActive)) &&
          "cursor-crosshair",
        isMapPanModifierActive && "cursor-grab"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.16)_0,transparent_45%)]" />
      {isDrawingTool && (
        <div className="pointer-events-none absolute left-3 top-20 z-20 rounded-lg border border-dicecho-primary/35 bg-dicecho-panel/90 px-3 py-2 text-xs font-bold text-white shadow-lg">
          {tool === "reveal"
            ? "按住画布拖动，松开后揭示玩家可见范围"
            : tool === "hide"
              ? "按住画布拖动，松开后遮蔽玩家可见范围"
              : `按住画布拖动，松开创建${tool === "rect" ? "矩形" : "圆形"}`}
        </div>
      )}
      {isTextTool && (
        <div
          className="absolute left-3 top-20 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-dicecho-primary/35 bg-dicecho-panel/95 px-3 py-2 shadow-lg"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <input
            ref={textInputRef}
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createTextAtViewportCenter();
              }
              if (event.key === "Escape") {
                onToolChange("select");
              }
            }}
            placeholder="Text"
            className="h-8 w-44 rounded-md border border-dicecho-border/45 bg-[#101827] px-2 text-sm font-semibold text-white outline-none transition-colors placeholder:text-dicecho-muted focus:border-dicecho-primary/75"
          />
          <button
            type="button"
            onClick={createTextAtViewportCenter}
            className="h-8 rounded-md border border-dicecho-primary/40 bg-dicecho-primary/20 px-3 text-xs font-bold text-white transition-colors hover:bg-dicecho-primary/30"
          >
            Place
          </button>
        </div>
      )}
      {isKeeper && selectedShapeId && (
        <button
          type="button"
          className="absolute right-3 top-20 z-20 rounded-lg border border-red-400/35 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 shadow-lg transition-colors hover:bg-red-500/25"
          onClick={() => {
            void onDeleteShape(selectedShapeId);
            setSelectedShapeId(null);
          }}
        >
          删除选中形状
        </button>
      )}
      {isKeeper && selectedToken && (
        <div className="absolute right-3 top-20 z-20 flex items-center gap-2 rounded-lg border border-dicecho-border/45 bg-dicecho-panel/92 px-2 py-2 shadow-lg backdrop-blur">
          <button
            type="button"
            className="rounded-md border border-amber-300/35 bg-amber-400/12 px-3 py-2 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-400/22"
            onClick={() => void onToggleTokenHidden(selectedToken)}
          >
            {selectedToken.isHidden ? "设为可见" : "设为隐藏"}
          </button>
          <button
            type="button"
            className="rounded-md border border-red-400/35 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 transition-colors hover:bg-red-500/25"
            onClick={deleteSelectedToken}
          >
            移除点位
          </button>
        </div>
      )}
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={stageState.x}
          y={stageState.y}
          scaleX={stageState.scale}
          scaleY={stageState.scale}
          draggable={
            !isDrawingTool &&
            !isTextTool &&
            (!isMapEditTool || isMapPanModifierActive)
          }
          onWheel={handleWheel}
          onDragMove={(event) => {
            const stage = event.target.getStage();
            if (!stage || event.target !== stage) return;
            handleStageDragPosition(stage);
          }}
          onDragEnd={(event) => {
            const stage = event.target.getStage();
            if (!stage || event.target !== stage) return;
            handleStageDragPosition(stage);
          }}
          onMouseDown={(event) => {
            onSelectedTokenChange(null);
            if (isMapEditTool) {
              if (event.evt.ctrlKey || isCtrlPressed) {
                setIsPaintingMap(false);
                lastPaintedTileRef.current = null;
                return;
              }
              event.cancelBubble = true;
              lastPaintedTileRef.current = null;
              setIsPaintingMap(true);
              paintMapTileAtPointer();
              return;
            }
            if (event.target.hasName(SHAPE_NODE_NAME)) return;
            if (isTextTool) {
              const point = getWorldPointer();
              if (!point) return;
              createTextAtPoint(point);
              return;
            }
            setSelectedShapeId(null);
            if (!isDrawingTool) return;
            if (event.target.hasName(TOKEN_NODE_NAME)) return;
            const point = getWorldPointer();
            if (!point) return;
            event.cancelBubble = true;
            setDrawStart(point);
            setDrawEnd(point);
          }}
          onMouseMove={() => {
            if (isPaintingMap) {
              paintMapTileAtPointer();
              return;
            }
            if (!drawStart) return;
            const point = getWorldPointer();
            if (point) setDrawEnd(point);
          }}
          onMouseUp={() => {
            setIsPaintingMap(false);
            lastPaintedTileRef.current = null;
            finishDrawing();
          }}
          onMouseLeave={() => {
            setIsPaintingMap(false);
            lastPaintedTileRef.current = null;
            finishDrawing();
          }}
        >
          <Layer>
            <Rect
              x={(0 - stageState.x) / stageState.scale}
              y={(0 - stageState.y) / stageState.scale}
              width={size.width / stageState.scale}
              height={size.height / stageState.scale}
              fill="rgba(16,24,39,0.02)"
              listening={false}
            />
            <TabletopMapTiles scene={scene} isKeeper={isKeeper} />
            <InfiniteGrid
              viewport={size}
              stageState={stageState}
              gridSize={gridSize}
            />
            {shapes.map((shape) => (
              <ShapeNode
                key={shape.id}
                shape={shape}
                canEdit={isKeeper}
                selected={selectedShapeId === shape.id}
                onSelect={() => {
                  onSelectedTokenChange(null);
                  setSelectedShapeId(shape.id);
                }}
                onMoveEnd={(position) =>
                  onUpdateShape({
                    ...shape,
                    x: position.x,
                    y: position.y,
                  })
                }
              />
            ))}
            {draftShape && (
              <ShapeNode
                shape={{
                  id: "draft",
                  sceneId: scene.id,
                  kind: draftShape.kind,
                  x: draftShape.x,
                  y: draftShape.y,
                  width: draftShape.width,
                  height: draftShape.height,
                  fill:
                    draftShape.mode === "reveal"
                      ? "rgba(34,197,94,0.12)"
                      : draftShape.mode === "hide"
                        ? "rgba(245,158,11,0.16)"
                        : "rgba(250,204,21,0.12)",
                  stroke:
                    draftShape.mode === "reveal"
                      ? "#4ade80"
                      : draftShape.mode === "hide"
                        ? "#f59e0b"
                        : "#facc15",
                  strokeWidth: 2,
                  zIndex: 999,
                  createdAt: "",
                  updatedAt: "",
                }}
                dashed
              />
            )}
            {tokens.map((token) => (
              <TabletopTokenNode
                key={token.id}
                token={token}
                character={characters.get(token.characterId)}
                canMove={canMoveToken(token)}
                selected={selectedTokenId === token.id}
                onSelect={() => {
                  setSelectedShapeId(null);
                  onSelectedTokenChange(token.id);
                }}
                onMoveEnd={(position) => onTokenMove(token, position)}
              />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  );
};

const TabletopMapTiles: React.FC<{
  scene: TabletopScene;
  isKeeper: boolean;
}> = ({ scene, isKeeper }) => {
  const gridSize = scene.map.config.gridSize;

  return (
    <>
      {scene.map.tiles.map((tile) => (
        <Rect
          key={`${tile.x}:${tile.y}`}
          x={tile.x * gridSize}
          y={tile.y * gridSize}
          width={gridSize}
          height={gridSize}
          fill={getMapTileFill(tile.kind, tile.revealed, isKeeper)}
          stroke={tile.revealed ? "rgba(148,163,184,0.13)" : "rgba(15,23,42,0.32)"}
          strokeWidth={1}
          listening={false}
        />
      ))}
    </>
  );
};

function getMapTileFill(
  kind: TabletopScene["map"]["tiles"][number]["kind"],
  revealed: boolean,
  isKeeper: boolean
) {
  if (!revealed && !isKeeper) return "rgba(2,6,23,0.96)";

  const alpha = revealed ? 0.72 : 0.25;
  if (kind === "floor") return `rgba(51,65,85,${alpha})`;
  if (kind === "door") return `rgba(217,119,6,${revealed ? 0.68 : 0.24})`;
  if (kind === "void") return "rgba(2,6,23,0.98)";
  return `rgba(15,23,42,${revealed ? 0.88 : 0.42})`;
}

const InfiniteGrid: React.FC<{
  viewport: { width: number; height: number };
  stageState: { scale: number; x: number; y: number };
  gridSize: number;
}> = ({ viewport, stageState, gridSize }) => {
  const lines: React.ReactNode[] = [];
  const worldLeft = (0 - stageState.x) / stageState.scale;
  const worldTop = (0 - stageState.y) / stageState.scale;
  const worldRight = (viewport.width - stageState.x) / stageState.scale;
  const worldBottom = (viewport.height - stageState.y) / stageState.scale;
  const startX = Math.floor(worldLeft / gridSize) * gridSize;
  const endX = Math.ceil(worldRight / gridSize) * gridSize;
  const startY = Math.floor(worldTop / gridSize) * gridSize;
  const endY = Math.ceil(worldBottom / gridSize) * gridSize;

  for (let x = startX; x <= endX; x += gridSize) {
    const isMajor = Math.round(x / gridSize) % MAJOR_GRID_INTERVAL === 0;
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, worldTop, x, worldBottom]}
        stroke={
          x === 0
            ? "rgba(248,250,252,0.62)"
            : isMajor
              ? "rgba(125,211,252,0.34)"
              : "rgba(226,232,240,0.20)"
        }
        strokeWidth={isMajor ? 1.5 / stageState.scale : 1 / stageState.scale}
        listening={false}
      />
    );
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const isMajor = Math.round(y / gridSize) % MAJOR_GRID_INTERVAL === 0;
    lines.push(
      <Line
        key={`h-${y}`}
        points={[worldLeft, y, worldRight, y]}
        stroke={
          y === 0
            ? "rgba(248,250,252,0.62)"
            : isMajor
              ? "rgba(125,211,252,0.34)"
              : "rgba(226,232,240,0.20)"
        }
        strokeWidth={isMajor ? 1.5 / stageState.scale : 1 / stageState.scale}
        listening={false}
      />
    );
  }

  return <>{lines}</>;
};

const ShapeNode: React.FC<{
  shape: TabletopShape;
  dashed?: boolean;
  canEdit?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onMoveEnd?: (position: { x: number; y: number }) => Promise<void>;
}> = ({ shape, dashed, canEdit = false, selected = false, onSelect, onMoveEnd }) => {
  const handleSelect = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    event.cancelBubble = true;
    onSelect?.();
  };
  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    void onMoveEnd?.({
      x: clampTabletopCoordinate(event.target.x()),
      y: clampTabletopCoordinate(event.target.y()),
    });
  };

  if (shape.kind === "text") {
    return (
      <Group
        name={SHAPE_NODE_NAME}
        x={shape.x}
        y={shape.y}
        draggable={canEdit}
        onClick={handleSelect}
        onTap={handleSelect}
        onDragEnd={handleDragEnd}
      >
        {selected && (
          <Rect
            x={-6}
            y={-5}
            width={shape.width + 12}
            height={shape.height + 10}
            stroke="#facc15"
            strokeWidth={2}
            dash={[7, 5]}
            fill="rgba(250,204,21,0.08)"
          />
        )}
        <Text
          text={shape.text || "文本"}
          width={shape.width}
          height={shape.height}
          fontSize={22}
          fontStyle="bold"
          fill={shape.fill}
          shadowColor="#000000"
          shadowOpacity={0.45}
          shadowBlur={5}
        />
      </Group>
    );
  }

  if (shape.kind === "circle") {
    return (
      <Group
        name={SHAPE_NODE_NAME}
        x={shape.x}
        y={shape.y}
        draggable={canEdit}
        onClick={handleSelect}
        onTap={handleSelect}
        onDragEnd={handleDragEnd}
      >
        <Circle
          x={shape.width / 2}
          y={shape.height / 2}
          radius={Math.max(shape.width, shape.height) / 2}
          fill={shape.fill}
          stroke={selected ? "#facc15" : shape.stroke}
          strokeWidth={selected ? shape.strokeWidth + 1 : shape.strokeWidth}
          dash={dashed ? [8, 6] : undefined}
        />
      </Group>
    );
  }

  return (
    <Group
      name={SHAPE_NODE_NAME}
      x={shape.x}
      y={shape.y}
      draggable={canEdit}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={shape.width}
        height={shape.height}
        fill={shape.fill}
        stroke={selected ? "#facc15" : shape.stroke}
        strokeWidth={selected ? shape.strokeWidth + 1 : shape.strokeWidth}
        dash={dashed ? [8, 6] : undefined}
      />
    </Group>
  );
};

const TabletopTokenNode: React.FC<{
  token: TabletopToken;
  character?: Character;
  canMove: boolean;
  selected: boolean;
  onSelect: () => void;
  onMoveEnd: (position: { x: number; y: number }) => Promise<void>;
}> = ({
  token,
  character,
  canMove,
  selected,
  onSelect,
  onMoveEnd,
}) => {
  const label = token.label || character?.name || "Token";
  const avatarImage = useAvatarImage(character?.avatar_url || null);
  const hasAvatar = Boolean(avatarImage);
  const color =
    character?.theme_color ||
    (character?.type === "monster"
      ? "#dc2626"
      : character?.type === "npc"
        ? "#d97706"
        : "#4f46e5");

  return (
    <Group
      name={TOKEN_NODE_NAME}
      x={token.x}
      y={token.y}
      rotation={token.rotation}
      draggable={canMove}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        void onMoveEnd({
          x: clampTabletopCoordinate(event.target.x()),
          y: clampTabletopCoordinate(event.target.y()),
        });
      }}
      onMouseEnter={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = canMove ? "grab" : "default";
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    >
      {selected && (
        <Circle
          radius={token.size / 2 + 7}
          stroke="#e2e8f0"
          strokeWidth={2}
          dash={[7, 5]}
          fill="rgba(255,255,255,0.06)"
        />
      )}
      <Circle
        radius={token.size / 2}
        fill={token.isHidden ? HIDDEN_TOKEN_FILL : color}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={2}
        shadowColor="#000000"
        shadowOpacity={0.36}
        shadowBlur={10}
      />
      {avatarImage ? (
        <Group
          clipFunc={(context) => {
            context.arc(0, 0, token.size / 2 - 1, 0, Math.PI * 2, false);
          }}
          listening={false}
        >
          <Image
            image={avatarImage}
            x={-token.size / 2}
            y={-token.size / 2}
            width={token.size}
            height={token.size}
            listening={false}
          />
        </Group>
      ) : (
        <Text
          text={label.slice(0, 1).toUpperCase()}
          x={-token.size / 2}
          y={-token.size / 2 + 6}
          width={token.size}
          height={token.size}
          align="center"
          fontSize={20}
          fontStyle="bold"
          fill="#ffffff"
        />
      )}
      {hasAvatar && token.isHidden && (
        <Circle
          radius={token.size / 2}
          fill={HIDDEN_TOKEN_AVATAR_OVERLAY}
          listening={false}
        />
      )}
      <Text
        text={label}
        x={-52}
        y={token.size / 2 + 7}
        width={104}
        align="center"
        fontSize={11}
        fontStyle="bold"
        fill="rgba(226,232,240,0.94)"
        ellipsis
      />
    </Group>
  );
};

function useAvatarImage(url: string | null) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => {
      if (!cancelled) setImage(nextImage);
    };
    nextImage.onerror = () => {
      if (!cancelled) setImage(null);
    };
    nextImage.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}
