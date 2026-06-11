import React from "react";
import {
  Clock3,
  Filter,
  Hash,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Search,
  Users,
} from "lucide-react";
import type { Character, Room } from "../../types";
import { Button, Input, Textarea, cn } from "../UI";
import { RoomCard } from "../RoomCard";
import type { LobbySortMode } from "../../hooks/useLobbyCatalog";

type RoomFilter = "all" | "mine" | "created" | "kp_online";

const ROOM_FILTERS: { id: RoomFilter; label: string; description: string }[] = [
  { id: "all", label: "全部房间", description: "开放中的跑团" },
  { id: "mine", label: "我的角色", description: "已加入的房间" },
  { id: "created", label: "我的房间", description: "由我主持" },
  { id: "kp_online", label: "KP 在线", description: "可立即沟通" },
];

interface HomeLobbyViewProps {
  isAuthenticated: boolean;
  currentUserId: string | null;
  filteredRooms: Room[];
  isLoadingRooms: boolean;
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
  onLoginRequest: () => void;
}

export const HomeLobbyView: React.FC<HomeLobbyViewProps> = ({
  isAuthenticated,
  currentUserId,
  filteredRooms,
  isLoadingRooms,
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
  onLoginRequest,
}) => {
  const nextSortMode: LobbySortMode =
    sortMode === "activity" ? "room_number" : "activity";
  const SortIcon = sortMode === "activity" ? Clock3 : Hash;
  const toolbarButtonClass =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold leading-none transition-colors";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Filter size={16} className="text-dicecho-primary" />
              筛选
            </div>
            <div className="space-y-2">
              {ROOM_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setRoomFilter(filter.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-all",
                    roomFilter === filter.id
                      ? "border-dicecho-primary/50 bg-dicecho-primary/20 text-white"
                      : "border-transparent text-dicecho-muted hover:border-dicecho-border/50 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {filter.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-dicecho-muted">
                    {filter.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-4 text-sm shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Users size={16} className="text-dicecho-accent" />
              我的角色
            </div>
            <div className="mt-3 text-2xl font-bold text-white">
              {myCharacters.length}
            </div>
            <p className="mt-1 text-xs text-dicecho-muted">
              快找张桌子坐下
            </p>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-bg/90 p-3 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1 group">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-dicecho-muted"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="输入房间名、简介或房间号搜索"
                  className="w-full rounded-lg border border-dicecho-border/50 bg-dicecho-panel/70 py-2.5 pl-10 pr-4 text-sm text-slate-100 shadow-sm transition-colors duration-150 placeholder:text-slate-400/60 focus:border-dicecho-primary/70 focus:outline-none"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2 text-sm text-dicecho-muted">
                <button
                  type="button"
                  onClick={() => setSortMode(nextSortMode)}
                  className={cn(
                    toolbarButtonClass,
                    "border-dicecho-border/40 bg-dicecho-panel/55 text-dicecho-muted hover:border-dicecho-primary/50 hover:bg-dicecho-raised/60 hover:text-white"
                  )}
                >
                  <SortIcon size={13} />
                  {sortMode === "activity" ? "默认排序" : "按房间号排序"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      onLoginRequest();
                      return;
                    }
                    setShowCreateRoom(!showCreateRoom);
                  }}
                  className={cn(
                    toolbarButtonClass,
                    "shrink-0 border-transparent bg-dicecho-primary-strong text-white shadow-none hover:bg-dicecho-primary hover:border-transparent"
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
            <div className="flex flex-col items-center justify-center rounded-lg border border-dicecho-border/30 bg-dicecho-panel/50 py-24 text-dicecho-muted animate-fade-in">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-dicecho-primary" />
              <p className="text-sm font-medium">正在加载房间...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 animate-fade-in md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isAuthenticated={isAuthenticated}
                  currentUserId={currentUserId}
                  myCharacters={myCharacters}
                  onlineUsers={onlineUsers}
                  onJoinRoom={onJoinRoom}
                  onLoginRequest={onLoginRequest}
                />
              ))}
              {filteredRooms.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-dicecho-border/40 bg-dicecho-panel/40 py-16 text-center text-dicecho-muted">
                  <Users size={42} className="mx-auto mb-3 opacity-45" />
                  <p className="font-medium text-slate-200">暂无匹配房间</p>
                  <p className="mt-1 text-sm">换个关键词或筛选条件试试。</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const CreateRoomPanel: React.FC<{
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
  <div className="rounded-lg border border-dicecho-primary/30 bg-dicecho-panel/80 p-5 shadow-sm animate-scale-in">
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
      <Input
        label="封面 URL（可选）"
        value={newRoomCoverImageUrl}
        onChange={(event) => setNewRoomCoverImageUrl(event.target.value)}
        placeholder="https://example.com/cover.jpg"
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
          icon={loading ? Loader2 : Plus}
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
