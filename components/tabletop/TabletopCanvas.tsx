import React from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { Plus } from "lucide-react";
import type {
  Character,
  FogRegion,
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
  getArrowHeadPoints,
  getCurvatureFromCurveMidpoint,
  getLineCurveControlPoint,
  getMapTileAtWorldPoint,
  getTabletopViewportStorageKey,
  parseSavedTabletopViewport,
  projectViewportPointToWorld,
  sampleEllipsePoints,
  sampleQuadraticCurvePoints,
  type TabletopStageState,
} from "./tabletopCanvasModel";
import { extractBlueprintContours } from "./blueprintContourModel";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const MIN_SHAPE_SIZE = 16;
const TOKEN_NODE_NAME = "tabletop-token";
const SHAPE_NODE_NAME = "tabletop-shape";
const FOG_NODE_NAME = "tabletop-fog";
const HANDLE_NODE_NAME = "tabletop-resize-handle";
const HIDDEN_TOKEN_ACCENT = "#94a3b8";

function hasAncestorName(
  node: Konva.Node | null | undefined,
  name: string
): boolean {
  let current: Konva.Node | null | undefined = node;
  while (current) {
    if (typeof current.hasName === "function" && current.hasName(name)) {
      return true;
    }
    current =
      typeof current.getParent === "function" ? current.getParent() : null;
  }
  return false;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  return `rgba(147,150,247,${alpha})`;
}

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
    cornerRadius?: number;
    points?: number[];
    curvature?: number;
    dashed?: boolean;
    arrowEnd?: boolean;
  }) => Promise<void>;
  onUpdateShape: (shape: TabletopShape) => Promise<void>;
  onDeleteShape: (shapeId: string) => Promise<void>;
  onUpdateMapTile: (tile: {
    x: number;
    y: number;
    kind: TabletopMapBrush;
  }) => Promise<void>;
  onDeleteToken: (tokenId: string) => Promise<void>;
  onToggleTokenHidden: (token: TabletopToken) => Promise<void>;
  onRevealRect: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<void>;
  onHideRect: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<void>;
  onUpdateFogRegion?: (region: FogRegion) => Promise<void>;
  onDeleteFogRegion?: (regionId: string) => Promise<void>;
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
  onUpdateFogRegion,
  onDeleteFogRegion,
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
  const [drawStart, setDrawStart] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [drawEnd, setDrawEnd] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedShapeId, setSelectedShapeId] = React.useState<string | null>(
    null
  );
  const [selectedFogId, setSelectedFogId] = React.useState<string | null>(null);
  const [textDraft, setTextDraft] = React.useState("区域标注");
  const [isPaintingMap, setIsPaintingMap] = React.useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [isShiftPressed, setIsShiftPressed] = React.useState(false);
  const lastPaintedTileRef = React.useRef<string | null>(null);

  const gridSize = scene?.map.config.gridSize || 48;
  const blueprintGridSpacing = Math.max(72, gridSize * 2);

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
  const hiddenFogRegions = React.useMemo(
    () =>
      (state.fogRegions || []).filter(
        (region) =>
          region.sceneId === scene?.id &&
          region.mode === "hidden" &&
          region.shape === "rect" &&
          region.points.length >= 4
      ),
    [scene?.id, state.fogRegions]
  );
  const selectedToken = React.useMemo(
    () => tokens.find((token) => token.id === selectedTokenId) || null,
    [selectedTokenId, tokens]
  );
  const selectedShape = React.useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) || null,
    [selectedShapeId, shapes]
  );
  const selectedFog = React.useMemo(
    () => hiddenFogRegions.find((region) => region.id === selectedFogId) || null,
    [hiddenFogRegions, selectedFogId]
  );
  const viewportStorageKey = React.useMemo(
    () => getTabletopViewportStorageKey(state.roomId, scene?.id),
    [scene?.id, state.roomId]
  );

  const fitCanvas = React.useCallback(() => {
    const width = containerRef.current?.clientWidth || size.width;
    const height = containerRef.current?.clientHeight || size.height;
    if (!width || !height) return;

    const xs: number[] = [];
    const ys: number[] = [];

    if (scene) {
      for (const tile of scene.map.tiles) {
        if (tile.kind !== "floor" && tile.kind !== "door") continue;
        if (!isKeeper && !tile.revealed) continue;
        xs.push(tile.x * gridSize, (tile.x + 1) * gridSize);
        ys.push(tile.y * gridSize, (tile.y + 1) * gridSize);
      }
    }
    for (const shape of shapes) {
      if (shape.kind === "line" && shape.points && shape.points.length >= 4) {
        xs.push(shape.x + shape.points[0], shape.x + shape.points[2]);
        ys.push(shape.y + shape.points[1], shape.y + shape.points[3]);
      } else {
        xs.push(shape.x, shape.x + shape.width);
        ys.push(shape.y, shape.y + shape.height);
      }
    }
    for (const token of tokens) {
      xs.push(token.x - 36, token.x + 36);
      ys.push(token.y - 36, token.y + 48);
    }

    let next: TabletopStageState | null = null;
    if (xs.length > 0 && ys.length > 0) {
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const contentW = Math.max(180, maxX - minX);
      const contentH = Math.max(140, maxY - minY);
      const padding = 72;
      const rawScale = Math.min(
        (width - padding * 2) / contentW,
        (height - padding * 2) / contentH,
        1.15
      );
      const fittedScale = Math.max(0.45, Math.min(1.2, rawScale));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      next = {
        scale: Number(fittedScale.toFixed(3)),
        x: Math.round(width / 2 - centerX * fittedScale),
        y: Math.round(height / 2 - centerY * fittedScale),
      };
    } else if (fitToSceneBounds && scene) {
      next = createMapBoundsFittedTabletopViewport({
        viewport: { width, height },
        map: getMapPixelSize(scene),
      });
    } else {
      next = createFittedTabletopViewport({ width, height });
    }

    if (!next) return;
    setStageState(next);
    if (persistViewport) {
      writeSavedViewport(viewportStorageKey, next);
    }
    onScaleChange(next.scale);
  }, [
    fitToSceneBounds,
    gridSize,
    isKeeper,
    onScaleChange,
    persistViewport,
    scene,
    shapes,
    size.height,
    size.width,
    tokens,
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

  useIsomorphicLayoutEffect(() => {
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

  const isShapeDraftTool =
    tool === "rect" || tool === "circle" || tool === "line";
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
  }, [
    getWorldPointer,
    gridSize,
    isMapEditTool,
    mapBrush,
    onUpdateMapTile,
    scene,
  ]);

  const constrainedDrawEnd = React.useMemo(() => {
    if (!drawStart || !drawEnd || !isShiftPressed) return drawEnd;
    const dx = drawEnd.x - drawStart.x;
    const dy = drawEnd.y - drawStart.y;
    if (tool === "line") {
      // Snap line to 45-degree increments when Shift is held
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(dx, dy);
      return {
        x: drawStart.x + Math.cos(snapped) * dist,
        y: drawStart.y + Math.sin(snapped) * dist,
      };
    }
    if (tool === "rect" || tool === "circle") {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        x: drawStart.x + (dx >= 0 ? side : -side),
        y: drawStart.y + (dy >= 0 ? side : -side),
      };
    }
    return drawEnd;
  }, [drawEnd, drawStart, isShiftPressed, tool]);

  const draftShape = React.useMemo(() => {
    if (
      !drawStart ||
      !constrainedDrawEnd ||
      (!isShapeDraftTool && !isFogDraftTool)
    ) {
      return null;
    }
    return createTabletopDraftRect({
      start: drawStart,
      end: constrainedDrawEnd,
      tool,
    });
  }, [constrainedDrawEnd, drawStart, isFogDraftTool, isShapeDraftTool, tool]);

  const deleteSelectedToken = React.useCallback(() => {
    if (!isKeeper || !selectedTokenId) return;
    void onDeleteToken(selectedTokenId);
    onSelectedTokenChange(null);
  }, [isKeeper, onDeleteToken, onSelectedTokenChange, selectedTokenId]);

  const handleDeleteFogById = React.useCallback(
    async (region: FogRegion) => {
      if (onDeleteFogRegion) {
        await onDeleteFogRegion(region.id);
      } else if (region.shape === "rect" && region.points.length >= 4) {
        const [x, y, width, height] = region.points;
        await onRevealRect({ x, y, width, height });
      }
      setSelectedFogId((prev) => (prev === region.id ? null : prev));
    },
    [onDeleteFogRegion, onRevealRect]
  );

  React.useEffect(() => {
    if (!selectedShapeId && !selectedTokenId && !selectedFogId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isKeeper) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      if (selectedShapeId) {
        void onDeleteShape(selectedShapeId);
        setSelectedShapeId(null);
        return;
      }
      if (selectedFog) {
        void handleDeleteFogById(selectedFog);
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
    handleDeleteFogById,
    isKeeper,
    onDeleteShape,
    selectedFog,
    selectedFogId,
    selectedShapeId,
    selectedTokenId,
  ]);

  React.useEffect(() => {
    const syncModifiers = (event: KeyboardEvent) => {
      setIsCtrlPressed(event.ctrlKey);
      setIsShiftPressed(event.shiftKey);
    };
    const resetModifiers = () => {
      setIsCtrlPressed(false);
      setIsShiftPressed(false);
    };

    window.addEventListener("keydown", syncModifiers);
    window.addEventListener("keyup", syncModifiers);
    window.addEventListener("blur", resetModifiers);
    return () => {
      window.removeEventListener("keydown", syncModifiers);
      window.removeEventListener("keyup", syncModifiers);
      window.removeEventListener("blur", resetModifiers);
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
    if (draftShape) {
      const isLineValid =
        draftShape.kind === "line" &&
        draftShape.points &&
        Math.hypot(draftShape.points[2], draftShape.points[3]) >=
          MIN_SHAPE_SIZE;
      const isBoxValid =
        draftShape.kind !== "line" &&
        draftShape.width >= MIN_SHAPE_SIZE &&
        draftShape.height >= MIN_SHAPE_SIZE;

      if (isLineValid || isBoxValid) {
        if (draftShape.mode === "reveal") {
          void onRevealRect(draftShape);
        } else if (draftShape.mode === "hide") {
          void onHideRect(draftShape);
        } else {
          void onCreateShape(draftShape);
        }
      }
    }
    setDrawStart(null);
    setDrawEnd(null);
  }, [draftShape, drawStart, onCreateShape, onHideRect, onRevealRect]);

  if (!scene) {
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#242a38] text-center">
        <div className="relative max-w-sm px-6">
          <svg
            viewBox="0 0 360 220"
            className="mx-auto mb-4 w-full max-w-[300px]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 44H360M0 88H360M0 132H360M0 176H360M72 0V220M144 0V220M216 0V220M288 0V220"
              stroke="rgba(176,188,204,0.07)"
              strokeWidth="1"
            />
            <rect
              x="48"
              y="26"
              width="80"
              height="112"
              rx="40"
              stroke="rgba(147,150,247,0.32)"
              strokeWidth="1.2"
            />
            <rect
              x="140"
              y="26"
              width="80"
              height="112"
              rx="40"
              stroke="rgba(147,150,247,0.58)"
              strokeWidth="1.4"
            />
            <rect
              x="232"
              y="26"
              width="80"
              height="112"
              rx="40"
              stroke="rgba(147,150,247,0.26)"
              strokeWidth="1.2"
            />
            <circle cx="180" cy="92" r="30" fill="rgba(147,150,247,0.16)" />
            <circle cx="180" cy="92" r="12" fill="rgba(147,150,247,0.34)" />
            <circle cx="180" cy="92" r="3.5" fill="#ffffff" />
            <line
              x1="24"
              y1="162"
              x2="336"
              y2="162"
              stroke="rgba(176,188,204,0.2)"
              strokeWidth="1"
            />
            <rect
              x="48"
              y="174"
              width="144"
              height="26"
              rx="6"
              fill="rgba(79,82,101,0.45)"
              stroke="rgba(147,150,247,0.35)"
            />
            <text
              x="62"
              y="191"
              fill="#e4e5eb"
              fontSize="10"
              fontFamily="monospace"
            >
              RUNTABLE PRO READY
            </text>
          </svg>
          <p className="font-bold text-white">还没有可用场景</p>
          <p className="mt-2 text-sm leading-6 text-dicecho-muted">
            创建场景后，用简洁的几何空间、连线曲线与发光角色点位构建你的蓝图桌布。
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

  const maxRectRadius =
    selectedShape?.kind === "rect"
      ? Math.max(
          0,
          Math.floor(Math.min(selectedShape.width, selectedShape.height) / 2)
        )
      : 60;
  const currentRectRadius =
    selectedShape?.kind === "rect"
      ? selectedShape.cornerRadius ??
        Math.min(
          28,
          Math.round(Math.min(selectedShape.width, selectedShape.height) * 0.22)
        )
      : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full min-h-[360px] flex-1 overflow-hidden bg-[#242a38]",
        (isDrawingTool ||
          isTextTool ||
          (isMapEditTool && !isMapPanModifierActive)) &&
          "cursor-crosshair",
        isMapPanModifierActive && "cursor-grab"
      )}
    >
      {/* Signature minimalist blueprint footer badge */}
      <div className="pointer-events-none absolute inset-x-6 bottom-4 z-10 hidden sm:block">
        <div className="mb-2.5 h-px w-full bg-[#b0bccc]/15" />
        <div className="inline-flex items-center gap-2 rounded-md border border-[#9396f7]/35 bg-[#4f5265]/40 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-[#e4e5eb]/90 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_#9396f7]" />
          <span className="max-w-[200px] truncate uppercase">
            RUNTABLE PRO · {scene.title || "BLUEPRINT"}
          </span>
        </div>
      </div>

      {/* Drawing Hint Banner */}
      {isDrawingTool && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border border-[#9396f7]/35 bg-[#2a3142]/90 px-3 py-1.5 text-xs font-medium text-[#e4e5eb] shadow-lg backdrop-blur-md">
          {tool === "reveal"
            ? "拖拽框选区域，清除该范围内的迷雾遮蔽"
            : tool === "hide"
              ? "拖出迷雾遮蔽区；切回「拖动 / 选择」后点击遮蔽区删除即可对角色可见"
              : tool === "line"
                ? "按住拖出直线/连线（按住 Shift 锁定 45°；选中后拖动中点可自由调曲率）"
                : tool === "circle"
                  ? "按住自由拖出椭圆（按住 Shift 锁定正圆，可连续绘制）"
                  : "按住拖出矩形空间（按住 Shift 锁定正方形，选中后可调圆角曲率）"}
        </div>
      )}

      {/* Text Creation Bar */}
      {isTextTool && (
        <div
          className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-lg border border-[#9396f7]/40 bg-[#2a3142]/95 px-3 py-2 shadow-lg backdrop-blur-md"
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
            placeholder="输入标注文字..."
            className="h-8 w-44 rounded-md border border-[#9396f7]/30 bg-[#1e2432] px-2.5 text-xs font-medium text-white outline-none transition-colors placeholder:text-dicecho-muted focus:border-[#9396f7]/75"
          />
          <button
            type="button"
            onClick={createTextAtViewportCenter}
            className="h-8 rounded-md border border-[#9396f7]/45 bg-[#9396f7]/20 px-3 text-xs font-semibold text-white transition-colors hover:bg-[#9396f7]/30"
          >
            放置文字
          </button>
        </div>
      )}

      {/* Floating Property Inspector for Selected Shape */}
      {isKeeper && selectedShape && (
        <div
          className="absolute right-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-[#9396f7]/40 bg-[#242b3b]/95 px-3 py-2 shadow-xl backdrop-blur-md"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {selectedShape.kind === "rect" && (
            <>
              <label className="flex items-center gap-2 text-[11px] text-[#c7d2fe]">
                <span>圆角曲率</span>
                <input
                  type="range"
                  min={0}
                  max={maxRectRadius}
                  value={Math.min(maxRectRadius, currentRectRadius)}
                  onChange={(event) =>
                    void onUpdateShape({
                      ...selectedShape,
                      cornerRadius: Number(event.target.value),
                    })
                  }
                  className="h-1.5 w-20 accent-[#9396f7]"
                />
                <span className="w-7 text-right font-mono text-[10px] text-[#e4e5eb]">
                  {Math.min(maxRectRadius, currentRectRadius)}
                </span>
              </label>
              <div className="flex items-center gap-1">
                {[
                  { label: "直角", val: 0 },
                  { label: "柔和", val: Math.min(20, maxRectRadius) },
                  { label: "胶囊", val: maxRectRadius },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      void onUpdateShape({
                        ...selectedShape,
                        cornerRadius: preset.val,
                      })
                    }
                    className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[#e4e5eb] hover:border-[#9396f7]/50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  void onUpdateShape({
                    ...selectedShape,
                    dashed: !selectedShape.dashed,
                  })
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  selectedShape.dashed
                    ? "border-[#9396f7]/60 bg-[#9396f7]/20 text-white"
                    : "border-white/10 bg-white/5 text-[#b0bccc] hover:text-white"
                )}
              >
                {selectedShape.dashed ? "虚线框" : "实线框"}
              </button>
            </>
          )}

          {selectedShape.kind === "circle" && (
            <>
              <span className="text-[11px] text-[#b0bccc]">
                拖动四角可自由拉成椭圆 / 正圆
              </span>
              <button
                type="button"
                onClick={() =>
                  void onUpdateShape({
                    ...selectedShape,
                    dashed: !selectedShape.dashed,
                  })
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  selectedShape.dashed
                    ? "border-[#9396f7]/60 bg-[#9396f7]/20 text-white"
                    : "border-white/10 bg-white/5 text-[#b0bccc] hover:text-white"
                )}
              >
                {selectedShape.dashed ? "虚线" : "实线"}
              </button>
            </>
          )}

          {selectedShape.kind === "line" && (
            <>
              <label className="flex items-center gap-2 text-[11px] text-[#c7d2fe]">
                <span>弯曲曲率</span>
                <input
                  type="range"
                  min={-240}
                  max={240}
                  value={selectedShape.curvature ?? 0}
                  onChange={(event) =>
                    void onUpdateShape({
                      ...selectedShape,
                      curvature: Number(event.target.value),
                    })
                  }
                  className="h-1.5 w-24 accent-[#9396f7]"
                />
                <span className="w-8 text-right font-mono text-[10px] text-[#e4e5eb]">
                  {selectedShape.curvature ?? 0}
                </span>
              </label>
              <button
                type="button"
                onClick={() =>
                  void onUpdateShape({
                    ...selectedShape,
                    curvature: 0,
                  })
                }
                className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[#e4e5eb] hover:border-[#9396f7]/50"
              >
                拉直
              </button>
              <button
                type="button"
                onClick={() =>
                  void onUpdateShape({
                    ...selectedShape,
                    dashed: !selectedShape.dashed,
                  })
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  selectedShape.dashed
                    ? "border-[#9396f7]/60 bg-[#9396f7]/20 text-white"
                    : "border-white/10 bg-white/5 text-[#b0bccc] hover:text-white"
                )}
              >
                {selectedShape.dashed ? "虚线" : "实线"}
              </button>
              <button
                type="button"
                onClick={() =>
                  void onUpdateShape({
                    ...selectedShape,
                    arrowEnd: !selectedShape.arrowEnd,
                  })
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  selectedShape.arrowEnd
                    ? "border-[#9396f7]/60 bg-[#9396f7]/20 text-white"
                    : "border-white/10 bg-white/5 text-[#b0bccc] hover:text-white"
                )}
              >
                {selectedShape.arrowEnd ? "有箭头" : "无箭头"}
              </button>
            </>
          )}

          {selectedShape.kind === "text" && (
            <input
              value={selectedShape.text || ""}
              onChange={(event) => {
                const nextText = event.target.value;
                const len = Math.max(4, Array.from(nextText).length);
                void onUpdateShape({
                  ...selectedShape,
                  text: nextText,
                  width: Math.min(520, Math.max(96, len * 18)),
                });
              }}
              className="h-7 w-44 rounded-md border border-[#9396f7]/35 bg-[#1b2130] px-2 text-xs text-white outline-none focus:border-[#9396f7]"
              placeholder="编辑标注文本..."
            />
          )}

          <button
            type="button"
            className="rounded-md border border-red-400/35 bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/25"
            onClick={() => {
              void onDeleteShape(selectedShape.id);
              setSelectedShapeId(null);
            }}
          >
            删除
          </button>
        </div>
      )}

      {/* Floating Inspector for Selected Fog Region */}
      {isKeeper && selectedFog && (
        <div
          className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[#9396f7]/40 bg-[#242b3b]/95 px-3 py-2 shadow-xl backdrop-blur-md"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="text-xs font-medium text-[#c7d2fe]">
            已选中迷雾遮蔽区（删除后角色即可看到）
          </span>
          <button
            type="button"
            className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25"
            onClick={() => void handleDeleteFogById(selectedFog)}
          >
            删除遮蔽（揭示）
          </button>
        </div>
      )}

      {/* Floating Inspector for Selected Token */}
      {isKeeper && selectedToken && (
        <div
          className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-[#9396f7]/40 bg-[#242b3b]/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="rounded-md border border-amber-300/35 bg-amber-400/12 px-2.5 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/22"
            onClick={() => void onToggleTokenHidden(selectedToken)}
          >
            {selectedToken.isHidden ? "设为可见" : "设为隐藏"}
          </button>
          <button
            type="button"
            className="rounded-md border border-red-400/35 bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/25"
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
            if (hasAncestorName(event.target, HANDLE_NODE_NAME)) return;
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

            // Clicking an interactive object in select mode should NOT clear its selection
            if (!isDrawingTool && !isTextTool) {
              if (
                hasAncestorName(event.target, SHAPE_NODE_NAME) ||
                hasAncestorName(event.target, FOG_NODE_NAME) ||
                hasAncestorName(event.target, TOKEN_NODE_NAME)
              ) {
                return;
              }
              onSelectedTokenChange(null);
              setSelectedShapeId(null);
              setSelectedFogId(null);
              return;
            }

            if (isTextTool) {
              const point = getWorldPointer();
              if (!point) return;
              createTextAtPoint(point);
              return;
            }

            // Start drawing shape or fog
            if (hasAncestorName(event.target, TOKEN_NODE_NAME)) return;
            onSelectedTokenChange(null);
            setSelectedShapeId(null);
            setSelectedFogId(null);
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
              fill="rgba(36,42,56,0.01)"
              listening={false}
            />

            {/* Calm wide architectural blueprint grid */}
            <InfiniteGrid
              viewport={size}
              stageState={stageState}
              gridSize={blueprintGridSpacing}
            />

            {/* Legacy tile maps auto-rendered cleanly when not yet upgraded to vector shapes */}
            <BlueprintLegacyRooms scene={scene} isKeeper={isKeeper} />

            {/* Editable vector blueprint shapes (rectangles, ellipses, curved lines, text) */}
            {shapes.map((shape) => (
              <ShapeNode
                key={shape.id}
                shape={shape}
                scale={stageState.scale}
                canEdit={isKeeper && tool === "select"}
                selected={selectedShapeId === shape.id}
                onSelect={() => {
                  onSelectedTokenChange(null);
                  setSelectedFogId(null);
                  setSelectedShapeId(shape.id);
                }}
                onUpdateShape={onUpdateShape}
              />
            ))}

            {/* Selectable, movable, resizable, deletable Fog shrouds */}
            <BlueprintFogLayer
              regions={hiddenFogRegions}
              isKeeper={isKeeper}
              canEdit={isKeeper && tool === "select"}
              selectedFogId={selectedFogId}
              scale={stageState.scale}
              onSelectFog={(fogId) => {
                onSelectedTokenChange(null);
                setSelectedShapeId(null);
                setSelectedFogId(fogId);
              }}
              onUpdateFogRegion={onUpdateFogRegion}
            />

            {/* Live Drag Preview */}
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
                  points: draftShape.points,
                  curvature: 0,
                  fill:
                    draftShape.mode === "reveal"
                      ? "rgba(102,177,133,0.12)"
                      : draftShape.mode === "hide"
                        ? "rgba(18,22,34,0.48)"
                        : "rgba(147,150,247,0.10)",
                  stroke:
                    draftShape.mode === "reveal"
                      ? "#66b185"
                      : draftShape.mode === "hide"
                        ? "rgba(147,150,247,0.65)"
                        : "rgba(147,150,247,0.9)",
                  strokeWidth: 1.6,
                  zIndex: 999,
                  createdAt: "",
                  updatedAt: "",
                }}
                scale={stageState.scale}
                dashed
              />
            )}

            {/* Minimalist glowing concentric beacon dots for characters */}
            {tokens.map((token) => (
              <TabletopTokenNode
                key={token.id}
                token={token}
                character={characters.get(token.characterId)}
                canMove={canMoveToken(token)}
                selected={selectedTokenId === token.id}
                onSelect={() => {
                  setSelectedShapeId(null);
                  setSelectedFogId(null);
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

const BlueprintLegacyRooms: React.FC<{
  scene: TabletopScene;
  isKeeper: boolean;
}> = ({ scene, isKeeper }) => {
  const gridSize = scene.map.config.gridSize;
  const contours = React.useMemo(
    () => extractBlueprintContours(scene.map.tiles, gridSize, isKeeper),
    [gridSize, isKeeper, scene.map.tiles]
  );

  if (
    contours.rooms.length === 0 &&
    contours.irregularTiles.length === 0 &&
    contours.doors.length === 0
  ) {
    return null;
  }

  return (
    <Group listening={false}>
      {contours.rooms.map((room) => (
        <Rect
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          cornerRadius={room.cornerRadius}
          fill={
            room.revealed ? "rgba(147,150,247,0.035)" : "rgba(147,150,247,0.015)"
          }
          stroke={
            room.revealed ? "rgba(147,150,247,0.52)" : "rgba(147,150,247,0.24)"
          }
          strokeWidth={1.5}
          dash={room.revealed ? undefined : [6, 5]}
        />
      ))}
      {contours.irregularTiles.map((tile) => (
        <Rect
          key={tile.id}
          x={tile.x}
          y={tile.y}
          width={tile.size}
          height={tile.size}
          fill={
            tile.revealed ? "rgba(147,150,247,0.035)" : "rgba(147,150,247,0.015)"
          }
        />
      ))}
      {contours.irregularEdges.map((edge) => (
        <Line
          key={edge.id}
          points={edge.points}
          stroke={
            edge.revealed ? "rgba(147,150,247,0.50)" : "rgba(147,150,247,0.22)"
          }
          strokeWidth={1.5}
          lineCap="round"
        />
      ))}
      {contours.doors.map((door) => {
        const cx = door.x + door.width / 2;
        const cy = door.y + door.height / 2;
        const half = door.width * 0.28;
        const points =
          door.orientation === "horizontal"
            ? [cx - half, cy, cx + half, cy]
            : [cx, cy - half, cx, cy + half];
        return (
          <Line
            key={door.id}
            points={points}
            stroke={
              door.revealed
                ? "rgba(147,150,247,0.45)"
                : "rgba(147,150,247,0.20)"
            }
            strokeWidth={2}
            lineCap="round"
          />
        );
      })}
    </Group>
  );
};

const BlueprintFogLayer: React.FC<{
  regions: FogRegion[];
  isKeeper: boolean;
  canEdit: boolean;
  selectedFogId: string | null;
  scale: number;
  onSelectFog: (fogId: string) => void;
  onUpdateFogRegion?: (region: FogRegion) => Promise<void>;
}> = ({
  regions,
  isKeeper,
  canEdit,
  selectedFogId,
  scale,
  onSelectFog,
  onUpdateFogRegion,
}) => {
  if (regions.length === 0) return null;

  return (
    <>
      {regions.map((region) => (
        <FogRegionNode
          key={region.id}
          region={region}
          isKeeper={isKeeper}
          canEdit={canEdit}
          selected={selectedFogId === region.id}
          scale={scale}
          onSelect={() => onSelectFog(region.id)}
          onUpdate={onUpdateFogRegion}
        />
      ))}
    </>
  );
};

const FogRegionNode: React.FC<{
  region: FogRegion;
  isKeeper: boolean;
  canEdit: boolean;
  selected: boolean;
  scale: number;
  onSelect: () => void;
  onUpdate?: (region: FogRegion) => Promise<void>;
}> = ({ region, isKeeper, canEdit, selected, scale, onSelect, onUpdate }) => {
  const [x0, y0, w0, h0] = region.points;
  const [liveBox, setLiveBox] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    setLiveBox(null);
  }, [h0, region.id, w0, x0, y0]);

  const x = liveBox?.x ?? x0;
  const y = liveBox?.y ?? y0;
  const width = liveBox?.width ?? w0;
  const height = liveBox?.height ?? h0;
  const strokeWidth = (selected ? 1.8 : 1.2) / Math.max(scale, 0.35);
  const handleRadius = 6 / Math.max(scale, 0.45);

  return (
    <Group
      name={FOG_NODE_NAME}
      x={x}
      y={y}
      draggable={canEdit && Boolean(onUpdate)}
      listening={isKeeper}
      onMouseDown={(event) => {
        if (!canEdit) return;
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        if (!canEdit) return;
        event.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={(event) => {
        if (hasAncestorName(event.target, HANDLE_NODE_NAME)) return;
        event.cancelBubble = true;
        void onUpdate?.({
          ...region,
          points: [
            clampTabletopCoordinate(event.target.x()),
            clampTabletopCoordinate(event.target.y()),
            width,
            height,
          ],
        });
      }}
    >
      <Rect
        width={width}
        height={height}
        cornerRadius={14}
        fill={
          isKeeper
            ? selected
              ? "rgba(20,24,35,0.68)"
              : "rgba(20,24,35,0.56)"
            : "rgba(30,35,48,0.98)"
        }
        stroke={
          isKeeper
            ? selected
              ? "rgba(199,210,254,0.92)"
              : "rgba(147,150,247,0.36)"
            : "rgba(36,42,56,0.95)"
        }
        strokeWidth={strokeWidth}
        dash={isKeeper ? [6, 5] : undefined}
      />
      {isKeeper && width >= 64 && height >= 30 && (
        <Text
          text={selected ? "已选中迷雾 · Delete 删除" : "迷雾遮蔽"}
          x={12}
          y={10}
          fontSize={11}
          fill={selected ? "#c7d2fe" : "rgba(176,188,204,0.68)"}
          listening={false}
        />
      )}
      {canEdit && selected && onUpdate && (
        <Circle
          name={HANDLE_NODE_NAME}
          x={width}
          y={height}
          radius={handleRadius}
          fill="#ffffff"
          stroke="#9396f7"
          strokeWidth={2 / Math.max(scale, 0.45)}
          draggable
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onDragMove={(event) => {
            event.cancelBubble = true;
            setLiveBox({
              x,
              y,
              width: Math.max(MIN_SHAPE_SIZE, Math.round(event.target.x())),
              height: Math.max(MIN_SHAPE_SIZE, Math.round(event.target.y())),
            });
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            const nextW = Math.max(
              MIN_SHAPE_SIZE,
              Math.round(event.target.x())
            );
            const nextH = Math.max(
              MIN_SHAPE_SIZE,
              Math.round(event.target.y())
            );
            setLiveBox(null);
            void onUpdate({
              ...region,
              points: [x, y, nextW, nextH],
            });
          }}
        />
      )}
    </Group>
  );
};

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
  const lineWidth = 1 / Math.max(stageState.scale, 0.35);

  for (let x = startX; x <= endX; x += gridSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, worldTop, x, worldBottom]}
        stroke="rgba(176,188,204,0.065)"
        strokeWidth={lineWidth}
        listening={false}
      />
    );
  }

  for (let y = startY; y <= endY; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[worldLeft, y, worldRight, y]}
        stroke="rgba(176,188,204,0.065)"
        strokeWidth={lineWidth}
        listening={false}
      />
    );
  }

  return <>{lines}</>;
};

