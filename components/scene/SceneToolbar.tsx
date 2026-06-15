import React from "react";
import {
  ChevronsRight,
  Edit3,
  Grid3X3,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Users,
  ZoomIn,
} from "lucide-react";
import type { RoomScene } from "../../types";
import { Button, cn } from "../UI";

interface SceneToolbarProps {
  scenes: RoomScene[];
  activeScene: RoomScene | null;
  isKeeper: boolean;
  isLoading: boolean;
  scalePercent: number;
  gridVisible: boolean;
  sidePanelOpen: boolean;
  canAddToken: boolean;
  selectedCharacterId: string;
  markerCandidateCount: number;
  onSelectScene: (sceneId: string) => void;
  onNewScene: () => void;
  onEditScene: () => void;
  onAddToken: () => void;
  onRefresh: () => void;
  onFitCanvas: () => void;
  onToggleGrid: () => void;
  onToggleSidePanel: () => void;
}

export const SceneToolbar: React.FC<SceneToolbarProps> = ({
  scenes,
  activeScene,
  isKeeper,
  isLoading,
  scalePercent,
  gridVisible,
  sidePanelOpen,
  canAddToken,
  selectedCharacterId,
  markerCandidateCount,
  onSelectScene,
  onNewScene,
  onEditScene,
  onAddToken,
  onRefresh,
  onFitCanvas,
  onToggleGrid,
  onToggleSidePanel,
}) => (
  <div className="flex min-h-[4rem] shrink-0 flex-wrap items-center gap-2 border-b border-dicecho-border/40 bg-dicecho-card/70 px-3 py-3 md:px-4">
    <div className="flex min-w-[12rem] flex-1 items-center gap-2">
      <select
        value={activeScene?.id || ""}
        onChange={(event) => onSelectScene(event.target.value)}
        disabled={!isKeeper || scenes.length === 0}
        aria-label="当前场景"
        className="h-10 min-w-0 flex-1 rounded-lg border border-dicecho-border/50 bg-dicecho-panel/80 px-3 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-dicecho-primary/70 disabled:opacity-60"
      >
        {scenes.length === 0 ? (
          <option value="">暂无场景</option>
        ) : (
          scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.is_active ? "当前 · " : ""}
              {scene.title}
            </option>
          ))
        )}
      </select>
      <Button
        size="icon"
        variant="ghost"
        icon={RefreshCw}
        title={isLoading ? "正在刷新" : "刷新场景"}
        onClick={onRefresh}
      />
    </div>

    {isKeeper && (
      <div className="flex items-center gap-2">
        <Button size="sm" icon={Plus} onClick={onNewScene}>
          新建场景
        </Button>
        <Button
          size="icon"
          variant="secondary"
          icon={Edit3}
          title="编辑当前场景"
          disabled={!activeScene}
          onClick={onEditScene}
        />
        <Button
          size="sm"
          variant="secondary"
          icon={Users}
          disabled={!canAddToken}
          title={
            selectedCharacterId
              ? "将选中角色放入当前场景"
              : markerCandidateCount > 0
              ? "请先在右侧选择角色"
              : "没有可加入的角色"
          }
          onClick={onAddToken}
        >
          加入 Token
        </Button>
      </div>
    )}

    <div className="ml-auto flex items-center gap-1 rounded-lg border border-dicecho-border/35 bg-dicecho-panel/55 p-1">
      <span className="inline-flex h-8 min-w-[4.5rem] items-center justify-center gap-1 rounded-md px-2 text-xs font-bold text-slate-200">
        <ZoomIn size={14} className="text-dicecho-muted" />
        {scalePercent}%
      </span>
      <button
        type="button"
        onClick={onFitCanvas}
        className="flex h-8 w-8 items-center justify-center rounded-md text-dicecho-muted transition-colors hover:bg-white/10 hover:text-white"
        title="适应画布"
      >
        <Maximize2 size={15} />
      </button>
      <button
        type="button"
        onClick={onToggleGrid}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          gridVisible
            ? "bg-dicecho-primary/18 text-white"
            : "text-dicecho-muted hover:bg-white/10 hover:text-white"
        )}
        title={gridVisible ? "关闭网格" : "开启网格"}
      >
        <Grid3X3 size={15} />
      </button>
      <button
        type="button"
        onClick={onToggleSidePanel}
        className="flex h-8 w-8 items-center justify-center rounded-md text-dicecho-muted transition-colors hover:bg-white/10 hover:text-white"
        title={sidePanelOpen ? "收起右侧面板" : "展开右侧面板"}
      >
        {sidePanelOpen ? (
          <PanelRightClose size={15} />
        ) : (
          <PanelRightOpen size={15} />
        )}
      </button>
    </div>

    {!sidePanelOpen && (
      <button
        type="button"
        onClick={onToggleSidePanel}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-dicecho-primary/30 bg-dicecho-primary/10 px-3 text-xs font-bold text-white transition-colors hover:bg-dicecho-primary/18"
      >
        <ChevronsRight size={15} />
        面板
      </button>
    )}
  </div>
);
