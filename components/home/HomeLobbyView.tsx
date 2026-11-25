import React from "react";
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Hash,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { Character, ModuleTemplate, Room } from "../../types";
import { Button, Input, Textarea, cn } from "../UI";
import { CoverImageUpload } from "../CoverImageUpload";
import { RoomCard } from "../RoomCard";
import { RoomGridSkeleton, SkeletonBlock } from "../Skeleton";
import type { LobbySortMode } from "../../hooks/useLobbyCatalog";
import {
  getModuleTemplateComplexityLabel,
  getModuleTemplateDurationLabel,
  getModuleTemplatePlayersLabel,
} from "../../services/moduleMarketplace";

type RoomFilter = "all" | "mine" | "created" | "kp_online";

const ROOM_FILTERS: { id: RoomFilter; label: string }[] = [
  { id: "all", label: "全部房间" },
  { id: "kp_online", label: "KP 在线" },
  { id: "mine", label: "我的角色" },
  { id: "created", label: "我的房间" },
];

interface HomeLobbyViewProps {
  isAuthenticated: boolean;
  currentUserId: string | null;
  filteredRooms: Room[];
  isLoadingRooms: boolean;
  roomLoadError: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  roomFilter: string;
  setRoomFilter: (filter: RoomFilter) => void;
  sortMode: LobbySortMode;
  setSortMode: (sortMode: LobbySortMode) => void;
  myCharacters: Character[];
  onlineUsers: Set<string>;
  onJoinRoom: (
    roomId: string,
    charId: string | "pc",
    password?: string | null
  ) => void;
  showCreateRoom: boolean;
  setShowCreateRoom: (show: boolean) => void;
  newRoomTitle: string;
  setNewRoomTitle: (title: string) => void;
  newRoomDesc: string;
  setNewRoomDesc: (description: string) => void;
  newRoomCoverImageUrl: string;
  setNewRoomCoverImageUrl: (url: string) => void;
  newRoomPassword: string;
  setNewRoomPassword: (password: string) => void;
  newRoomType: "text" | "voice";
  setNewRoomType: (type: "text" | "voice") => void;
  loading: boolean;
  onCreateRoom: () => void;
  onRefreshRooms: () => void;
  onLoginRequest: () => void;
  featuredModule?: ModuleTemplate | null;
  isLoadingFeaturedModule?: boolean;
  onOpenModulesTab?: () => void;
  onOpenCharactersTab?: () => void;
  onCreateCharacter?: () => void;
  onEditCharacter?: (char: Character) => void;
}

