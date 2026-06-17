import React, { useState, useEffect } from "react";
import { Profile, Friendship, GameHistory } from "../types";
import { Button, Modal } from "./UI";
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  History,
  MessageCircle,
  Crown,
  User,
  Trash2,
} from "lucide-react";
import { AvatarUpload } from "./AvatarUpload";
import { HomeHistoryModal } from "./home/HomeHistoryModal";
import { FriendRequestButton } from "./profile/FriendRequestButton";
import {
  FriendCardSkeleton,
  HistorySkeletonList,
} from "./Skeleton";
import { themeRgb } from "../utils/theme";
import {
  fetchHomeProfileHistory,
  getHomeHistoryCharacterDisplay,
  type HomePlayerHistoryItem,
} from "../services/homeProfileModel";
import {
  fetchFriendsOverview,
  requestFriendship,
  searchFriendProfiles,
} from "../services/friendsModel";
import * as friendsProfileRepository from "../services/friendsProfileRepository";
import * as friendsRepository from "../services/friendsRepository";

interface FriendsProps {
  currentUser: Profile | null;
  onOpenDirectMessage?: (profile: Profile) => void;
}

export const Friends: React.FC<FriendsProps> = ({
  currentUser,
  onOpenDirectMessage,
}) => {
  const [activeTab, setActiveTab] = useState<"list" | "requests">("list");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

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
    HomePlayerHistoryItem[]
  >([]);
  const [historyTab, setHistoryTab] = useState<"kp" | "player">("player");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchFriendsOverviewForUser();
  }, [currentUser, activeTab]);

  const fetchFriendsOverviewForUser = async () => {
    if (!currentUser) {
      setFriends([]);
      setRequests([]);
      setIsLoadingOverview(false);
      return;
    }

    setIsLoadingOverview(true);
    try {
      const overview = await fetchFriendsOverview({
        currentUserId: currentUser.id,
        repository: friendsRepository,
      });
      setFriends(overview.friends);
      setRequests(overview.requests);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await searchFriendProfiles({
        currentUserId: currentUser.id,
        query: searchQuery,
        repository: friendsRepository,
      });
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!currentUser) return;

    const result = await requestFriendship({
      currentUserId: currentUser.id,
      targetUserId,
      repository: friendsRepository,
      storage: localStorage,
    });
    alert(result.message);
    if (result.status === "sent") {
      void fetchFriendsOverviewForUser();
    }
  };

  const handleAccept = async (friendshipId: string) => {
    const { error } = await friendsRepository.acceptFriendRequest(friendshipId);

    if (!error) {
      fetchFriendsOverviewForUser();
    }
  };

  const handleReject = async (friendshipId: string) => {
    const { error } = await friendsRepository.rejectFriendRequest(friendshipId);

    if (!error) {
      fetchFriendsOverviewForUser();
    }
  };

  const handleDeleteFriend = (friendshipId: string) => {
    setDeleteTargetId(friendshipId);
    setShowDeleteModal(true);
  };

  const confirmDeleteFriend = async () => {
    if (!deleteTargetId) return;

    const { error } = await friendsRepository.deleteFriendship(deleteTargetId);

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
    try {
      const history = await fetchHomeProfileHistory({
        userId,
        repository: friendsProfileRepository,
      });
      setKpHistory(history.kpHistory);
      setPlayerHistory(history.playerHistory);
    } finally {
      setHistoryLoading(false);
    }
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

  const selectedUserIsFriend = Boolean(
    selectedUser &&
      friends.some(
        (friendship) => friendship.friend_profile?.id === selectedUser.id
      )
  );
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub Navigation */}
      <div className="flex bg-dicecho-card/70 border border-dicecho-border/40 p-1 rounded-lg w-full md:w-fit">
        <button
          onClick={() => setActiveTab("list")}
          className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "list"
              ? "bg-dicecho-primary-strong text-white shadow-sm"
              : "text-dicecho-muted hover:text-white"
          }`}
        >
          好友列表
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all relative ${
            activeTab === "requests"
              ? "bg-dicecho-primary-strong text-white shadow-sm"
              : "text-dicecho-muted hover:text-white"
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
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dicecho-muted" />
              <input
                type="text"
                placeholder="输入 UID 或 昵称 搜索用户..."
                className="w-full bg-dicecho-card/70 border border-dicecho-border/50 rounded-lg pl-12 pr-4 py-4 text-lg focus:outline-none focus:border-dicecho-primary/70 transition-colors duration-150 text-white placeholder-dicecho-muted/60"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                className="absolute right-2 top-2 bottom-2"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? "搜索中" : "搜索"}
              </Button>
            </div>

            {/* Search Results */}
            {isSearching ? (
              <div className="space-y-4">
                <h3 className="text-white font-bold text-lg border-l-4 border-dicecho-primary pl-3">
                  搜索结果
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index}>
                      <FriendCardSkeleton />
                    </div>
                  ))}
                </div>
              </div>
            ) : searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-white font-bold text-lg border-l-4 border-dicecho-primary pl-3">
                  搜索结果
                </h3>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="bg-dicecho-card/70 border border-dicecho-border/45 p-6 rounded-lg flex items-center gap-6 shadow-sm"
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
                        <span className="text-xs font-mono bg-dicecho-panel/70 px-2 py-0.5 rounded text-dicecho-muted">
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
                {isLoadingOverview ? (
                  Array.from({ length: 1 }).map((_, index) => (
                    <div key={index}>
                      <FriendCardSkeleton />
                    </div>
                  ))
                ) : (
                  friends.map((f) => {
                    const profile = f.friend_profile!;
                    return (
                      <div
                        key={f.id}
                        className="bg-dicecho-card/70 border border-dicecho-border/45 p-4 rounded-lg flex items-center gap-4 hover:bg-dicecho-raised/70 transition-colors group cursor-pointer shadow-sm"
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
                              <span className="text-[10px] bg-dicecho-primary/20 text-dicecho-primary border border-dicecho-primary/30 px-1 rounded">
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
                            icon={MessageCircle}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDirectMessage?.(profile);
                            }}
                            title="发送私信"
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
                  })
                )}
                {!isLoadingOverview && friends.length === 0 && (
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
            {isLoadingOverview ? (
              <HistorySkeletonList count={3} />
            ) : (
              requests.map((r) => {
                const profile = r.friend_profile!;
                return (
                  <div
                    key={r.id}
                    className="bg-dicecho-card/70 border border-dicecho-primary/30 p-4 rounded-lg flex items-center gap-4 shadow-sm"
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
              })
            )}
            {!isLoadingOverview && requests.length === 0 && (
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
          <div className="bg-dicecho-card/95 border border-dicecho-border/50 rounded-lg relative overflow-hidden shadow-lg shadow-black/25 backdrop-blur-xl">
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
                      stroke={themeRgb("panel")}
                      strokeWidth="3"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke={themeRgb("primary")}
                      strokeWidth="3"
                      strokeDasharray="301.59"
                      strokeDashoffset="52.77825"
                      strokeLinecap="round"
                      className="transition-[stroke-dashoffset] duration-300 ease-out"
                    ></circle>
                  </svg>
                  <div
                    className="relative group block"
                    style={{ width: "96px", height: "96px" }}
                  >
                    <div className="rounded-full overflow-hidden bg-dicecho-panel border-2 border-dicecho-primary/50 flex items-center justify-center relative w-full h-full">
                      <AvatarUpload
                        url={selectedUser.avatar_url}
                        onUpload={() => {}}
                        editable={false}
                        size={96}
                      />
                    </div>
                    {currentUser?.id && selectedUser.id !== currentUser.id && (
                      <FriendRequestButton
                        compact
                        currentUserId={currentUser.id}
                        profile={selectedUser}
                        isFriend={selectedUserIsFriend}
                        className="absolute bottom-1 right-1"
                        onRequestFriend={(profile) =>
                          sendFriendRequest(profile.id)
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Name & Level */}
              <div className="relative inline-flex items-center gap-2">
                <h2 className="text-2xl font-bold mb-1 transition-colors text-dicecho-primary">
                  {selectedUser.nickname}
                </h2>
                <span className="bg-dicecho-primary/20 text-dicecho-primary text-[10px] font-bold px-1.5 py-0.5 rounded border border-dicecho-primary/30">
                  LV.{selectedUser.level || 1}
                </span>
              </div>

              {/* UID */}
              <div className="flex justify-center items-center gap-2 mb-4 mt-2">
                <span className="text-sm text-dicecho-muted font-mono bg-dicecho-panel/70 px-2 py-1 rounded">
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
                  className={`p-4 rounded-lg border cursor-pointer transition-colors duration-150 group ${
                    historyTab === "player"
                      ? "bg-dicecho-primary/15 border-dicecho-primary/50"
                      : "bg-dicecho-card/70 border-dicecho-border/30 hover:bg-white/10"
                  }`}
                >
                  <div
                    className={`text-xs uppercase font-bold mb-1 transition-colors ${
                      historyTab === "player"
                        ? "text-dicecho-primary"
                        : "text-dicecho-muted group-hover:text-slate-200"
                    }`}
                  >
                    参与的团
                  </div>
                  <div className="text-2xl font-mono font-bold text-dicecho-primary">
                    {playerHistory.length}
                  </div>
                </div>

                <div
                  onClick={() => setHistoryTab("kp")}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors duration-150 group ${
                    historyTab === "kp"
                      ? "bg-dicecho-primary/15 border-dicecho-primary/50"
                      : "bg-dicecho-card/70 border-dicecho-border/30 hover:bg-white/10"
                  }`}
                >
                  <div
                    className={`text-xs uppercase font-bold mb-1 transition-colors ${
                      historyTab === "kp"
                        ? "text-dicecho-primary"
                        : "text-dicecho-muted group-hover:text-slate-200"
                    }`}
                  >
                    主持的团
                  </div>
                  <div className="text-2xl font-mono font-bold text-dicecho-primary">
                    {kpHistory.length}
                  </div>
                </div>
              </div>
            </div>

            {/* History List */}
            <div
              className="bg-dicecho-panel/70 border-t border-dicecho-border/40 p-4 max-h-[40vh] overflow-y-auto custom-scrollbar overscroll-contain"
            >
              <div>
                {historyLoading ? (
                  <HistorySkeletonList count={3} />
                ) : historyTab === "player" ? (
                  <div className="space-y-3">
                    {playerHistory.length === 0 && (
                      <div className="text-center py-8 text-dicecho-muted text-sm">
                        暂无记录
                      </div>
                    )}
                    {playerHistory.map((item) => {
                      const characterDisplay =
                        getHomeHistoryCharacterDisplay(item);

                      return (
                        <div
                          key={item.id}
                          className={`relative p-3 rounded-lg border transition-colors duration-150 ${
                            characterDisplay.isDead
                              ? "bg-dicecho-panel/50 border-dicecho-border/30 grayscale"
                              : "bg-dicecho-card/70 border-dicecho-border/40 hover:border-dicecho-primary/40"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-white text-sm line-clamp-1">
                                {item.game_history.room_title}
                              </h4>
                              <div className="text-[10px] text-dicecho-muted flex items-center gap-1 mt-0.5">
                                <History size={10} />
                                {new Date(
                                  item.game_history.created_at
                                ).toLocaleDateString()}
                                <span className="w-0.5 h-0.5 rounded-full bg-dicecho-muted"></span>
                                KP: {item.game_history.kp_nickname}
                              </div>
                            </div>
                            <div
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                characterDisplay.isDead
                                  ? "bg-red-950 text-red-500 border border-red-900"
                                  : characterDisplay.isLost
                                  ? "bg-yellow-950 text-yellow-500 border border-yellow-900"
                                  : characterDisplay.isCrazy
                                  ? "bg-dicecho-primary/15 text-dicecho-primary border border-dicecho-primary/30"
                                  : "bg-emerald-950 text-emerald-500 border border-emerald-900"
                              }`}
                            >
                              {item.outcome}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-dicecho-panel/70 p-1.5 rounded-lg border border-dicecho-border/30">
                            <div className="w-6 h-6 flex items-center justify-center">
                              <AvatarUpload
                                url={characterDisplay.avatarUrl}
                                onUpload={() => {}}
                                editable={false}
                                size={24}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-300 truncate">
                                {characterDisplay.name}
                              </div>
                              <div className="text-[10px] text-dicecho-muted">
                                {characterDisplay.job} · {characterDisplay.sex}
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
                      <div className="text-center py-8 text-dicecho-muted text-sm">
                        暂无记录
                      </div>
                    )}
                    {kpHistory.map((history) => (
                      <div
                        key={history.id}
                        className="bg-dicecho-card/70 border border-dicecho-border/40 p-3 rounded-lg hover:border-dicecho-primary/40 transition-colors duration-150"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-white text-sm">
                            {history.room_title}
                          </h4>
                          <span className="text-[10px] text-dicecho-muted bg-dicecho-panel/70 px-1.5 py-0.5 rounded">
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

          </div>
        </Modal>
      )}
      <HomeHistoryModal
        open={showHistoryModal}
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
        kpHistory={kpHistory}
        playerHistory={playerHistory}
        onClose={() => setShowHistoryModal(false)}
      />
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
