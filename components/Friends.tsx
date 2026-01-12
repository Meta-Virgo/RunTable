import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import {
  Profile,
  Friendship,
  GameHistory,
  GameHistoryParticipant,
} from "../types";
import { Button, Modal } from "./UI";
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  History,
  Skull,
  Crown,
  Loader2,
  User,
  Trash2,
} from "lucide-react";
import { AvatarUpload } from "./AvatarUpload";
import { useElasticScroll } from "../hooks/useElasticScroll";

interface FriendsProps {
  currentUser: Profile | null;
}

export const Friends: React.FC<FriendsProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<"list" | "requests">("list");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Resume Modal State
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Added for standalone history modal
  const [kpHistory, setKpHistory] = useState<GameHistory[]>([]);
  const [playerHistory, setPlayerHistory] = useState<
    (GameHistoryParticipant & { game_history: GameHistory })[]
  >([]);
  const [historyTab, setHistoryTab] = useState<"kp" | "player">("player");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const resumeScrollRef = React.useRef<HTMLDivElement>(null);
  const resumeContentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(resumeScrollRef, resumeContentRef);

  const historyScrollRef = React.useRef<HTMLDivElement>(null);
  const historyContentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(historyScrollRef, historyContentRef);

  useEffect(() => {
    if (currentUser) {
      fetchFriends();
      fetchRequests();
    }
  }, [currentUser, activeTab]);

  const fetchFriends = async () => {
    if (!currentUser) return;

    // Fetch accepted friendships where I am user_id OR friend_id
    const { data } = await supabase
      .from("friendships")
      .select(
        `
        *,
        friend_profile:friend_id (id, nickname, avatar_url, user_code, bio, is_vip, level, created_at),
        user_profile:user_id (id, nickname, avatar_url, user_code, bio, is_vip, level, created_at)
      `
      )
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
      .eq("status", "accepted");

    if (data) {
      // Normalize: I want the "other person" as friend_profile
      const normalized = data.map((f: any) => {
        const isMeSender = f.user_id === currentUser.id;
        return {
          ...f,
          friend_profile: isMeSender ? f.friend_profile : f.user_profile,
        };
      });
      setFriends(normalized);
    }
  };

  const fetchRequests = async () => {
    if (!currentUser) return;
    // Fetch pending requests where I am the RECEIVER (friend_id)
    const { data } = await supabase
      .from("friendships")
      .select(
        `
        *,
        user_profile:user_id (id, nickname, avatar_url, user_code, bio, is_vip, level, created_at)
      `
      )
      .eq("friend_id", currentUser.id)
      .eq("status", "pending");

    if (data) {
      setRequests(
        data.map((r: any) => ({ ...r, friend_profile: r.user_profile }))
      );
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;
    setIsSearching(true);
    setSearchResults([]);

    let query = supabase
      .from("profiles")
      .select(
        "id, nickname, avatar_url, user_code, bio, is_vip, level, created_at"
      )
      .neq("id", currentUser.id); // Exclude self

    // Check if query is numeric (UID) or string (Nickname)
    if (/^\d+$/.test(searchQuery)) {
      query = query.eq("user_code", parseInt(searchQuery));
    } else {
      query = query.ilike("nickname", `%${searchQuery}%`);
    }

    const { data } = await query;
    if (data) {
      setSearchResults(data);
    }
    setIsSearching(false);
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!currentUser) return;

    // Rate Limit Check (30s per target user)
    const lastRequestTime = localStorage.getItem(
      `last_friend_request_${targetUserId}`
    );
    if (lastRequestTime) {
      const timeDiff = Date.now() - parseInt(lastRequestTime);
      if (timeDiff < 30000) {
        alert(
          `操作过于频繁，请等待 ${Math.ceil(
            (30000 - timeDiff) / 1000
          )} 秒后再试`
        );
        return;
      }
    }

    // Check if already friends or requested
    const { data: existing } = await supabase
      .from("friendships")
      .select("*")
      .or(
        `and(user_id.eq.${currentUser.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUser.id})`
      )
      .single();

    if (existing) {
      if (existing.status === "accepted") alert("你们已经是好友了");
      else if (existing.user_id === currentUser.id) alert("已发送过申请");
      else alert("对方已经向你发送了申请，请去处理");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: currentUser.id,
      friend_id: targetUserId,
      status: "pending",
    });

    if (error) {
      alert("申请发送失败: " + error.message);
    } else {
      localStorage.setItem(
        `last_friend_request_${targetUserId}`,
        Date.now().toString()
      );
      alert("好友申请已发送");
    }
  };

  const handleAccept = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (!error) {
      fetchRequests();
      fetchFriends();
    }
  };

  const handleReject = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (!error) {
      fetchRequests();
    }
  };

  const handleDeleteFriend = (friendshipId: string) => {
    setDeleteTargetId(friendshipId);
    setShowDeleteModal(true);
  };

  const confirmDeleteFriend = async () => {
    if (!deleteTargetId) return;

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", deleteTargetId);

    if (error) {
      alert("删除失败: " + error.message);
    } else {
      setFriends((prev) => prev.filter((f) => f.id !== deleteTargetId));
      setShowDeleteModal(false);
      setDeleteTargetId(null);
    }
  };

  const fetchUserHistory = async (userId: string) => {
    setHistoryLoading(true);
    // 1. Fetch KP History
    const { data: kpData } = await supabase
      .from("game_histories")
      .select("*")
      .eq("kp_id", userId)
      .order("created_at", { ascending: false });

    if (kpData) setKpHistory(kpData);

    // 2. Fetch Player History
    const { data: playerData } = await supabase
      .from("game_history_participants")
      .select(
        `
        *,
        game_history:game_histories (*)
      `
      )
      .eq("user_id", userId)
      .order("id", { ascending: false });

    if (playerData) {
      // Fetch latest character data to ensure avatar/job are up to date
      const charIds = playerData
        .map((p: any) => p.character_snapshot?.id)
        .filter(Boolean);

      let charMap = new Map();
      if (charIds.length > 0) {
        const { data: latestChars } = await supabase
          .from("characters")
          .select("*")
          .in("id", charIds);
        if (latestChars) {
          charMap = new Map(latestChars.map((c) => [c.id, c]));
        }
      }

      const sorted = (playerData as any[])
        .map((p) => ({
          ...p,
          latest_character: charMap.get(p.character_snapshot?.id),
        }))
        .sort((a, b) => {
          return (
            new Date(b.game_history.created_at).getTime() -
            new Date(a.game_history.created_at).getTime()
          );
        });
      setPlayerHistory(sorted);
    }
    setHistoryLoading(false);
  };

  const openResume = (user: Profile) => {
    setSelectedUser(user);
    fetchUserHistory(user.id);
    setShowResumeModal(true);
  };

  const openHistory = (user: Profile) => {
    setSelectedUser(user);
    fetchUserHistory(user.id);
    setShowHistoryModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub Navigation */}
      <div className="flex bg-slate-800/50 p-1 rounded-lg w-full md:w-fit">
        <button
          onClick={() => setActiveTab("list")}
          className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "list"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          好友列表
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all relative ${
            activeTab === "requests"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          好友申请
          {requests.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "list" && (
          <div className="space-y-8">
            {/* Search Section */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="输入 UID 或 昵称 搜索用户..."
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-lg focus:outline-none focus:border-indigo-500 transition-all text-white placeholder-slate-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                className="absolute right-2 top-2 bottom-2"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="animate-spin" /> : "搜索"}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-white font-bold text-lg border-l-4 border-indigo-500 pl-3">
                  搜索结果
                </h3>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl flex items-center gap-6 animate-slide-up"
                  >
                    <div
                      onClick={() => openResume(user)}
                      className="cursor-pointer transition-transform hover:scale-105"
                    >
                      <AvatarUpload
                        url={user.avatar_url}
                        onUpload={() => {}}
                        editable={false}
                        size={80}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-white">
                          {user.nickname}
                        </h3>
                        <span className="text-xs font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-500">
                          UID: {user.user_code}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                        {user.bio || "暂无简介"}
                      </p>
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={History}
                          onClick={() => openHistory(user)}
                        >
                          查看履历
                        </Button>
                        <Button
                          size="sm"
                          icon={UserPlus}
                          onClick={() => sendFriendRequest(user.id)}
                        >
                          申请好友
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !isSearching && (
              <div className="text-center text-slate-500 py-2">
                未找到匹配的用户
              </div>
            )}

            {/* Friends List */}
            <div>
              {searchResults.length > 0 && (
                <h3 className="text-white font-bold text-lg border-l-4 border-emerald-500 pl-3 mb-4">
                  我的好友
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {friends.map((f) => {
                  const profile = f.friend_profile!;
                  return (
                    <div
                      key={f.id}
                      className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl flex items-center gap-4 hover:bg-slate-800/50 transition-all group cursor-pointer"
                      onClick={() => openResume(profile)}
                    >
                      <div>
                        <AvatarUpload
                          url={profile.avatar_url}
                          onUpload={() => {}}
                          editable={false}
                          size={56}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-lg truncate">
                            {profile.nickname || "Unknown"}
                          </h3>
                          {profile.is_vip && (
                            <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 rounded">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          UID: {profile.user_code}
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-1">
                          {profile.bio || "这个人很懒..."}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          icon={History}
                          onClick={(e) => {
                            e.stopPropagation();
                            openHistory(profile);
                          }}
                          title="查看履历"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFriend(f.id);
                          }}
                          title="删除好友"
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {friends.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500">
                    <User size={48} className="mx-auto mb-3 opacity-20" />
                    <p>暂无好友，去搜索添加一些新朋友吧！</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-4 max-w-2xl">
            {requests.map((r) => {
              const profile = r.friend_profile!;
              return (
                <div
                  key={r.id}
                  className="bg-slate-800/30 border border-indigo-500/30 p-4 rounded-xl flex items-center gap-4 animate-scale-in"
                >
                  <AvatarUpload
                    url={profile.avatar_url}
                    onUpload={() => {}}
                    editable={false}
                    size={48}
                  />
                  <div className="flex-1">
                    <div className="font-bold text-white">
                      {profile.nickname}
                    </div>
                    <div className="text-xs text-slate-500">
                      请求添加你为好友
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={UserCheck}
                      onClick={() => handleAccept(r.id)}
                    >
                      接受
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={UserX}
                      onClick={() => handleReject(r.id)}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              );
            })}
            {requests.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p>暂无新的好友申请</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resume Modal */}
      {showResumeModal && selectedUser && (
        <Modal
          onClose={() => setShowResumeModal(false)}
          title={null}
          headerClassName="hidden"
          className="max-w-md overflow-visible !bg-transparent !border-none !shadow-none !p-0"
        >
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-3xl relative overflow-hidden shadow-2xl backdrop-blur-xl">
            {/* VIP Badge */}
            {selectedUser.is_vip && (
              <div className="absolute top-4 left-4 z-10">
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-purple-400/30">
                  VIP
                </span>
              </div>
            )}

            <div className="p-8 pb-0 text-center relative">
              {/* Avatar Section */}
              <div className="mx-auto mb-4 flex justify-center relative">
                <div className="relative">
                  <svg
                    className="absolute -top-1 -left-1 w-[104px] h-[104px] rotate-[-90deg]"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="3"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="3"
                      strokeDasharray="301.59"
                      strokeDashoffset="52.77825"
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    ></circle>
                  </svg>
                  <div
                    className="relative group block"
                    style={{ width: "96px", height: "96px" }}
                  >
                    <div className="rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative w-full h-full">
                      <AvatarUpload
                        url={selectedUser.avatar_url}
                        onUpload={() => {}}
                        editable={false}
                        size={96}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Name & Level */}
              <div className="relative inline-flex items-center gap-2">
                <h2 className="text-2xl font-bold mb-1 transition-colors text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                  {selectedUser.nickname}
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
                  LV.{selectedUser.level || 1}
                </span>
              </div>

              {/* UID */}
              <div className="flex justify-center items-center gap-2 mb-4 mt-2">
                <span className="text-sm text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                  UID: {selectedUser.user_code}
                </span>
              </div>

              {/* Bio */}
              <p className="text-slate-300 mb-6 max-w-md mx-auto italic">
                {selectedUser.bio || "这个人很神秘，什么都没有写..."}
              </p>

              {/* Stats/Tabs Grid */}
              <div className="grid grid-cols-2 gap-4 text-left mt-6 mb-6">
                <div
                  onClick={() => setHistoryTab("player")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all group ${
                    historyTab === "player"
                      ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900/50 border-slate-700/30 hover:bg-slate-800"
                  }`}
                >
                  <div
                    className={`text-xs uppercase font-bold mb-1 transition-colors ${
                      historyTab === "player"
                        ? "text-indigo-400"
                        : "text-slate-500 group-hover:text-indigo-400"
                    }`}
                  >
                    参与的团
                  </div>
                  <div className="text-2xl font-mono font-bold text-indigo-400">
                    {playerHistory.length}
                  </div>
                </div>

                <div
                  onClick={() => setHistoryTab("kp")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all group ${
                    historyTab === "kp"
                      ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900/50 border-slate-700/30 hover:bg-slate-800"
                  }`}
                >
                  <div
                    className={`text-xs uppercase font-bold mb-1 transition-colors ${
                      historyTab === "kp"
                        ? "text-indigo-400"
                        : "text-slate-500 group-hover:text-indigo-400"
                    }`}
                  >
                    主持的团
                  </div>
                  <div className="text-2xl font-mono font-bold text-indigo-400">
                    {kpHistory.length}
                  </div>
                </div>
              </div>
            </div>

            {/* History List */}
            <div
              ref={resumeScrollRef}
              className="bg-slate-950/30 border-t border-white/5 p-4 max-h-[40vh] overflow-y-auto custom-scrollbar overscroll-y-none"
            >
              <div ref={resumeContentRef}>
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-indigo-500" />
                  </div>
                ) : historyTab === "player" ? (
                  <div className="space-y-3">
                    {playerHistory.length === 0 && (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        暂无记录
                      </div>
                    )}
                    {playerHistory.map((item) => {
                      const snapshot = item.character_snapshot;
                      const latest = (item as any).latest_character;
                      const char = latest || snapshot;

                      // Safely extract data from either structure
                      const name = char.name;
                      const avatarUrl =
                        char.info?.avatar_url ||
                        char.avatar_url ||
                        snapshot.info?.avatar_url ||
                        snapshot.avatar_url;
                      const job =
                        char.info?.job ||
                        char.job ||
                        snapshot.info?.job ||
                        snapshot.job ||
                        "无职业";
                      const sex =
                        char.info?.sex ||
                        char.sex ||
                        snapshot.info?.sex ||
                        snapshot.sex ||
                        "未知";

                      const isDead = item.outcome === "死亡";
                      const isLost = item.outcome === "失踪";
                      const isCrazy = item.outcome === "疯狂";

                      return (
                        <div
                          key={item.id}
                          className={`relative p-3 rounded-xl border transition-all ${
                            isDead
                              ? "bg-slate-950 border-slate-800 grayscale"
                              : "bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/30"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-white text-sm line-clamp-1">
                                {item.game_history.room_title}
                              </h4>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <History size={10} />
                                {new Date(
                                  item.game_history.created_at
                                ).toLocaleDateString()}
                                <span className="w-0.5 h-0.5 rounded-full bg-slate-600"></span>
                                KP: {item.game_history.kp_nickname}
                              </div>
                            </div>
                            <div
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isDead
                                  ? "bg-red-950 text-red-500 border border-red-900"
                                  : isLost
                                  ? "bg-yellow-950 text-yellow-500 border border-yellow-900"
                                  : isCrazy
                                  ? "bg-purple-950 text-purple-500 border border-purple-900"
                                  : "bg-emerald-950 text-emerald-500 border border-emerald-900"
                              }`}
                            >
                              {item.outcome}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg">
                            <div className="w-6 h-6 flex items-center justify-center">
                              <AvatarUpload
                                url={avatarUrl}
                                onUpload={() => {}}
                                editable={false}
                                size={24}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-300 truncate">
                                {name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {job} · {sex}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kpHistory.length === 0 && (
                      <div className="text-center py-8 text-slate-500 text-sm">
                        暂无记录
                      </div>
                    )}
                    {kpHistory.map((history) => (
                      <div
                        key={history.id}
                        className="bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl hover:border-indigo-500/30 transition-all"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-white text-sm">
                            {history.room_title}
                          </h4>
                          <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                            {new Date(history.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Crown size={10} className="text-yellow-500" />
                          <span>主持人 (KP)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-white/10 bg-slate-900/50 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setShowResumeModal(false)}
              >
                关闭
              </Button>
              {currentUser && selectedUser.id !== currentUser.id && (
                <>
                  {friends.some(
                    (f) => f.friend_profile?.id === selectedUser.id
                  ) ? (
                    <Button
                      className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
                      icon={UserX}
                      onClick={() => {
                        const friendship = friends.find(
                          (f) => f.friend_profile?.id === selectedUser.id
                        );
                        if (friendship) {
                          handleDeleteFriend(friendship.id);
                          setShowResumeModal(false);
                        }
                      }}
                    >
                      删除好友
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      className="flex-1"
                      icon={UserPlus}
                      onClick={() => {
                        sendFriendRequest(selectedUser.id);
                      }}
                    >
                      添加好友
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
      {/* Game History Modal - Standalone */}
      {showHistoryModal && (
        <Modal
          onClose={() => setShowHistoryModal(false)}
          title="跑团履历"
          icon={History}
          className="max-w-2xl"
        >
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setHistoryTab("player")}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                historyTab === "player"
                  ? "bg-slate-800/50 text-white border-b-2 border-indigo-500"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
              }`}
            >
              参与的团 ({playerHistory.length})
            </button>
            <button
              onClick={() => setHistoryTab("kp")}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                historyTab === "kp"
                  ? "bg-slate-800/50 text-white border-b-2 border-indigo-500"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
              }`}
            >
              主持的团 ({kpHistory.length})
            </button>
          </div>

          <div
            ref={historyScrollRef}
            className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar overscroll-y-none"
          >
            <div ref={historyContentRef}>
              {historyTab === "player" ? (
                <div className="space-y-3">
                  {playerHistory.length === 0 && (
                    <div className="text-center text-slate-500 py-4 text-sm">
                      暂无参与记录
                    </div>
                  )}
                  {playerHistory.map((item) => {
                    const snapshot = item.character_snapshot;
                    const latest = (item as any).latest_character;
                    const char = latest || snapshot;

                    // Safely extract data from either structure
                    const name = char.name;
                    const avatarUrl =
                      char.info?.avatar_url ||
                      char.avatar_url ||
                      snapshot.info?.avatar_url ||
                      snapshot.avatar_url;
                    const job =
                      char.info?.job ||
                      char.job ||
                      snapshot.info?.job ||
                      snapshot.job ||
                      "无职业";
                    const sex =
                      char.info?.sex ||
                      char.sex ||
                      snapshot.info?.sex ||
                      snapshot.sex ||
                      "未知";

                    const isDead = item.outcome === "死亡";
                    const isLost = item.outcome === "失踪";
                    const isCrazy = item.outcome === "疯狂";

                    return (
                      <div
                        key={item.id}
                        className={`relative p-4 rounded-xl border transition-all ${
                          isDead
                            ? "bg-slate-950 border-slate-800 grayscale"
                            : "bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/30"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-white text-base line-clamp-1">
                              {item.game_history.room_title}
                            </h4>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                              <History size={12} />
                              {new Date(
                                item.game_history.created_at
                              ).toLocaleDateString()}
                              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                              KP: {item.game_history.kp_nickname}
                            </div>
                          </div>
                          <div
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                              isDead
                                ? "bg-slate-800 text-slate-400 border-slate-700"
                                : isLost
                                ? "bg-amber-900/20 text-amber-400 border-amber-500/20"
                                : isCrazy
                                ? "bg-purple-900/20 text-purple-400 border-purple-500/20"
                                : "bg-emerald-900/20 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {isDead && <Skull size={10} />}
                            {item.outcome}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-950/30 p-2 rounded-lg border border-white/5">
                          <AvatarUpload
                            url={avatarUrl}
                            onUpload={() => {}}
                            editable={false}
                            size={40}
                          />
                          <div>
                            <div className="font-bold text-sm text-slate-200">
                              {name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {job} · {sex}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {kpHistory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-white text-base">
                          {item.room_title}
                        </h4>
                        <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                          <Crown size={10} />
                          Keeper
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {item.room_description || "暂无描述..."}
                      </p>
                      <div className="text-[10px] text-slate-500 font-mono bg-slate-950/50 px-2 py-1 rounded inline-block">
                        结团于: {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {kpHistory.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      暂无主持记录
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end">
            <Button variant="ghost" onClick={() => setShowHistoryModal(false)}>
              关闭
            </Button>
          </div>
        </Modal>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          onClose={() => setShowDeleteModal(false)}
          title={null}
          className="max-w-sm"
        >
          <div className="flex flex-col items-center p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse-slow">
              <Trash2 className="text-red-500" size={32} />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">删除好友</h3>

            <p className="text-slate-400 mb-8 leading-relaxed">
              确定要删除这位好友吗？
              <br />
              此操作无法撤销，请谨慎操作。
            </p>

            <div className="flex gap-3 w-full">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteModal(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20"
                onClick={confirmDeleteFriend}
              >
                确认删除
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