const ShapeNode: React.FC<{
  shape: TabletopShape;
  scale: number;
  dashed?: boolean;
  canEdit?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onUpdateShape?: (shape: TabletopShape) => Promise<void>;
}> = ({
  shape,
  scale,
  dashed,
  canEdit = false,
  selected = false,
  onSelect,
  onUpdateShape,
}) => {
  const [liveBox, setLiveBox] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const liveBoxRef = React.useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeAnchorRef = React.useRef<{
    fixedX: number;
    fixedY: number;
  } | null>(null);
  const [liveLine, setLiveLine] = React.useState<{
    points: [number, number, number, number];
    curvature: number;
  } | null>(null);

  React.useEffect(() => {
    liveBoxRef.current = null;
    setLiveBox(null);
    setLiveLine(null);
  }, [
    shape.curvature,
    shape.height,
    shape.id,
    shape.points,
    shape.width,
    shape.x,
    shape.y,
  ]);

  const x = liveBox?.x ?? shape.x;
  const y = liveBox?.y ?? shape.y;
  const width = liveBox?.width ?? shape.width;
  const height = liveBox?.height ?? shape.height;

  const isDashedStroke = Boolean(dashed || shape.dashed);
  const strokeColor = dashed
    ? shape.stroke
    : selected
      ? "rgba(199,210,254,0.96)"
      : "rgba(147,150,247,0.55)";
  const fillColor = dashed
    ? shape.fill
    : selected
      ? "rgba(147,150,247,0.09)"
      : "rgba(147,150,247,0.035)";
  const strokeWidth = selected ? 1.8 : 1.5;
  const handleRadius = 5.5 / Math.max(scale, 0.45);
  const handleStroke = 1.8 / Math.max(scale, 0.45);

  const handleSelectDown = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (dashed || !canEdit) return;
    event.cancelBubble = true;
    onSelect?.();
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (hasAncestorName(event.target, HANDLE_NODE_NAME)) return;
    event.cancelBubble = true;
    void onUpdateShape?.({
      ...shape,
      x: clampTabletopCoordinate(event.target.x()),
      y: clampTabletopCoordinate(event.target.y()),
    });
  };

  // 1. Text label
  if (shape.kind === "text") {
    return (
      <Group
        name={SHAPE_NODE_NAME}
        x={x}
        y={y}
        draggable={canEdit}
        onMouseDown={handleSelectDown}
        onTap={handleSelectDown}
        onDragEnd={handleDragEnd}
      >
        {selected && (
          <Rect
            x={-8}
            y={-5}
            width={width + 16}
            height={height + 8}
            cornerRadius={6}
            stroke="rgba(199,210,254,0.85)"
            strokeWidth={1.2}
            dash={[5, 4]}
            fill="rgba(147,150,247,0.08)"
          />
        )}
        <Text
          text={shape.text || "区域标注"}
          width={width}
          height={height}
          fontSize={16}
          fontStyle="bold"
          fill="#e4e5eb"
          letterSpacing={0.5}
        />
      </Group>
    );
  }

  // 2. Line / Curved Connector (with start, end, and midpoint curvature handles!)
  if (shape.kind === "line") {
    const rawPts = shape.points || [0, 0, width, height];
    const pts: [number, number, number, number] = liveLine?.points || [
      rawPts[0] ?? 0,
      rawPts[1] ?? 0,
      rawPts[2] ?? width,
      rawPts[3] ?? height,
    ];
    const curvature = liveLine?.curvature ?? shape.curvature ?? 0;
    const [x1, y1, x2, y2] = pts;
    const { cx, cy, apexX, apexY } = getLineCurveControlPoint(
      x1,
      y1,
      x2,
      y2,
      curvature
    );
    const curvePoints =
      Math.abs(curvature) < 1
        ? [x1, y1, x2, y2]
        : sampleQuadraticCurvePoints(x1, y1, cx, cy, x2, y2, 28);
    const arrowPoints = shape.arrowEnd
      ? getArrowHeadPoints(cx, cy, x2, y2, 12)
      : null;

    const commitLineUpdate = (
      nextPts: [number, number, number, number],
      nextCurvature: number
    ) => {
      setLiveLine(null);
      void onUpdateShape?.({
        ...shape,
        points: nextPts,
        curvature: nextCurvature,
        width: Math.max(1, Math.abs(nextPts[2] - nextPts[0])),
        height: Math.max(1, Math.abs(nextPts[3] - nextPts[1])),
      });
    };

    return (
      <Group
        name={SHAPE_NODE_NAME}
        x={x}
        y={y}
        draggable={canEdit}
        onMouseDown={handleSelectDown}
        onTap={handleSelectDown}
        onDragEnd={handleDragEnd}
      >
        <Line
          points={curvePoints}
          stroke={strokeColor}
          strokeWidth={selected ? 2.2 : 1.7}
          hitStrokeWidth={18}
          lineCap="round"
          lineJoin="round"
          dash={isDashedStroke ? [7, 5] : undefined}
        />
        {arrowPoints && (
          <Line
            points={arrowPoints}
            stroke={strokeColor}
            strokeWidth={selected ? 2.2 : 1.7}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}

        {/* Interactive handles when selected: Start, End, and Midpoint Curvature */}
        {canEdit && selected && !dashed && (
          <>
            {/* Faint tangent helper line from chord midpoint to curve apex */}
            {Math.abs(curvature) >= 2 && (
              <Line
                points={[(x1 + x2) / 2, (y1 + y2) / 2, apexX, apexY]}
                stroke="rgba(147,150,247,0.35)"
                strokeWidth={1 / Math.max(scale, 0.45)}
                dash={[3, 3]}
                listening={false}
              />
            )}

            {/* Start point handle */}
            <Circle
              name={HANDLE_NODE_NAME}
              x={x1}
              y={y1}
              radius={handleRadius}
              fill="#ffffff"
              stroke="#9396f7"
              strokeWidth={handleStroke}
              draggable
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                setLiveLine({
                  points: [
                    Math.round(event.target.x()),
                    Math.round(event.target.y()),
                    x2,
                    y2,
                  ],
                  curvature,
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                commitLineUpdate(
                  [
                    Math.round(event.target.x()),
                    Math.round(event.target.y()),
                    x2,
                    y2,
                  ],
                  curvature
                );
              }}
            />

            {/* End point handle */}
            <Circle
              name={HANDLE_NODE_NAME}
              x={x2}
              y={y2}
              radius={handleRadius}
              fill="#ffffff"
              stroke="#9396f7"
              strokeWidth={handleStroke}
              draggable
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                setLiveLine({
                  points: [
                    x1,
                    y1,
                    Math.round(event.target.x()),
                    Math.round(event.target.y()),
                  ],
                  curvature,
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                commitLineUpdate(
                  [
                    x1,
                    y1,
                    Math.round(event.target.x()),
                    Math.round(event.target.y()),
                  ],
                  curvature
                );
              }}
            />

            {/* Midpoint curvature control handle (glowing purple dot) */}
            <Circle
              name={HANDLE_NODE_NAME}
              x={apexX}
              y={apexY}
              radius={handleRadius * 1.15}
              fill="#9396f7"
              stroke="#ffffff"
              strokeWidth={handleStroke}
              draggable
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onMouseEnter={(event) => {
                const stage = event.target.getStage();
                if (stage) stage.container().style.cursor = "grab";
              }}
              onMouseLeave={(event) => {
                const stage = event.target.getStage();
                if (stage) stage.container().style.cursor = "default";
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                const nextCurve = getCurvatureFromCurveMidpoint(
                  x1,
                  y1,
                  x2,
                  y2,
                  event.target.x(),
                  event.target.y()
                );
                setLiveLine({ points: pts, curvature: nextCurve });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                const nextCurve = getCurvatureFromCurveMidpoint(
                  x1,
                  y1,
                  x2,
                  y2,
                  event.target.x(),
                  event.target.y()
                );
                commitLineUpdate(pts, nextCurve);
              }}
            />
          </>
        )}
      </Group>
    );
  }

  // 3. 4-Corner Resize Handles for Rect & Ellipse (world-projected, zero jitter)
  const cornerHandles =
    canEdit && selected && !dashed
      ? (
          [
            { id: "nw", hx: 0, hy: 0, cursor: "nwse-resize" },
            { id: "ne", hx: width, hy: 0, cursor: "nesw-resize" },
            { id: "sw", hx: 0, hy: height, cursor: "nesw-resize" },
            { id: "se", hx: width, hy: height, cursor: "nwse-resize" },
          ] as const
        ).map((corner) => (
          <Circle
            key={corner.id}
            name={HANDLE_NODE_NAME}
            x={corner.hx}
            y={corner.hy}
            radius={handleRadius}
            fill="#ffffff"
            stroke="#9396f7"
            strokeWidth={handleStroke}
            draggable
            onMouseDown={(event) => {
              event.cancelBubble = true;
            }}
            onMouseEnter={(event) => {
              const stage = event.target.getStage();
              if (stage) stage.container().style.cursor = corner.cursor;
            }}
            onMouseLeave={(event) => {
              const stage = event.target.getStage();
              if (stage) stage.container().style.cursor = "default";
            }}
            onDragStart={(event) => {
              event.cancelBubble = true;
              const fixedX = corner.id === "nw" || corner.id === "sw" ? x + width : x;
              const fixedY = corner.id === "nw" || corner.id === "ne" ? y + height : y;
              resizeAnchorRef.current = { fixedX, fixedY };
            }}
            onDragMove={(event) => {
              event.cancelBubble = true;
              const stage = event.target.getStage();
              const pointer = stage?.getPointerPosition();
              const anchor = resizeAnchorRef.current;
              if (!stage || !pointer || !anchor) return;
              const worldPoint = stage
                .getAbsoluteTransform()
                .copy()
                .invert()
                .point(pointer);
              const nextBox = {
                x: Math.round(Math.min(anchor.fixedX, worldPoint.x)),
                y: Math.round(Math.min(anchor.fixedY, worldPoint.y)),
                width: Math.max(
                  MIN_SHAPE_SIZE,
                  Math.round(Math.abs(worldPoint.x - anchor.fixedX))
                ),
                height: Math.max(
                  MIN_SHAPE_SIZE,
                  Math.round(Math.abs(worldPoint.y - anchor.fixedY))
                ),
              };
              liveBoxRef.current = nextBox;
              setLiveBox(nextBox);
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              const finalBox = liveBoxRef.current || { x, y, width, height };
              resizeAnchorRef.current = null;
              liveBoxRef.current = null;
              setLiveBox(null);
              void onUpdateShape?.({
                ...shape,
                x: clampTabletopCoordinate(finalBox.x),
                y: clampTabletopCoordinate(finalBox.y),
                width: Math.max(MIN_SHAPE_SIZE, Math.round(finalBox.width)),
                height: Math.max(MIN_SHAPE_SIZE, Math.round(finalBox.height)),
              });
            }}
          />
        ))
      : null;

  // 4. True Distortion-Free Ellipse (circle tool)
  if (shape.kind === "circle") {
    const ellipsePoints = sampleEllipsePoints(
      width / 2,
      height / 2,
      width / 2,
      height / 2,
      64
    );

    return (
      <Group
        name={SHAPE_NODE_NAME}
        x={x}
        y={y}
        draggable={canEdit}
        onMouseDown={handleSelectDown}
        onTap={handleSelectDown}
        onDragEnd={handleDragEnd}
      >
        {selected && !dashed && (
          <Rect
            width={width}
            height={height}
            stroke="rgba(147,150,247,0.28)"
            strokeWidth={1 / Math.max(scale, 0.45)}
            dash={[4, 4]}
            listening={false}
          />
        )}
        <Line
          points={ellipsePoints}
          closed
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          hitStrokeWidth={16}
          dash={isDashedStroke ? [7, 5] : undefined}
        />
        {cornerHandles}
      </Group>
    );
  }

  // 5. Rounded Rectangle (with customizable cornerRadius curvature!)
  const maxRadius = Math.floor(Math.min(width, height) / 2);
  const resolvedRadius = Math.min(
    maxRadius,
    shape.cornerRadius ?? Math.min(28, Math.round(Math.min(width, height) * 0.22))
  );

  return (
    <Group
      name={SHAPE_NODE_NAME}
      x={x}
      y={y}
      draggable={canEdit}
      onMouseDown={handleSelectDown}
      onTap={handleSelectDown}
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={width}
        height={height}
        cornerRadius={resolvedRadius}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        hitStrokeWidth={16}
        dash={isDashedStroke ? [7, 5] : undefined}
      />
      {cornerHandles}
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
  const label = token.label || character?.name || "角色";
  const baseAccent =
    character?.theme_color ||
    (character?.type === "monster"
      ? "#f43f5e"
      : character?.type === "npc"
        ? "#f59e0b"
        : "#9396f7");
  const accent = token.isHidden ? HIDDEN_TOKEN_ACCENT : baseAccent;

  return (
    <Group
      name={TOKEN_NODE_NAME}
      x={token.x}
      y={token.y}
      draggable={canMove}
      onMouseDown={(event) => {
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
      <Circle
        radius={26}
        fill={hexToRgba(accent, token.isHidden ? 0.08 : 0.16)}
        stroke={token.isHidden ? "rgba(148,163,184,0.36)" : undefined}
        strokeWidth={token.isHidden ? 1 : 0}
        dash={token.isHidden ? [4, 4] : undefined}
      />
      <Circle
        radius={11}
        fill={hexToRgba(accent, token.isHidden ? 0.18 : 0.34)}
        listening={false}
      />
      <Circle
        radius={3.8}
        fill={token.isHidden ? "#cbd5e1" : "#ffffff"}
        shadowColor={accent}
        shadowOpacity={0.75}
        shadowBlur={10}
        listening={false}
      />
      {selected && (
        <Circle
          radius={33}
          stroke="rgba(199,210,254,0.82)"
          strokeWidth={1.2}
          dash={[5, 5]}
          listening={false}
        />
      )}
      <Text
        text={label}
        x={-54}
        y={31}
        width={108}
        align="center"
        fontSize={11}
        fontStyle="bold"
        fill={
          token.isHidden ? "rgba(148,163,184,0.82)" : "rgba(228,229,235,0.9)"
        }
        ellipsis
        listening={false}
      />
    </Group>
  );
};
