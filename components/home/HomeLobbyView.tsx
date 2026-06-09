import React from "react";
import { Loader2, MessageSquare, Mic, Plus, Search, Users } from "lucide-react";
import type { Character, Room } from "../../types";
import { Button, Input, Textarea } from "../UI";
import { RoomCard } from "../RoomCard";

type RoomFilter = "all" | "mine" | "created" | "kp_online";

const ROOM_FILTERS: { id: RoomFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "mine", label: "我的角色" },
  { id: "created", label: "我的房间" },
  { id: "kp_online", label: "KP在线" },
];

interface HomeLobbyViewProps {
  currentUserId: string | null;
  filteredRooms: Room[];
  isLoadingRooms: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  roomFilter: string;
  setRoomFilter: (filter: RoomFilter) => void;
  myCharacters: Character[];
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
  newRoomPassword: string;
  setNewRoomPassword: (password: string) => void;
  newRoomType: "text" | "voice";
  setNewRoomType: (type: "text" | "voice") => void;
  loading: boolean;
  onCreateRoom: () => void;
}

export const HomeLobbyView: React.FC<HomeLobbyViewProps> = ({
  currentUserId,
  filteredRooms,
  isLoadingRooms,
  searchQuery,
  setSearchQuery,
  roomFilter,
  setRoomFilter,
  myCharacters,
  onJoinRoom,
  showCreateRoom,
  setShowCreateRoom,
  newRoomTitle,
  setNewRoomTitle,
  newRoomDesc,
  setNewRoomDesc,
  newRoomPassword,
  setNewRoomPassword,
  newRoomType,
  setNewRoomType,
  loading,
  onCreateRoom,
}) => (
  <div className="space-y-6">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96 group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors"
            size={18}
          />
          <input
            type="text"
            placeholder="搜索房间..."
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <Button icon={Plus} onClick={() => setShowCreateRoom(true)}>
          创建房间
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {ROOM_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setRoomFilter(filter.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              roomFilter === filter.id
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                : "bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-800 hover:text-slate-300"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>

    {showCreateRoom && (
      <CreateRoomPanel
        loading={loading}
        newRoomDesc={newRoomDesc}
        newRoomPassword={newRoomPassword}
        newRoomTitle={newRoomTitle}
        newRoomType={newRoomType}
        setNewRoomDesc={setNewRoomDesc}
        setNewRoomPassword={setNewRoomPassword}
        setNewRoomTitle={setNewRoomTitle}
        setNewRoomType={setNewRoomType}
        onCancel={() => setShowCreateRoom(false)}
        onCreateRoom={onCreateRoom}
      />
    )}

    {isLoadingRooms ? (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 animate-fade-in">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
        <p className="text-slate-400 font-medium">正在加载房间...</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {filteredRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            currentUserId={currentUserId}
            myCharacters={myCharacters}
            onJoinRoom={onJoinRoom}
          />
        ))}
        {filteredRooms.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <Users size={48} className="mx-auto mb-3 opacity-20" />
            <p>暂无房间</p>
          </div>
        )}
      </div>
    )}
  </div>
);

const CreateRoomPanel: React.FC<{
  loading: boolean;
  newRoomTitle: string;
  setNewRoomTitle: (title: string) => void;
  newRoomDesc: string;
  setNewRoomDesc: (description: string) => void;
  newRoomPassword: string;
  setNewRoomPassword: (password: string) => void;
  newRoomType: "text" | "voice";
  setNewRoomType: (type: "text" | "voice") => void;
  onCancel: () => void;
  onCreateRoom: () => void;
}> = ({
  loading,
  newRoomDesc,
  newRoomPassword,
  newRoomTitle,
  newRoomType,
  setNewRoomDesc,
  setNewRoomPassword,
  setNewRoomTitle,
  setNewRoomType,
  onCancel,
  onCreateRoom,
}) => (
  <div className="bg-slate-800/30 border border-indigo-500/30 rounded-2xl p-6 animate-scale-in">
    <h3 className="text-lg font-bold text-white mb-4">新建跑团房间</h3>
    <div className="space-y-4">
      <div className="flex gap-4">
        <RoomTypeButton
          active={newRoomType === "text"}
          icon={MessageSquare}
          label="文字团"
          tone="indigo"
          onClick={() => setNewRoomType("text")}
        />
        <RoomTypeButton
          active={newRoomType === "voice"}
          icon={Mic}
          label="语音团"
          tone="pink"
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
        label="房间密码 (可选)"
        value={newRoomPassword}
        onChange={(event) => setNewRoomPassword(event.target.value)}
        placeholder="留空则为公开房间"
        type="password"
      />
      <Textarea
        label="简介 (可选)"
        value={newRoomDesc}
        onChange={(event) => setNewRoomDesc(event.target.value)}
        placeholder="简单的模组介绍或招募要求..."
      />
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
  tone: "indigo" | "pink";
  onClick: () => void;
}> = ({ active, icon: Icon, label, tone, onClick }) => {
  const activeClass =
    tone === "indigo"
      ? "bg-indigo-500/20 border-indigo-500 text-indigo-400"
      : "bg-pink-500/20 border-pink-500 text-pink-400";

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
        active
          ? activeClass
          : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600"
      }`}
    >
      <Icon size={24} />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
};

