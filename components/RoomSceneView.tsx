import React from "react";
import {
  Circle,
  Eye,
  EyeOff,
  Map as MapIcon,
  Trash2,
  MousePointer2,
  Plus,
  RefreshCw,
  Square,
  Type,
} from "lucide-react";
import type { Character, TabletopMapTile, TabletopShape } from "../types";
import { useTabletopRoom } from "../hooks/useTabletopRoom";
import { Button, cn } from "./UI";
import { TabletopCanvas } from "./tabletop/TabletopCanvas";

interface RoomSceneViewProps {
  roomId: string;
  isKP: boolean;
  currentUserId: string;
  characters: Character[];
  roomMemberItems?: unknown[];
}

export type TabletopMapBrush = TabletopMapTile["kind"];
export type TabletopTool =
  | "select"
  | TabletopShape["kind"]
  | "reveal"
  | "hide"
  | "map";

const statusLabels: Record<string, string> = {
  idle: "未连接",
  connecting: "连接中",
  connected: "实时同步",
  reconnecting: "重连中",
  local: "本地模式",
  error: "同步异常",
};

const shapeTools: Array<{
  id: TabletopTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: "select", label: "选择 / 拖动", icon: MousePointer2 },
  { id: "rect", label: "拖拽画矩形", icon: Square },
  { id: "circle", label: "拖拽画圆形", icon: Circle },
  { id: "text", label: "添加文本", icon: Type },
  { id: "reveal", label: "揭示可见范围", icon: Eye },
  { id: "hide", label: "遮蔽可见范围", icon: EyeOff },
  { id: "map", label: "编辑地图", icon: MapIcon },
];

const mapBrushes: Array<{ id: TabletopMapBrush; label: string; className: string }> = [
  { id: "floor", label: "地板", className: "bg-slate-500/70" },
  { id: "wall", label: "墙", className: "bg-slate-950/90" },
  { id: "door", label: "门", className: "bg-amber-700/80" },
  { id: "void", label: "空白", className: "bg-black" },
];