export const HomeLobbyView: React.FC<HomeLobbyViewProps> = ({
  isAuthenticated,
  currentUserId,
  filteredRooms,
  isLoadingRooms,
  roomLoadError,
  searchQuery,
  setSearchQuery,
  roomFilter,
  setRoomFilter,
  sortMode,
  setSortMode,
  myCharacters,
  onlineUsers,
  onJoinRoom,
  showCreateRoom,
  setShowCreateRoom,
  newRoomTitle,
  setNewRoomTitle,
  newRoomDesc,
  setNewRoomDesc,
  newRoomCoverImageUrl,
  setNewRoomCoverImageUrl,
  newRoomPassword,
  setNewRoomPassword,
  newRoomType,
  setNewRoomType,
  loading,
  onCreateRoom,
  onRefreshRooms,
  onLoginRequest,
  featuredModule = null,
  isLoadingFeaturedModule = false,
  onOpenModulesTab,
  onOpenCharactersTab,
  onCreateCharacter,
  onEditCharacter,
}) => {
  const nextSortMode: LobbySortMode =
    sortMode === "activity" ? "room_number" : "activity";
  const SortIcon = sortMode === "activity" ? Clock3 : Hash;
  const toolbarButtonClass =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold leading-none transition-colors";

  const handleToggleCreateRoom = () => {
    if (!isAuthenticated) {
      onLoginRequest();
      return;
    }
    setShowCreateRoom(!showCreateRoom);
  };

  return (
    <div className="space-y-7">
      {/* Featured Module Hero Banner */}
      {isLoadingFeaturedModule ? (
        <section
          aria-label="加载精选模组橱窗"
          className="overflow-hidden rounded-xl border border-dicecho-border/55 bg-dicecho-panel shadow-sm grid grid-cols-1 lg:grid-cols-12"
        >
          <div className="lg:col-span-7 p-6 lg:p-8 flex flex-col justify-between gap-5">
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-3.5 w-24" />
                <SkeletonBlock className="h-3.5 w-44" />
              </div>
              <SkeletonBlock className="h-8 w-56" />
              <div className="space-y-2 pt-1 max-w-xl">
                <SkeletonBlock className="h-3.5 w-full" />
                <SkeletonBlock className="h-3.5 w-5/6" />
                <SkeletonBlock className="h-3.5 w-2/3" />
              </div>
              <div className="flex gap-2 pt-1">
                <SkeletonBlock className="h-5 w-14 rounded-md" />
                <SkeletonBlock className="h-5 w-16 rounded-md" />
                <SkeletonBlock className="h-5 w-12 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <SkeletonBlock className="h-10 w-40 rounded-lg" />
              <SkeletonBlock className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <div className="lg:col-span-5 relative min-h-[210px] border-t lg:border-t-0 lg:border-l border-dicecho-border/50 bg-dicecho-card/60 p-4 flex items-center justify-center">
            <SkeletonBlock className="h-full min-h-[190px] w-full rounded-lg" />
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-dicecho-border/55 bg-dicecho-panel shadow-sm grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 p-6 lg:p-8 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-dicecho-primary">
                  <Sparkles size={13} />
                  精选模组橱窗
                </span>
                {featuredModule ? (
                  <>
                    <span className="text-dicecho-muted">·</span>
                    <span className="text-dicecho-muted">
                      {featuredModule.system?.toUpperCase() || "CoC 7th"} ·{" "}
                      {getModuleTemplatePlayersLabel(featuredModule)} ·{" "}
                      {getModuleTemplateDurationLabel(featuredModule)} ·{" "}
                      {getModuleTemplateComplexityLabel(featuredModule.complexity)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-dicecho-muted">·</span>
                    <span className="text-dicecho-muted">
                      沉浸式在线 CoC 跑团工作台
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {featuredModule?.title || "欢迎回到 RunTable 跑团桌"}
              </h2>

              <p className="text-sm leading-relaxed text-dicecho-muted max-w-xl line-clamp-3">
                {featuredModule?.summary ||
                  featuredModule?.player_facing_premise ||
                  "支持实时检定骰点、多人语音连麦、BGM 同步、战术场景桌布与模组一键开桌。挑选一部模组或直接建房，与调查员开启下一场冒险。"}
              </p>

              {featuredModule?.tags && featuredModule.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {featuredModule.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-dicecho-border/65 bg-dicecho-raised/35 px-2.5 py-0.5 text-[11px] text-dicecho-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {onOpenModulesTab && (
                <button
                  type="button"
                  onClick={onOpenModulesTab}
                  className="inline-flex items-center gap-2 rounded-lg bg-dicecho-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dicecho-primary-strong"
                >
                  <span>{featuredModule ? "查看模组并一键开桌" : "浏览模组市场"}</span>
                  <ArrowRight size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleCreateRoom}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dicecho-border/65 bg-dicecho-card/70 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:border-dicecho-primary/60 hover:bg-dicecho-primary/15"
              >
                <Plus size={15} />
                <span>{showCreateRoom ? "收起建房面板" : "创建自定义房间"}</span>
              </button>
              {featuredModule?.author?.nickname && (
                <span className="text-xs text-dicecho-muted ml-auto hidden sm:inline">
                  作者：{featuredModule.author.nickname}
                </span>
              )}
            </div>
          </div>

          {/* Cover Image */}
          <div className="lg:col-span-5 relative min-h-[210px] border-t lg:border-t-0 lg:border-l border-dicecho-border/50 bg-gradient-to-br from-dicecho-card via-dicecho-panel to-[#242a38] flex items-center justify-center overflow-hidden">
            {featuredModule?.cover_image_url ? (
              <>
                <img
                  src={featuredModule.cover_image_url}
                  alt={featuredModule.title}
                  className="h-full w-full object-cover max-h-[290px]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-dicecho-panel/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-dicecho-panel/70 lg:via-transparent" />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-dicecho-muted/70">
                <Sparkles size={28} className="text-dicecho-primary/50" />
                <span className="text-xs font-medium">
                  {featuredModule?.title || "RunTable 精选模组"}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main 8/4 Split Grid: Active Tables (Left) + Investigator Cabinet (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 8 cols: Active Tables */}
        <section className="lg:col-span-8 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white">活跃跑团桌</h3>
              <span className="rounded-full bg-dicecho-accent/15 px-2.5 py-0.5 text-xs font-medium text-dicecho-accent tabular-nums">
                {filteredRooms.length} 桌
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {ROOM_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setRoomFilter(filter.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 font-medium transition-colors",
                    roomFilter === filter.id
                      ? "border-dicecho-primary/55 bg-dicecho-primary/20 text-white"
                      : "border-dicecho-border/55 bg-dicecho-panel/60 text-dicecho-muted hover:border-dicecho-border hover:text-white"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-dicecho-border/45 bg-dicecho-panel/80 p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-dicecho-muted"
                  size={17}
                />
                <input
                  type="text"
                  placeholder="输入房间名、简介或房间号搜索"
                  className="w-full rounded-lg border border-dicecho-border/55 bg-dicecho-bg/65 py-2.5 pl-10 pr-4 text-sm text-slate-100 transition-colors placeholder:text-slate-400/60 focus:border-dicecho-primary/70 focus:outline-none"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSortMode(nextSortMode)}
                  className={cn(
                    toolbarButtonClass,
                    "border-dicecho-border/50 bg-dicecho-card/70 text-dicecho-muted hover:border-dicecho-primary/50 hover:text-white"
                  )}
                >
                  <SortIcon size={13} />
                  {sortMode === "activity" ? "默认排序" : "按房间号排序"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleCreateRoom}
                  className={cn(
                    toolbarButtonClass,
                    "shrink-0 border-transparent bg-dicecho-primary-strong text-white hover:bg-dicecho-primary"
                  )}
                >
                  <Plus size={13} />
                  {showCreateRoom ? "收起创建" : "创建房间"}
                </button>
              </div>
            </div>
          </div>

          {showCreateRoom && (
            <CreateRoomPanel
              currentUserId={currentUserId}
              loading={loading}
              newRoomDesc={newRoomDesc}
              newRoomCoverImageUrl={newRoomCoverImageUrl}
              newRoomPassword={newRoomPassword}
              newRoomTitle={newRoomTitle}
              newRoomType={newRoomType}
              setNewRoomDesc={setNewRoomDesc}
              setNewRoomCoverImageUrl={setNewRoomCoverImageUrl}
              setNewRoomPassword={setNewRoomPassword}
              setNewRoomTitle={setNewRoomTitle}
              setNewRoomType={setNewRoomType}
              onCancel={() => setShowCreateRoom(false)}
              onCreateRoom={onCreateRoom}
            />
          )}

          {isLoadingRooms ? (
            <RoomGridSkeleton />
          ) : roomLoadError ? (
            <div className="rounded-xl border border-red-500/30 bg-dicecho-panel/60 px-6 py-14 text-center text-dicecho-muted">
              <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
              <p className="font-medium text-slate-100">{roomLoadError}</p>
              <button
                type="button"
                onClick={onRefreshRooms}
                className="mx-auto mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-dicecho-border/50 bg-dicecho-card/70 px-4 text-sm font-semibold text-white transition-colors hover:border-dicecho-primary/60 hover:bg-dicecho-raised/80"
              >
                <RefreshCw size={15} />
                重新加载
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 animate-fade-in sm:grid-cols-2">
              {filteredRooms.map((room) => (
                <div key={room.id}>
                  <RoomCard
                    room={room}
                    isAuthenticated={isAuthenticated}
                    currentUserId={currentUserId}
                    myCharacters={myCharacters}
                    onlineUsers={onlineUsers}
                    onJoinRoom={onJoinRoom}
                    onLoginRequest={onLoginRequest}
                  />
                </div>
              ))}
              {filteredRooms.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-dicecho-border/50 bg-dicecho-panel/45 py-14 text-center text-dicecho-muted">
                  <Users size={38} className="mx-auto mb-3 opacity-45" />
                  <p className="font-medium text-slate-200">暂无匹配房间</p>
                  <p className="mt-1 text-xs">
                    可以直接点击上方「创建房间」或从精选模组一键开桌。
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right 4 cols: Investigator Cabinet */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">我的调查员</h3>
              <span className="text-xs font-mono text-dicecho-muted tabular-nums">
                ({myCharacters.length})
              </span>
            </div>
            {onCreateCharacter && (
              <button
                type="button"
                onClick={onCreateCharacter}
                className="text-xs font-semibold text-dicecho-primary hover:underline"
              >
                + 新建角色卡
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="rounded-xl border border-dicecho-border/50 bg-dicecho-panel p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <UserPlus size={16} className="text-dicecho-primary" />
                登录后管理你的调查员档案
              </div>
              <p className="text-xs leading-relaxed text-dicecho-muted">
                创建并保存 CoC 调查员卡，加入任意跑团桌时可直接携带入座并同步 HP / SAN / MP 状态。
              </p>
              <Button variant="primary" size="sm" onClick={onLoginRequest}>
                立即登录
              </Button>
            </div>
          ) : myCharacters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-dicecho-border/50 bg-dicecho-panel/60 p-6 text-center space-y-3">
              <Users size={32} className="mx-auto text-dicecho-muted opacity-50" />
              <div>
                <p className="text-sm font-semibold text-white">还没有调查员角色卡</p>
                <p className="mt-1 text-xs text-dicecho-muted">
                  先车一张卡，随时准备入座跑团。
                </p>
              </div>
              {onCreateCharacter && (
                <Button variant="primary" size="sm" icon={Plus} onClick={onCreateCharacter}>
                  新建角色卡
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {myCharacters.slice(0, 3).map((char) => {
                const maxHp = Math.max(char.hp || 10, 12);
                const maxSan = Math.max(char.san || 50, 99);
                const maxMp = Math.max(char.mp || 10, 15);
                return (
                  <div
                    key={char.id}
                    onClick={() => onEditCharacter?.(char)}
                    className="rounded-xl border border-dicecho-border/50 bg-dicecho-panel p-4 space-y-3 shadow-sm transition-colors hover:border-dicecho-primary/55 hover:bg-dicecho-raised/35 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {char.name || "未命名调查员"}
                        </div>
                        <div className="mt-0.5 text-xs text-dicecho-muted truncate">
                          {[char.job || char.role, char.age ? `${char.age}岁` : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md border border-dicecho-border/65 bg-dicecho-raised/40 px-2 py-0.5 text-[10px] font-mono text-dicecho-muted">
                        CoC 7th
                      </span>
                    </div>

                    <div className="space-y-2 text-xs tabular-nums">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-dicecho-muted">HP 生命</span>
                          <span className="font-mono text-white">{char.hp}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-dicecho-raised/55 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-400"
                            style={{
                              width: `${Math.min(100, Math.max(8, (char.hp / maxHp) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-dicecho-muted">SAN 理智</span>
                          <span className="font-mono text-white">{char.san}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-dicecho-raised/55 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-dicecho-accent"
                            style={{
                              width: `${Math.min(100, Math.max(8, (char.san / maxSan) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-dicecho-muted">MP 魔法</span>
                          <span className="font-mono text-white">{char.mp}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-dicecho-raised/55 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-dicecho-primary"
                            style={{
                              width: `${Math.min(100, Math.max(8, (char.mp / maxMp) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {myCharacters.length > 3 && onOpenCharactersTab && (
                <button
                  type="button"
                  onClick={onOpenCharactersTab}
                  className="w-full rounded-lg border border-dicecho-border/55 bg-dicecho-panel/70 py-2 text-xs font-semibold text-dicecho-muted transition-colors hover:border-dicecho-primary/50 hover:text-white"
                >
                  查看全部 {myCharacters.length} 名调查员 →
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const CreateRoomPanel: React.FC<{
  currentUserId: string | null;
  loading: boolean;
  newRoomTitle: string;
  setNewRoomTitle: (title: string) => void;
  newRoomDesc: string;
  setNewRoomDesc: (description: string) => void;
  newRoomCoverImageUrl: string;
  setNewRoomCoverImageUrl: (url: string) => void;
  newRoomPassword: string;
  setNewRoomPassword: (password: string) => void;
  newRoomType: "text" | "voice";
  setNewRoomType: (type: "text" | "voice") => void;
  onCancel: () => void;
  onCreateRoom: () => void;
}> = ({
  currentUserId,
  loading,
  newRoomDesc,
  newRoomCoverImageUrl,
  newRoomPassword,
  newRoomTitle,
  newRoomType,
  setNewRoomDesc,
  setNewRoomCoverImageUrl,
  setNewRoomPassword,
  setNewRoomTitle,
  setNewRoomType,
  onCancel,
  onCreateRoom,
}) => (
  <div className="rounded-xl border border-dicecho-primary/35 bg-dicecho-panel/90 p-5 shadow-sm animate-scale-in">
    <h3 className="text-lg font-bold text-white">新建跑团房间</h3>
    <p className="mt-1 text-sm text-dicecho-muted">
      填写标题、简介、封面和加入方式，创建后会自动以 KP 身份进入。
    </p>
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <RoomTypeButton
          active={newRoomType === "text"}
          icon={MessageSquare}
          label="文字团"
          tone="primary"
          onClick={() => setNewRoomType("text")}
        />
        <RoomTypeButton
          active={newRoomType === "voice"}
          icon={Mic}
          label="语音团"
          tone="accent"
          onClick={() => setNewRoomType("voice")}
        />
      </div>
      <Input
        label="房间标题"
        value={newRoomTitle}
        onChange={(event) => setNewRoomTitle(event.target.value)}
        placeholder="例如：印斯茅斯之影"
      />
      <CoverImageUpload
        value={newRoomCoverImageUrl}
        onChange={setNewRoomCoverImageUrl}
        currentUserId={currentUserId}
        disabled={loading}
      />
      <Input
        label="房间密码（可选）"
        value={newRoomPassword}
        onChange={(event) => setNewRoomPassword(event.target.value)}
        placeholder="留空则为公开房间"
        type="password"
      />
      <Textarea
        label="简介（可选）"
        value={newRoomDesc}
        onChange={(event) => setNewRoomDesc(event.target.value)}
        placeholder="简单介绍模组氛围、招募要求或开团时间..."
      />
      <div className="flex justify-end gap-3 border-t border-dicecho-border/40 pt-4">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button
          onClick={onCreateRoom}
          disabled={!newRoomTitle.trim() || loading}
          icon={Plus}
        >
          {loading ? "创建中..." : "立即创建"}
        </Button>
      </div>
    </div>
  </div>
);

const RoomTypeButton: React.FC<{
  active: boolean;
  icon: React.ElementType;
  label: string;
  tone: "primary" | "accent";
  onClick: () => void;
}> = ({ active, icon: Icon, label, tone, onClick }) => {
  const activeClass =
    tone === "primary"
      ? "border-dicecho-primary/60 bg-dicecho-primary/20 text-white"
      : "border-dicecho-accent/60 bg-dicecho-accent/20 text-white";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-all",
        active
          ? activeClass
          : "border-dicecho-border/40 bg-dicecho-card/70 text-dicecho-muted hover:border-dicecho-border hover:text-white"
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
};
