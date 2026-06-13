import React from "react";
import {
  Eye,
  EyeOff,
  Map as MapIcon,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  User,
  UserCog,
  Swords,
} from "lucide-react";
import type { Character, RoomScene, RoomSceneMarker } from "../types";
import { useRoomScenes } from "../hooks/useRoomScenes";
import {
  clampSceneCoordinate,
  createRoomScene,
  deleteRoomScene,
  deleteRoomSceneMarker,
  getRoomSceneErrorMessage,
  isOwnInvestigatorMarker,
  moveOwnSceneMarker,
  SCENE_BACKGROUND_COLORS,
  SCENE_BACKGROUND_PATTERNS,
  setActiveRoomScene,
  updateRoomScene,
  upsertRoomSceneMarker,
} from "../services/roomScenes";
import { Button, Input, Textarea, cn } from "./UI";

interface RoomSceneViewProps {
  roomId: string;
  isKP: boolean;
  currentUserId: string;
  characters: Character[];
}

interface SceneFormState {
  title: string;
  description: string;
  backgroundColor: string;
  backgroundPattern: RoomScene["background_pattern"];
}

const emptySceneForm: SceneFormState = {
  title: "",
  description: "",
  backgroundColor: SCENE_BACKGROUND_COLORS[0],
  backgroundPattern: "plain",
};

const patternLabels: Record<RoomScene["background_pattern"], string> = {
  plain: "纯色",
  grid: "细线",
  dots: "点阵",
  mist: "雾面",
};

