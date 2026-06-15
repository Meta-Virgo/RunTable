import React from "react";
import {
  Circle,
  Eye,
  EyeOff,
  Map as MapIcon,
  Pencil,
  Trash2,
  User,
  UserCog,
  Users,
  Swords,
} from "lucide-react";
import type { Character, RoomScene, RoomSceneMarker } from "../../types";
import type { RoomMemberPanelItem } from "../../services/roomMembers";
import { Button, cn } from "../UI";
import {
  getCharacterRoleLabel,
  getMarkerAccent,
  scenePatternLabels,
} from "./scenePresentation";

interface SceneSidePanelProps {
  scenes: RoomScene[];
  activeScene: RoomScene | null;
  markers: RoomSceneMarker[];
  characters: Map<string, Character>;
  markerCandidates: Character[];
  selectedCharacterId: string;
  roomMemberItems: RoomMemberPanelItem[];
  isKeeper: boolean;
  isLoading: boolean;
  onSelectScene: (sceneId: string) => void;
  onEditScene: (scene: RoomScene) => void;
  onDeleteScene: (sceneId: string) => void;
  onSelectCharacter: (characterId: string) => void;
  onToggleHidden: (marker: RoomSceneMarker) => void;
  onDeleteMarker: (markerId: string) => void;
}

const tabs = [
  { id: "scenes", label: "场景", icon: MapIcon },
  { id: "tokens", label: "Token", icon: Users },
  { id: "members", label: "在线", icon: Circle },
] as const;

type ScenePanelTab = (typeof tabs)[number]["id"];

export const SceneSidePanel: React.FC<SceneSidePanelProps> = ({
  scenes,
  activeScene,
  markers,
  characters,
  markerCandidates,
  selectedCharacterId,
  roomMemberItems,
  isKeeper,
  isLoading,
  onSelectScene,
  onEditScene,
  onDeleteScene,
  onSelectCharacter,
  onToggleHidden,
  onDeleteMarker,
}) => {
  const [activeTab, setActiveTab] = React.useState<ScenePanelTab>("scenes");

  return (
    <aside className="flex min-h-0 w-full flex-col border-l border-dicecho-border/40 bg-dicecho-panel/78 lg:w-[22rem]">
      <div className="grid shrink-0 grid-cols-3 border-b border-dicecho-border/35 bg-dicecho-card/50 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors",
              activeTab === tab.id
                ? "bg-dicecho-primary/18 text-white"
                : "text-dicecho-muted hover:bg-white/10 hover:text-white"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
        {activeTab === "scenes" && (
          <SceneList
            scenes={scenes}
            activeScene={activeScene}
            isKeeper={isKeeper}
            isLoading={isLoading}
            onSelectScene={onSelectScene}
            onEditScene={onEditScene}
            onDeleteScene={onDeleteScene}
          />
        )}

        {activeTab === "tokens" && (
          <TokenPanel
            activeScene={activeScene}
            markers={markers}
            characters={characters}
            markerCandidates={markerCandidates}
            selectedCharacterId={selectedCharacterId}
            isKeeper={isKeeper}
            onSelectCharacter={onSelectCharacter}
            onToggleHidden={onToggleHidden}
            onDeleteMarker={onDeleteMarker}
          />
        )}

        {activeTab === "members" && (
          <MembersPanel roomMemberItems={roomMemberItems} />
        )}
      </div>
    </aside>
  );
};

const SceneList: React.FC<{
  scenes: RoomScene[];
  activeScene: RoomScene | null;
  isKeeper: boolean;
  isLoading: boolean;
  onSelectScene: (sceneId: string) => void;
  onEditScene: (scene: RoomScene) => void;
  onDeleteScene: (sceneId: string) => void;
}> = ({
  scenes,
  activeScene,
  isKeeper,
  isLoading,
  onSelectScene,
  onEditScene,
  onDeleteScene,
}) => (
  <div className="space-y-3">
    {isLoading && <p className="text-sm text-dicecho-muted">正在同步场景...</p>}
    {!isLoading && scenes.length === 0 && (
      <p className="rounded-lg border border-dashed border-dicecho-border/50 bg-dicecho-card/45 p-4 text-sm leading-6 text-dicecho-muted">
        暂无场景。Keeper 创建后，房间成员会看到当前场景。
      </p>
    )}
    {scenes.map((scene) => (
      <article
        key={scene.id}
        className={cn(
          "rounded-lg border p-3 transition-colors",
          scene.id === activeScene?.id
            ? "border-dicecho-primary/45 bg-dicecho-primary/12"
            : "border-dicecho-border/35 bg-dicecho-card/55"
        )}
      >
        <button
          type="button"
          onClick={() => isKeeper && onSelectScene(scene.id)}
          className="block w-full text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">
                {scene.title}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-dicecho-muted">
                {scenePatternLabels[scene.background_pattern]} ·{" "}
                {scene.background_color}
              </div>
            </div>
            {scene.is_active && (
              <span className="rounded-md border border-dicecho-primary/30 bg-dicecho-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-dicecho-primary">
                当前
              </span>
            )}
          </div>
          {scene.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-dicecho-muted">
              {scene.description}
            </p>
          )}
        </button>
        {isKeeper && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!scene.is_active && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => onSelectScene(scene.id)}
              >
                设为当前
              </Button>
            )}
            <Button
              size="xs"
              variant="ghost"
              icon={Pencil}
              onClick={() => onEditScene(scene)}
            >
              编辑
            </Button>
            <Button
              size="xs"
              variant="danger"
              icon={Trash2}
              onClick={() => onDeleteScene(scene.id)}
            >
              删除
            </Button>
          </div>
        )}
      </article>
    ))}
  </div>
);

