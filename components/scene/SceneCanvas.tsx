import React from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { MapPin } from "lucide-react";
import type {
  Character,
  RoomScene,
  RoomSceneMarker,
  RoomSceneMarkerDragPayload,
} from "../../types";
import {
  canMoveSceneMarker,
  clampSceneScale,
  SCENE_WORLD_HEIGHT,
  SCENE_WORLD_WIDTH,
  scenePercentToWorld,
  sceneWorldToPercent,
} from "../../services/roomScenes";
import { cn } from "../UI";
import {
  getCharacterRoleLabel,
  getMarkerAccent,
  getScenePatternClass,
} from "./scenePresentation";

const FIT_PADDING = 36;
const TOKEN_RADIUS = 24;
const TOKEN_LABEL_WIDTH = 132;

interface SceneCanvasProps {
  scene: RoomScene | null;
  markers: RoomSceneMarker[];
  characters: Map<string, Character>;
  isKeeper: boolean;
  currentUserId: string;
  gridVisible: boolean;
  remoteDragPositions: Record<string, RoomSceneMarkerDragPayload>;
  onScaleChange: (scale: number) => void;
  fitRequest: number;
  onMarkerDraftMove: (
    marker: RoomSceneMarker,
    position: { x: number; y: number }
  ) => void;
  onMarkerMoveEnd: (
    marker: RoomSceneMarker,
    position: { x: number; y: number }
  ) => Promise<void>;
  onSelectMarker?: (markerId: string | null) => void;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  scene,
  markers,
  characters,
  isKeeper,
  currentUserId,
  gridVisible,
  remoteDragPositions,
  fitRequest,
  onScaleChange,
  onMarkerDraftMove,
  onMarkerMoveEnd,
  onSelectMarker,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Konva.Stage>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [stageState, setStageState] = React.useState({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [localDrafts, setLocalDrafts] = React.useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(
    null
  );

  const fitCanvas = React.useCallback(() => {
    const width = containerRef.current?.clientWidth || size.width;
    const height = containerRef.current?.clientHeight || size.height;
    if (!width || !height) return;

    const nextScale = clampSceneScale(
      Math.min(
        (width - FIT_PADDING * 2) / SCENE_WORLD_WIDTH,
        (height - FIT_PADDING * 2) / SCENE_WORLD_HEIGHT
      )
    );
    const next = {
      scale: nextScale,
      x: (width - SCENE_WORLD_WIDTH * nextScale) / 2,
      y: (height - SCENE_WORLD_HEIGHT * nextScale) / 2,
    };
    setStageState(next);
    onScaleChange(next.scale);
  }, [onScaleChange, size.height, size.width]);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextSize = {
        width: Math.max(0, Math.floor(entry.contentRect.width)),
        height: Math.max(0, Math.floor(entry.contentRect.height)),
      };
      setSize(nextSize);
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  React.useEffect(() => {
    fitCanvas();
  }, [fitCanvas, fitRequest]);

  React.useEffect(() => {
    if (!scene) {
      setLocalDrafts({});
      setSelectedMarkerId(null);
      onSelectMarker?.(null);
    }
  }, [onSelectMarker, scene]);

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageState.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stageState.x) / oldScale,
      y: (pointer.y - stageState.y) / oldScale,
    };
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.08;
    const nextScale = clampSceneScale(
      direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    );

    const next = {
      scale: nextScale,
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale,
    };
    setStageState(next);
    onScaleChange(next.scale);
  };

  const handleStageDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (event.target !== event.target.getStage()) return;

    setStageState((previous) => ({
      ...previous,
      x: event.target.x(),
      y: event.target.y(),
    }));
  };

  const handleStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.target === event.target.getStage()) {
      setSelectedMarkerId(null);
      onSelectMarker?.(null);
    }
  };

  const setSelected = (markerId: string) => {
    setSelectedMarkerId(markerId);
    onSelectMarker?.(markerId);
  };

  if (!scene) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-dicecho-panel/35 text-center">
        <div className="max-w-sm px-6">
          <MapPin size={44} className="mx-auto mb-3 text-dicecho-primary" />
          <p className="font-bold text-white">还没有当前场景</p>
          <p className="mt-2 text-sm leading-6 text-dicecho-muted">
            Keeper 创建第一张场景后，这里会变成可缩放、可平移的地图工作区。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden",
        getScenePatternClass(scene.background_pattern)
      )}
      style={{ backgroundColor: scene.background_color }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.10),transparent_28%),linear-gradient(135deg,rgba(0,0,0,0.06),rgba(0,0,0,0.34))]" />
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={stageState.x}
          y={stageState.y}
          scaleX={stageState.scale}
          scaleY={stageState.scale}
          draggable
          onWheel={handleWheel}
          onDragEnd={handleStageDragEnd}
          onClick={handleStageClick}
          onTap={handleStageClick}
          className="relative z-10"
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={SCENE_WORLD_WIDTH}
              height={SCENE_WORLD_HEIGHT}
              fill={scene.background_color}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={2}
              cornerRadius={8}
            />
            {gridVisible && <SceneGrid />}
            {markers.map((marker) => {
              const character = characters.get(marker.character_id);
              const remoteDraft = remoteDragPositions[marker.id];
              const percentPosition =
                localDrafts[marker.id] ||
                (remoteDraft && remoteDraft.sceneId === scene.id
                  ? { x: remoteDraft.x, y: remoteDraft.y }
                  : { x: marker.x, y: marker.y });
              const worldPosition = scenePercentToWorld(percentPosition);
              const canMove = canMoveSceneMarker({
                marker,
                character,
                isKeeper,
                currentUserId,
              });
              return (
                <SceneToken
                  key={marker.id}
                  marker={marker}
                  character={character}
                  x={worldPosition.x}
                  y={worldPosition.y}
                  canMove={canMove}
                  isSelected={selectedMarkerId === marker.id}
                  isRemoteDraft={Boolean(remoteDraft)}
                  onSelect={() => setSelected(marker.id)}
                  onMove={(position) => {
                    const nextPercent = sceneWorldToPercent(position);
                    setLocalDrafts((previous) => ({
                      ...previous,
                      [marker.id]: nextPercent,
                    }));
                    onMarkerDraftMove(marker, nextPercent);
                  }}
                  onMoveEnd={async (position) => {
                    const nextPercent = sceneWorldToPercent(position);
                    setLocalDrafts((previous) => {
                      const next = { ...previous };
                      delete next[marker.id];
                      return next;
                    });
                    await onMarkerMoveEnd(marker, nextPercent);
                  }}
                />
              );
            })}
          </Layer>
        </Stage>
      )}
    </div>
  );
};