export const RoomSceneView: React.FC<RoomSceneViewProps> = ({
  roomId,
  isKP,
  currentUserId,
  characters,
}) => {
  const tabletop = useTabletopRoom({
    roomId,
    isKeeper: isKP,
    currentUserId,
    characters,
  });
  const [scale, setScale] = React.useState(1);
  const [fitRequest, setFitRequest] = React.useState(0);
  const [selectedCharacterId, setSelectedCharacterId] = React.useState("");
  const [tool, setTool] = React.useState<TabletopTool>("select");
  const [mapBrush, setMapBrush] = React.useState<TabletopMapBrush>("floor");
  const [isSceneMenuOpen, setIsSceneMenuOpen] = React.useState(false);
  const [isEditingSceneTitle, setIsEditingSceneTitle] = React.useState(false);
  const [sceneTitleDraft, setSceneTitleDraft] = React.useState("");
  const sceneMenuRef = React.useRef<HTMLDivElement | null>(null);
  const sceneTitleInputRef = React.useRef<HTMLInputElement | null>(null);

  const charactersById = React.useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );
  const activeSceneTokens = React.useMemo(
    () =>
      tabletop.state.tokens.filter(
        (token) => token.sceneId === tabletop.activeScene?.id
      ),
    [tabletop.activeScene?.id, tabletop.state.tokens]
  );
  const tokenCharacterIds = React.useMemo(
    () => new Set(activeSceneTokens.map((token) => token.characterId)),
    [activeSceneTokens]
  );
  const tokenCandidates = React.useMemo(
    () =>
      characters.filter(
        (character) =>
          character.room_id === roomId &&
          !tokenCharacterIds.has(character.id) &&
          (isKP || character.user_id === currentUserId)
      ),
    [characters, currentUserId, isKP, roomId, tokenCharacterIds]
  );

  React.useEffect(() => {
    setSelectedCharacterId((previous) =>
      previous && tokenCandidates.some((character) => character.id === previous)
        ? previous
        : ""
    );
  }, [tokenCandidates]);

  React.useEffect(() => {
    setSceneTitleDraft(tabletop.activeScene?.title || "");
    setIsEditingSceneTitle(false);
  }, [tabletop.activeScene?.id, tabletop.activeScene?.title]);

  React.useEffect(() => {
    if (!isEditingSceneTitle) return;
    sceneTitleInputRef.current?.focus();
    sceneTitleInputRef.current?.select();
  }, [isEditingSceneTitle]);

  React.useEffect(() => {
    if (!isSceneMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (sceneMenuRef.current?.contains(event.target as Node)) return;
      setIsSceneMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSceneMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSceneMenuOpen]);

  const connectionLabel =
    statusLabels[tabletop.connectionStatus] || tabletop.connectionStatus;
  const connectionTitle = tabletop.connectionDetail
    ? `${connectionLabel}: ${tabletop.connectionDetail}`
    : connectionLabel;

  const handleAddToken = async () => {
    if (!selectedCharacterId) return;
    await tabletop.addToken(selectedCharacterId);
    setSelectedCharacterId("");
  };

  const startEditingSceneTitle = () => {
    if (!isKP || !tabletop.activeScene) return;
    setIsSceneMenuOpen(false);
    setSceneTitleDraft(tabletop.activeScene.title);
    setIsEditingSceneTitle(true);
  };

  const commitSceneTitle = async () => {
    if (!tabletop.activeScene) {
      setIsEditingSceneTitle(false);
      return;
    }
    const nextTitle = sceneTitleDraft.trim();
    setIsEditingSceneTitle(false);
    if (!nextTitle || nextTitle === tabletop.activeScene.title) {
      setSceneTitleDraft(tabletop.activeScene.title);
      return;
    }
    await tabletop.renameActiveScene(nextTitle);
  };

  const handleSelectScene = (sceneId: string) => {
    setIsSceneMenuOpen(false);
    if (!sceneId || sceneId === tabletop.activeScene?.id) return;
    void tabletop.setActiveScene(sceneId);
  };

  const handleSelectTool = (nextTool: TabletopTool) => {
    setTool((currentTool) => (currentTool === nextTool ? "select" : nextTool));
  };

  const activeToolLabel =
    shapeTools.find((item) => item.id === tool)?.label || "选择 / 拖动";
  const activeBrushLabel =
    mapBrushes.find((brush) => brush.id === mapBrush)?.label || "地板";

  return (
    <div className="relative flex min-h-[420px] flex-1 overflow-hidden bg-[#0d1322]">
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex justify-center">
        <div
          aria-label="场景操作"
          className="pointer-events-auto flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-dicecho-border/45 bg-dicecho-card/86 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div ref={sceneMenuRef} className="relative min-w-[11rem]">
            <div
              aria-label="当前场景"
              className={cn(
                "flex h-9 w-[12rem] items-center rounded-full border border-dicecho-border/50 bg-dicecho-panel/85 px-2 text-sm font-semibold text-slate-100 outline-none transition-colors",
                isKP && tabletop.state.scenes.length > 0
                  ? "hover:border-dicecho-primary/55"
                  : "opacity-70"
              )}
            >
              {isEditingSceneTitle ? (
                <input
                  ref={sceneTitleInputRef}
                  value={sceneTitleDraft}
                  onChange={(event) => setSceneTitleDraft(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => void commitSceneTitle()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void commitSceneTitle();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setSceneTitleDraft(tabletop.activeScene?.title || "");
                      setIsEditingSceneTitle(false);
                    }
                  }}
                  maxLength={80}
                  aria-label="场景名称"
                  className="min-w-0 flex-1 rounded-full border border-dicecho-primary/45 bg-dicecho-panel px-3 py-1 text-sm font-bold text-slate-100 outline-none ring-2 ring-dicecho-primary/30"
                />
              ) : isKP ? (
                <button
                  type="button"
                  title="修改场景名"
                  aria-label="修改场景名"
                  disabled={!tabletop.activeScene}
                  onClick={startEditingSceneTitle}
                  className="min-w-0 flex-1 truncate rounded-full px-3 py-1 text-left font-bold text-slate-100 transition-colors hover:bg-dicecho-primary/18 hover:text-white focus:outline-none focus:ring-2 focus:ring-dicecho-primary/45 disabled:pointer-events-none disabled:opacity-70"
                >
                  {tabletop.activeScene?.title || "暂无场景"}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate px-3 py-1 text-left font-bold text-slate-100">
                  {tabletop.activeScene?.title || "暂无场景"}
                </span>
              )}
              <span className="ml-1 h-4 w-px shrink-0 bg-dicecho-border/50" />
              <button
                type="button"
                disabled={!isKP || tabletop.state.scenes.length === 0}
                aria-label="切换场景"
                aria-haspopup="listbox"
                aria-expanded={isSceneMenuOpen}
                onClick={() => {
                  setIsEditingSceneTitle(false);
                  setIsSceneMenuOpen((open) => !open);
                }}
                className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold text-dicecho-muted transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-dicecho-primary/45 disabled:pointer-events-none"
              >
                切换
              </button>
            </div>

            {isSceneMenuOpen && (
              <div
                role="listbox"
                aria-label="选择场景"
                className="absolute left-0 top-11 z-50 max-h-64 w-[15rem] overflow-y-auto rounded-2xl border border-dicecho-border/55 bg-dicecho-card/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl custom-scrollbar"
              >
                {tabletop.state.scenes.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    role="option"
                    aria-selected={scene.id === tabletop.activeScene?.id}
                    onClick={() => handleSelectScene(scene.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      scene.id === tabletop.activeScene?.id
                        ? "bg-dicecho-primary/18 text-white"
                        : "text-slate-200 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className="min-w-0 truncate font-semibold">
                      {scene.title}
                    </span>
                    {scene.id === tabletop.activeScene?.id && (
                      <span className="shrink-0 rounded-full bg-dicecho-primary/25 px-2 py-0.5 text-[10px] font-bold text-dicecho-primary">
                        当前
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            </div>

            {isKP && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  icon={Plus}
                  onClick={() => void tabletop.createScene()}
                  className="h-9 rounded-full whitespace-nowrap"
                >
                  新场景
                </Button>

                <Button
                  size="icon"
                  variant="danger"
                  icon={Trash2}
                  title="删除当前场景"
                  aria-label="删除当前场景"
                  disabled={!tabletop.activeScene || tabletop.state.scenes.length <= 1}
                  onClick={() => void tabletop.deleteActiveScene()}
                  className="h-9 w-9 rounded-full"
                />
              </>
            )}
          </div>

          {isKP && (
              <div
                className="flex items-center gap-1 rounded-full border border-dicecho-border/35 bg-dicecho-panel/55 p-1"
                aria-label="桌面工具"
              >
                {shapeTools.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTool(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      tool === item.id
                        ? "bg-dicecho-primary/22 text-white"
                        : "text-dicecho-muted hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <item.icon size={15} />
                  </button>
                ))}
              </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="适应画布"
              title="点击归位画布"
              onClick={() => setFitRequest((request) => request + 1)}
              className="hidden h-8 min-w-[4rem] items-center justify-center rounded-full border border-dicecho-border/35 bg-dicecho-panel/55 px-2 text-xs font-bold text-slate-200 transition-colors hover:border-dicecho-primary/45 hover:bg-dicecho-primary/15 hover:text-white sm:inline-flex"
            >
              {Math.round(scale * 100)}%
            </button>
          </div>
        </div>
      </div>

      {isKP && (
        <div className="pointer-events-none absolute left-4 top-20 z-30 flex flex-col gap-2">
          {tool === "map" ? (
            <div
              aria-label="地图笔刷"
              className="pointer-events-auto w-44 rounded-2xl border border-dicecho-border/45 bg-dicecho-card/88 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl"
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold text-white">地图编辑</span>
                <span className="rounded-full bg-dicecho-primary/18 px-2 py-0.5 text-[10px] font-bold text-dicecho-primary">
                  {activeBrushLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {mapBrushes.map((brush) => (
                  <button
                    key={brush.id}
                    type="button"
                    onClick={() => setMapBrush(brush.id)}
                    title={brush.label}
                    aria-label={brush.label}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-bold transition-colors",
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
          ) : tool !== "select" ? (
            <div className="pointer-events-none rounded-xl border border-dicecho-border/40 bg-dicecho-card/78 px-3 py-2 text-xs font-bold text-slate-100 shadow-xl shadow-black/25 backdrop-blur-xl">
              {activeToolLabel}
            </div>
          ) : null}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex justify-end">
        <div
          aria-label="同步状态"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-dicecho-border/45 bg-dicecho-card/82 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <span
            title={connectionTitle}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold",
              tabletop.connectionStatus === "connected"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : tabletop.connectionStatus === "local"
                  ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
                  : tabletop.connectionStatus === "error"
                    ? "border-red-400/25 bg-red-400/10 text-red-300"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-300"
            )}
          >
            {connectionLabel}
          </span>
          {tabletop.connectionStatus === "local" && tabletop.connectionDetail && (
            <span className="hidden max-w-[18rem] truncate text-xs font-medium text-sky-200/80 lg:inline">
              {tabletop.connectionDetail}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            icon={RefreshCw}
            aria-label={tabletop.isLoading ? "正在同步" : "刷新桌面"}
            onClick={() => void tabletop.refresh()}
            className="h-8 w-8 rounded-full"
          />
        </div>
      </div>

      {isKP && (
        <div className="pointer-events-none absolute right-4 top-1/2 z-30 flex -translate-y-1/2 justify-end">
          <div
            aria-label="调查员和 NPC 操作"
            className="pointer-events-auto flex max-h-[22rem] w-[4.5rem] flex-col items-center gap-2 rounded-full border border-dicecho-border/45 bg-dicecho-card/82 px-2 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl"
          >
            <div
              role="listbox"
              aria-label="选择要放入桌面的角色"
              className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto py-1 custom-scrollbar"
            >
              {tokenCandidates.length === 0 && (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-dicecho-border/55 bg-dicecho-panel/55 text-xs font-bold text-dicecho-muted"
                  title="没有可放入角色"
                >
                  --
                </span>
              )}
              {tokenCandidates.map((character) => (
                <CharacterAvatarButton
                  key={character.id}
                  character={character}
                  selected={selectedCharacterId === character.id}
                  onSelect={() => setSelectedCharacterId(character.id)}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!selectedCharacterId}
              aria-label="放入点位"
              title="放入点位"
              onClick={() => void handleAddToken()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-dicecho-primary/35 bg-dicecho-primary/18 text-white transition-colors hover:bg-dicecho-primary/28 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}

      <TabletopCanvas
        state={tabletop.state}
        scene={tabletop.activeScene}
        characters={charactersById}
        isKeeper={isKP}
        selectedTokenId={tabletop.selectedTokenId}
        tool={tool}
        mapBrush={mapBrush}
        onToolChange={setTool}
        onSelectedTokenChange={tabletop.setSelectedTokenId}
        canMoveToken={tabletop.canMoveToken}
        onTokenMove={tabletop.moveToken}
        onCreateShape={tabletop.createShape}
        onUpdateShape={tabletop.updateShape}
        onDeleteShape={tabletop.deleteShape}
        onUpdateMapTile={tabletop.updateMapTile}
        onDeleteToken={tabletop.deleteToken}
        onToggleTokenHidden={tabletop.toggleTokenHidden}
        onRevealRect={tabletop.revealRect}
        onHideRect={tabletop.hideRect}
        canCreateScene={isKP}
        onCreateScene={tabletop.createScene}
        fitRequest={fitRequest}
        onScaleChange={setScale}
      />
    </div>
  );
};

const CharacterAvatarButton: React.FC<{
  character: Character;
  selected: boolean;
  onSelect: () => void;
}> = ({ character, selected, onSelect }) => {
  const accent =
    character.theme_color ||
    (character.type === "monster"
      ? "#dc2626"
      : character.type === "npc"
        ? "#d97706"
        : "#4f46e5");
  const initial = Array.from(character.name.trim() || character.type)[0] || "?";

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`选择 ${character.name}`}
      title={character.name}
      onClick={onSelect}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-bold text-white shadow-sm transition-all",
        selected
          ? "border-white bg-dicecho-primary/30 ring-2 ring-dicecho-primary/70"
          : "border-white/15 bg-dicecho-panel/80 hover:border-dicecho-primary/60 hover:bg-white/10"
      )}
      style={!character.avatar_url ? { backgroundColor: `${accent}99` } : undefined}
    >
      {character.avatar_url ? (
        <img
          src={character.avatar_url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial.toUpperCase()}</span>
      )}
    </button>
  );
};