const TokenPanel: React.FC<{
  activeScene: RoomScene | null;
  markers: RoomSceneMarker[];
  characters: Map<string, Character>;
  markerCandidates: Character[];
  selectedCharacterId: string;
  isKeeper: boolean;
  onSelectCharacter: (characterId: string) => void;
  onToggleHidden: (marker: RoomSceneMarker) => void;
  onDeleteMarker: (markerId: string) => void;
}> = ({
  activeScene,
  markers,
  characters,
  markerCandidates,
  selectedCharacterId,
  isKeeper,
  onSelectCharacter,
  onToggleHidden,
  onDeleteMarker,
}) => (
  <div className="space-y-4">
    {isKeeper && activeScene && (
      <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-card/55 p-3">
        <label className="mb-2 block text-xs font-bold text-dicecho-muted">
          将角色放入当前场景
        </label>
        <select
          value={selectedCharacterId}
          onChange={(event) => onSelectCharacter(event.target.value)}
          className="h-10 w-full rounded-lg border border-dicecho-border/50 bg-dicecho-panel/80 px-3 text-sm text-slate-100 outline-none transition-colors focus:border-dicecho-primary/70"
        >
          <option value="">
            {markerCandidates.length === 0 ? "没有可加入的角色" : "选择角色"}
          </option>
          {markerCandidates.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name} · {getCharacterRoleLabel(character)}
            </option>
          ))}
        </select>
      </div>
    )}

    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">当前场景 Token</h3>
        <span className="text-xs text-dicecho-muted">{markers.length}</span>
      </div>
      {!activeScene && (
        <p className="rounded-lg border border-dashed border-dicecho-border/50 bg-dicecho-card/45 p-4 text-sm text-dicecho-muted">
          还没有当前场景。
        </p>
      )}
      {activeScene && markers.length === 0 && (
        <p className="rounded-lg border border-dashed border-dicecho-border/50 bg-dicecho-card/45 p-4 text-sm text-dicecho-muted">
          当前场景还没有 Token。
        </p>
      )}
      {markers.map((marker) => {
        const character = characters.get(marker.character_id);
        const Icon =
          character?.type === "monster"
            ? Swords
            : character?.type === "npc"
            ? UserCog
            : User;
        return (
          <article
            key={marker.id}
            className="rounded-lg border border-dicecho-border/35 bg-dicecho-card/55 p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white"
                style={{ backgroundColor: `${getMarkerAccent(character, marker)}66` }}
              >
                {character?.avatar_url ? (
                  <img
                    src={character.avatar_url}
                    alt={character.name}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <Icon size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">
                  {marker.label || character?.name || "未知角色"}
                </div>
                <div className="text-[11px] font-semibold text-dicecho-muted">
                  {getCharacterRoleLabel(character)} · {marker.x}, {marker.y}
                </div>
              </div>
              {marker.is_hidden && (
                <EyeOff size={15} className="shrink-0 text-amber-300" />
              )}
            </div>
            {isKeeper && (
              <div className="mt-3 flex gap-2">
                {character?.type !== "investigator" && (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={marker.is_hidden ? Eye : EyeOff}
                    onClick={() => onToggleHidden(marker)}
                  >
                    {marker.is_hidden ? "显示" : "隐藏"}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="danger"
                  icon={Trash2}
                  onClick={() => onDeleteMarker(marker.id)}
                >
                  移除
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  </div>
);

const MembersPanel: React.FC<{
  roomMemberItems: RoomMemberPanelItem[];
}> = ({ roomMemberItems }) => (
  <div className="space-y-2">
    {roomMemberItems.length === 0 && (
      <p className="rounded-lg border border-dashed border-dicecho-border/50 bg-dicecho-card/45 p-4 text-sm text-dicecho-muted">
        暂无成员信息。
      </p>
    )}
    {roomMemberItems.map((member) => (
      <article
        key={member.userId}
        className="flex items-center gap-3 rounded-lg border border-dicecho-border/35 bg-dicecho-card/55 p-3"
      >
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            member.isOnline ? "bg-emerald-400" : "bg-slate-600"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">
            {member.displayName}
          </div>
          <div className="text-[11px] font-semibold text-dicecho-muted">
            {member.roleLabel}
            {member.characterName ? ` · ${member.characterName}` : ""}
          </div>
        </div>
      </article>
    ))}
  </div>
);