const SceneGrid: React.FC = () => {
  const gridLines = [];
  const step = 80;
  for (let x = step; x < SCENE_WORLD_WIDTH; x += step) {
    gridLines.push(
      <Line
        key={`x-${x}`}
        points={[x, 0, x, SCENE_WORLD_HEIGHT]}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
    );
  }
  for (let y = step; y < SCENE_WORLD_HEIGHT; y += step) {
    gridLines.push(
      <Line
        key={`y-${y}`}
        points={[0, y, SCENE_WORLD_WIDTH, y]}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
      />
    );
  }
  return <>{gridLines}</>;
};

const SceneToken: React.FC<{
  marker: RoomSceneMarker;
  character?: Character;
  x: number;
  y: number;
  canMove: boolean;
  isSelected: boolean;
  isRemoteDraft: boolean;
  onSelect: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onMoveEnd: (position: { x: number; y: number }) => Promise<void>;
}> = ({
  marker,
  character,
  x,
  y,
  canMove,
  isSelected,
  isRemoteDraft,
  onSelect,
  onMove,
  onMoveEnd,
}) => {
  const accent = getMarkerAccent(character, marker);
  const label = marker.label || character?.name || "未知角色";
  const roleLabel = getCharacterRoleLabel(character);

  return (
    <Group
      x={x}
      y={y}
      draggable={canMove}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onDragMove={(event) => {
        event.cancelBubble = true;
        onMove({
          x: event.target.x(),
          y: event.target.y(),
        });
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        void onMoveEnd({
          x: event.target.x(),
          y: event.target.y(),
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
      {isSelected && (
        <Circle
          radius={TOKEN_RADIUS + 8}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.72)"
          strokeWidth={2}
          dash={[8, 6]}
        />
      )}
      {isRemoteDraft && (
        <Circle
          radius={TOKEN_RADIUS + 12}
          stroke="rgba(147,150,247,0.72)"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}
      <Circle
        radius={TOKEN_RADIUS}
        fill={marker.is_hidden ? "rgba(245,158,11,0.85)" : accent}
        stroke="rgba(255,255,255,0.82)"
        strokeWidth={2}
        shadowColor="black"
        shadowOpacity={0.32}
        shadowBlur={14}
      />
      <Text
        text={label.slice(0, 1).toUpperCase()}
        width={TOKEN_RADIUS * 2}
        height={TOKEN_RADIUS * 2}
        x={-TOKEN_RADIUS}
        y={-TOKEN_RADIUS + 7}
        align="center"
        fontSize={22}
        fontStyle="bold"
        fill="white"
      />
      <Group x={TOKEN_RADIUS + 8} y={-21}>
        <Rect
          width={TOKEN_LABEL_WIDTH}
          height={42}
          cornerRadius={7}
          fill="rgba(31,41,59,0.86)"
          stroke={isSelected ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)"}
          strokeWidth={1}
          shadowColor="black"
          shadowOpacity={0.25}
          shadowBlur={10}
        />
        <Text
          text={label}
          x={10}
          y={7}
          width={TOKEN_LABEL_WIDTH - 20}
          fontSize={13}
          fontStyle="bold"
          fill="white"
          ellipsis
        />
        <Text
          text={marker.is_hidden ? `${roleLabel} · 隐藏` : roleLabel}
          x={10}
          y={24}
          width={TOKEN_LABEL_WIDTH - 20}
          fontSize={10}
          fill="rgba(226,232,240,0.72)"
          ellipsis
        />
      </Group>
    </Group>
  );
};