export const RoomSceneView: React.FC<RoomSceneViewProps> = ({
  roomId,
  isKP,
  currentUserId,
  characters,
}) => {
  const { scenes, activeScene, visibleMarkers, isLoading, refresh } =
    useRoomScenes({
      roomId,
      isKeeper: isKP,
    });
  const [form, setForm] = React.useState<SceneFormState>(emptySceneForm);
  const [editingSceneId, setEditingSceneId] = React.useState<string | null>(
    null
  );
  const [selectedCharacterId, setSelectedCharacterId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const characterById = React.useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );

  const markerCharacterIds = React.useMemo(
    () => new Set(visibleMarkers.map((marker) => marker.character_id)),
    [visibleMarkers]
  );

  const markerCandidates = React.useMemo(
    () =>
      characters.filter(
        (character) =>
          character.room_id === roomId &&
          !markerCharacterIds.has(character.id) &&
          (isKP || character.user_id === currentUserId)
      ),
    [characters, currentUserId, isKP, markerCharacterIds, roomId]
  );

  const boardMarkers = React.useMemo(
    () =>
      visibleMarkers.filter((marker) => characterById.has(marker.character_id)),
    [characterById, visibleMarkers]
  );

  const resetForm = () => {
    setEditingSceneId(null);
    setForm(emptySceneForm);
  };

  const beginEditScene = (scene: RoomScene) => {
    setEditingSceneId(scene.id);
    setForm({
      title: scene.title,
      description: scene.description || "",
      backgroundColor: scene.background_color,
      backgroundPattern: scene.background_pattern,
    });
  };

  const handleSaveScene = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    const result = editingSceneId
      ? await updateRoomScene({
          sceneId: editingSceneId,
          title: form.title,
          description: form.description,
          backgroundColor: form.backgroundColor,
          backgroundPattern: form.backgroundPattern,
        })
      : await createRoomScene({
          roomId,
          title: form.title,
          description: form.description,
          backgroundColor: form.backgroundColor,
          backgroundPattern: form.backgroundPattern,
        });
    setBusy(false);

    if (result.error) {
      alert(getRoomSceneErrorMessage(result.error, "保存场景失败"));
      return;
    }

    resetForm();
    await refresh();
  };

  const handleSetActiveScene = async (sceneId: string) => {
    const { error } = await setActiveRoomScene(sceneId);
    if (error) {
      alert(getRoomSceneErrorMessage(error, "切换场景失败"));
      return;
    }
    await refresh();
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!window.confirm("删除这个场景和其中的所有标志？")) return;
    const { error } = await deleteRoomScene(sceneId);
    if (error) {
      alert(getRoomSceneErrorMessage(error, "删除场景失败"));
      return;
    }
    await refresh();
  };

  const handleAddMarker = async () => {
    if (!activeScene || !selectedCharacterId) return;
    const character = characterById.get(selectedCharacterId);
    const { error } = await upsertRoomSceneMarker({
      sceneId: activeScene.id,
      characterId: selectedCharacterId,
      x: 50,
      y: 50,
      isHidden: character?.type !== "investigator",
    });

    if (error) {
      alert(getRoomSceneErrorMessage(error, "添加标志失败"));
      return;
    }

    setSelectedCharacterId("");
    await refresh();
  };

  const handleMoveMarker = async (
    marker: RoomSceneMarker,
    position: { x: number; y: number }
  ) => {
    const character = characterById.get(marker.character_id);
    const canMove =
      isKP ||
      isOwnInvestigatorMarker({
        marker,
        characterUserId: character?.user_id,
        characterType: character?.type,
        currentUserId,
      });

    if (!canMove) return;

    const { error } = isKP
      ? await upsertRoomSceneMarker({
          sceneId: marker.scene_id,
          characterId: marker.character_id,
          x: position.x,
          y: position.y,
          isHidden: marker.is_hidden,
          label: marker.label,
        })
      : await moveOwnSceneMarker({
          markerId: marker.id,
          x: position.x,
          y: position.y,
        });

    if (error) {
      alert(getRoomSceneErrorMessage(error, "移动标志失败"));
      return;
    }

    await refresh();
  };

  const handleToggleHidden = async (marker: RoomSceneMarker) => {
    const character = characterById.get(marker.character_id);
    if (!activeScene || character?.type === "investigator") return;

    const { error } = await upsertRoomSceneMarker({
      sceneId: activeScene.id,
      characterId: marker.character_id,
      x: marker.x,
      y: marker.y,
      isHidden: !marker.is_hidden,
      label: marker.label,
    });

    if (error) {
      alert(getRoomSceneErrorMessage(error, "更新标志失败"));
      return;
    }

    await refresh();
  };

  const handleDeleteMarker = async (markerId: string) => {
    const { error } = await deleteRoomSceneMarker(markerId);
    if (error) {
      alert(getRoomSceneErrorMessage(error, "移除标志失败"));
      return;
    }
    await refresh();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:grid xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold text-white">
                <MapIcon size={18} className="text-dicecho-primary" />
                场景列表
              </h2>
              <Button
                size="icon"
                variant="ghost"
                icon={RefreshCw}
                onClick={() => void refresh()}
                title="刷新场景"
              />
            </div>
            {isLoading && (
              <p className="text-sm text-dicecho-muted">正在同步场景...</p>
            )}
            {!isLoading && scenes.length === 0 && (
              <p className="text-sm leading-6 text-dicecho-muted">
                暂无场景。Keeper 创建后，所有房间成员都会看到当前场景。
              </p>
            )}
            <div className="space-y-2">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    scene.id === activeScene?.id
                      ? "border-dicecho-primary/45 bg-dicecho-primary/12"
                      : "border-dicecho-border/35 bg-dicecho-panel/55"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {scene.title}
                      </div>
                      {scene.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-dicecho-muted">
                          {scene.description}
                        </p>
                      )}
                    </div>
                    {scene.is_active && (
                      <span className="rounded-md border border-dicecho-primary/30 bg-dicecho-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-dicecho-primary">
                        当前
                      </span>
                    )}
                  </div>
                  {isKP && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!scene.is_active && (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => void handleSetActiveScene(scene.id)}
                        >
                          设为当前
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => beginEditScene(scene)}
                      >
                        编辑
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => void handleDeleteScene(scene.id)}
                      >
                        删除
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {isKP && (
            <section className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
                <Plus size={18} className="text-dicecho-primary" />
                {editingSceneId ? "编辑场景" : "创建场景"}
              </h2>
              <div className="space-y-3">
                <Input
                  label="标题"
                  value={form.title}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="例如：旧宅大厅"
                />
                <Textarea
                  label="描述"
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  placeholder="简短记录光源、出口、危险点..."
                />
                <div>
                  <label className="mb-1.5 ml-1 block text-xs font-medium text-dicecho-muted">
                    背景色
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SCENE_BACKGROUND_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        onClick={() =>
                          setForm((previous) => ({
                            ...previous,
                            backgroundColor: color,
                          }))
                        }
                        className={cn(
                          "h-8 w-8 rounded-lg border transition-transform hover:scale-105",
                          form.backgroundColor === color
                            ? "border-white"
                            : "border-dicecho-border/50"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 ml-1 block text-xs font-medium text-dicecho-muted">
                    背景纹理
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SCENE_BACKGROUND_PATTERNS.map((pattern) => (
                      <button
                        key={pattern}
                        type="button"
                        onClick={() =>
                          setForm((previous) => ({
                            ...previous,
                            backgroundPattern: pattern,
                          }))
                        }
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                          form.backgroundPattern === pattern
                            ? "border-dicecho-primary/50 bg-dicecho-primary/15 text-white"
                            : "border-dicecho-border/45 bg-dicecho-panel/55 text-dicecho-muted hover:text-white"
                        )}
                      >
                        {patternLabels[pattern]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    icon={Plus}
                    onClick={() => void handleSaveScene()}
                    disabled={!form.title.trim() || busy}
                  >
                    {editingSceneId ? "保存" : "创建"}
                  </Button>
                  {editingSceneId && (
                    <Button variant="ghost" onClick={resetForm}>
                      取消
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}
        </aside>

        <section className="min-w-0 rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-white">
                {activeScene?.title || "场景概览"}
              </h1>
              <p className="mt-1 text-sm leading-6 text-dicecho-muted">
                {activeScene?.description ||
                  "角色标志会以实时方式同步，用来快速概览跑团现场。"}
              </p>
            </div>
            {isKP && activeScene && (
              <div className="flex flex-col gap-2 md:min-w-[280px]">
                <label className="text-xs font-medium text-dicecho-muted">
                  添加角色标志
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedCharacterId}
                    onChange={(event) =>
                      setSelectedCharacterId(event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-dicecho-border/50 bg-dicecho-panel/70 px-3 py-2 text-sm text-slate-100 transition-colors focus:border-dicecho-primary/70 focus:outline-none"
                  >
                    <option value="">选择角色</option>
                    {markerCandidates.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} · {getCharacterRoleLabel(character)}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    icon={Plus}
                    disabled={!selectedCharacterId}
                    onClick={() => void handleAddMarker()}
                    title="添加标志"
                  />
                </div>
              </div>
            )}
          </div>

          <SceneBoard
            scene={activeScene}
            markers={boardMarkers}
            characters={characterById}
            isKP={isKP}
            currentUserId={currentUserId}
            onMoveMarker={handleMoveMarker}
            onToggleHidden={handleToggleHidden}
            onDeleteMarker={handleDeleteMarker}
          />
        </section>
      </div>
    </div>
  );
};

const SceneBoard: React.FC<{
  scene: RoomScene | null;
  markers: RoomSceneMarker[];
  characters: Map<string, Character>;
  isKP: boolean;
  currentUserId: string;
  onMoveMarker: (
    marker: RoomSceneMarker,
    position: { x: number; y: number }
  ) => Promise<void>;
  onToggleHidden: (marker: RoomSceneMarker) => Promise<void>;
  onDeleteMarker: (markerId: string) => Promise<void>;
}> = ({
  scene,
  markers,
  characters,
  isKP,
  currentUserId,
  onMoveMarker,
  onToggleHidden,
  onDeleteMarker,
}) => {
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [draftPositions, setDraftPositions] = React.useState<
    Record<string, { x: number; y: number }>
  >({});

  const getBoardPosition = (event: React.PointerEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampSceneCoordinate(((event.clientX - rect.left) / rect.width) * 100),
      y: clampSceneCoordinate(((event.clientY - rect.top) / rect.height) * 100),
    };
  };

  const startDrag = (event: React.PointerEvent, marker: RoomSceneMarker) => {
    const character = characters.get(marker.character_id);
    const canMove =
      isKP ||
      isOwnInvestigatorMarker({
        marker,
        characterUserId: character?.user_id,
        characterType: character?.type,
        currentUserId,
      });
    if (!canMove) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(marker.id);
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!draggingId) return;
    const position = getBoardPosition(event);
    if (!position) return;
    setDraftPositions((previous) => ({
      ...previous,
      [draggingId]: position,
    }));
  };

  const endDrag = async (event: React.PointerEvent, marker: RoomSceneMarker) => {
    if (draggingId !== marker.id) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const position =
      draftPositions[marker.id] || getBoardPosition(event) || {
        x: marker.x,
        y: marker.y,
      };
    setDraggingId(null);
    setDraftPositions((previous) => {
      const next = { ...previous };
      delete next[marker.id];
      return next;
    });
    await onMoveMarker(marker, position);
  };

  if (!scene) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-dicecho-border/60 bg-dicecho-panel/45 text-center">
        <div>
          <MapPin size={42} className="mx-auto mb-3 text-dicecho-primary" />
          <p className="font-bold text-white">还没有当前场景</p>
          <p className="mt-1 text-sm text-dicecho-muted">
            Keeper 创建第一张场景后，这里会变成实时概览板。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={boardRef}
      className={cn(
        "relative aspect-[16/10] min-h-[420px] overflow-hidden rounded-lg border border-dicecho-border/50 shadow-inner",
        getPatternClass(scene.background_pattern)
      )}
      style={{ backgroundColor: scene.background_color }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.10),transparent_30%),linear-gradient(135deg,rgba(0,0,0,0.08),rgba(0,0,0,0.38))]" />
      {markers.map((marker) => {
        const character = characters.get(marker.character_id);
        const position = draftPositions[marker.id] || {
          x: marker.x,
          y: marker.y,
        };
        const canMove =
          isKP ||
          isOwnInvestigatorMarker({
            marker,
            characterUserId: character?.user_id,
            characterType: character?.type,
            currentUserId,
          });

        return (
          <div
            key={marker.id}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
          >
            <button
              type="button"
              onPointerDown={(event) => startDrag(event, marker)}
              onPointerMove={moveDrag}
              onPointerUp={(event) => void endDrag(event, marker)}
              className={cn(
                "flex min-w-[8rem] max-w-[11rem] items-center gap-2 rounded-lg border px-2 py-2 text-left shadow-lg backdrop-blur transition-transform",
                getMarkerClass(character, marker),
                canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                draggingId === marker.id && "scale-105"
              )}
            >
              <MarkerAvatar character={character} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">
                  {marker.label || character?.name || "未知角色"}
                </span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-white/65">
                  {character ? getCharacterRoleLabel(character) : "marker"}
                </span>
              </span>
            </button>
            {isKP && (
              <div className="mt-1 flex justify-center gap-1 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                {character?.type !== "investigator" && (
                  <button
                    type="button"
                    onClick={() => void onToggleHidden(marker)}
                    className="rounded-md border border-dicecho-border/40 bg-dicecho-panel/90 p-1 text-dicecho-muted hover:text-white"
                    title={marker.is_hidden ? "显示标志" : "隐藏标志"}
                  >
                    {marker.is_hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onDeleteMarker(marker.id)}
                  className="rounded-md border border-rose-500/25 bg-rose-500/10 p-1 text-rose-300 hover:text-white"
                  title="移除标志"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function MarkerAvatar({ character }: { character?: Character }) {
  if (character?.avatar_url) {
    return (
      <img
        src={character.avatar_url}
        alt={character.name}
        className="h-8 w-8 shrink-0 rounded-md border border-white/20 object-cover"
      />
    );
  }

  const Icon =
    character?.type === "monster"
      ? Swords
      : character?.type === "npc"
      ? UserCog
      : User;

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/10">
      <Icon size={17} />
    </span>
  );
}

function getCharacterRoleLabel(character: Character) {
  if (character.type === "monster") return "怪物";
  if (character.type === "npc") return "NPC";
  return "调查员";
}

function getMarkerClass(character: Character | undefined, marker: RoomSceneMarker) {
  if (marker.is_hidden) {
    return "border-amber-400/45 bg-amber-500/20 text-amber-50 opacity-80";
  }

  if (character?.type === "monster") {
    return "border-rose-400/45 bg-rose-500/35 text-rose-50";
  }

  if (character?.type === "npc") {
    return "border-cyan-300/45 bg-cyan-500/28 text-cyan-50";
  }

  return "border-dicecho-primary/50 bg-dicecho-primary/30 text-white";
}

function getPatternClass(pattern: RoomScene["background_pattern"]) {
  if (pattern === "grid") {
    return "bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]";
  }

  if (pattern === "dots") {
    return "bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:28px_28px]";
  }

  if (pattern === "mist") {
    return "bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_78%_62%,rgba(255,255,255,0.10),transparent_30%)]";
  }

  return "";
}
