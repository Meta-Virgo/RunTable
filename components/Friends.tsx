import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { Profile, Friendship, GameHistory, GameHistoryParticipant, Character } from "../types";
import { Button, Input, Modal, cn } from "./UI";
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  MessageSquare,
  History,
  Skull,
  Crown,
  Loader2,
  User
} from "lucide-react";
import { AvatarUpload } from "./AvatarUpload";

interface FriendsProps {
  currentUser: Profile | null;
}

export const Friends: React.FC<FriendsProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<"list" | "requests" | "add">("list");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Resume Modal State
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [kpHistory, setKpHistory] = useState<GameHistory[]>([]);
  const [playerHistory, setPlayerHistory] = useState<
    (GameHistoryParticipant & { game_history: GameHistory })[]
  >([]);
  const [historyTab, setHistoryTab] = useState<"kp" | "player">("player");
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchFriends();
      fetchRequests();
    }
  }, [currentUser, activeTab]);

  const fetchFriends = async () => {
    if (!currentUser) return;
    setLoading(true);
    
    // Fetch accepted friendships where I am user_id OR friend_id
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        *,
        friend_profile:friend_id (*),
        user_profile:user_id (*)
      `)
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
    setLoading(false);
  };

  const fetchRequests = async () => {
    if (!currentUser) return;
    // Fetch pending requests where I am the RECEIVER (friend_id)
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        *,
        user_profile:user_id (*)
      `)
      .eq("friend_id", currentUser.id)
      .eq("status", "pending");

    if (data) {
      setRequests(data.map((r: any) => ({ ...r, friend_profile: r.user_profile })));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;
    setIsSearching(true);
    setSearchResults([]);

    let query = supabase
      .from("profiles")
      .select("*")
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
    
    // Check if already friends or requested
    const { data: existing } = await supabase
      .from("friendships")
      .select("*")
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUser.id})`)
      .single();

    if (existing) {
      if (existing.status === 'accepted') alert("你们已经是好友了");
      else if (existing.user_id === currentUser.id) alert("已发送过申请");
      else alert("对方已经向你发送了申请，请去处理");
      return;
    }

    const { error } = await supabase
      .from("friendships")
      .insert({
        user_id: currentUser.id,
        friend_id: targetUserId,
        status: "pending",
      });

    if (error) {
      alert("申请发送失败: " + error.message);
    } else {
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
      .select(`
        *,
        game_history:game_histories (*)
      `)
      .eq("user_id", userId)
      .order("id", { ascending: false });

    if (playerData) {
      const sorted = (playerData as any[]).sort((a, b) => {
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
        <button
          onClick={() => setActiveTab("add")}
          className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "add"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          添加好友
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "list" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((f) => {
              const profile = f.friend_profile!;
              return (
                <div key={f.id} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl flex items-center gap-4 hover:bg-slate-800/50 transition-all group">
                   <div onClick={() => openResume(profile)} className="cursor-pointer">
                      <AvatarUpload url={profile.avatar_url} onUpload={()=>{}} editable={false} size={56} />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-lg truncate">{profile.nickname || "Unknown"}</h3>
                          {profile.is_vip && <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 rounded">VIP</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">UID: {profile.user_code}</div>
                      <div className="text-xs text-slate-400 truncate mt-1">{profile.bio || "这个人很懒..."}</div>
                   </div>
                   <Button variant="ghost" size="icon" icon={History} onClick={() => openResume(profile)} title="查看履历" />
                   {/* Chat button could go here later */}
                </div>
              );
            })}
            {friends.length === 0 && (
               <div className="col-span-full text-center py-12 text-slate-500">
                  <User size={48} className="mx-auto mb-3 opacity-20" />
                  <p>暂无好友，去添加一些新朋友吧！</p>
               </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
           <div className="space-y-4 max-w-2xl">
              {requests.map((r) => {
                 const profile = r.friend_profile!;
                 return (
                    <div key={r.id} className="bg-slate-800/30 border border-indigo-500/30 p-4 rounded-xl flex items-center gap-4 animate-scale-in">
                       <AvatarUpload url={profile.avatar_url} onUpload={()=>{}} editable={false} size={48} />
                       <div className="flex-1">
                          <div className="font-bold text-white">{profile.nickname}</div>
                          <div className="text-xs text-slate-500">请求添加你为好友</div>
                       </div>
                       <div className="flex gap-2">
                          <Button size="sm" variant="primary" icon={UserCheck} onClick={() => handleAccept(r.id)}>接受</Button>
                          <Button size="sm" variant="ghost" icon={UserX} onClick={() => handleReject(r.id)}>拒绝</Button>
                       </div>
                    </div>
                 )
              })}
              {requests.length === 0 && (
                 <div className="text-center py-12 text-slate-500">
                    <p>暂无新的好友申请</p>
                 </div>
              )}
           </div>
        )}

        {activeTab === "add" && (
           <div className="max-w-2xl mx-auto space-y-8">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                 <input 
                    type="text" 
                    placeholder="输入 UID 或 昵称 搜索用户..." 
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-12 pr-4 py-4 text-lg focus:outline-none focus:border-indigo-500 transition-all text-white placeholder-slate-600"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                 />
                 <Button 
                    className="absolute right-2 top-2 bottom-2" 
                    onClick={handleSearch}
                    disabled={isSearching}
                 >
                    {isSearching ? <Loader2 className="animate-spin"/> : "搜索"}
                 </Button>
              </div>

              <div className="space-y-4">
                 {searchResults.map(user => (
                    <div key={user.id} className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl flex items-center gap-6 animate-slide-up">
                       <div onClick={() => openResume(user)} className="cursor-pointer transition-transform hover:scale-105">
                          <AvatarUpload url={user.avatar_url} onUpload={()=>{}} editable={false} size={80} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                             <h3 className="text-xl font-bold text-white">{user.nickname}</h3>
                             <span className="text-xs font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-500">UID: {user.user_code}</span>
                          </div>
                          <p className="text-slate-400 text-sm mb-3 line-clamp-2">{user.bio || "暂无简介"}</p>
                          <div className="flex gap-3">
                             <Button size="sm" variant="secondary" icon={History} onClick={() => openResume(user)}>查看履历</Button>
                             {/* Only show Add button if not already friend/requested - logic simplified here, ideally check status */}
                             <Button size="sm" icon={UserPlus} onClick={() => sendFriendRequest(user.id)}>申请好友</Button>
                          </div>
                       </div>
                    </div>
                 ))}
                 {searchResults.length === 0 && searchQuery && !isSearching && (
                    <div className="text-center text-slate-500 py-8">
                       未找到匹配的用户
                    </div>
                 )}
              </div>
           </div>
        )}
      </div>

      {/* Resume Modal */}
      {showResumeModal && selectedUser && (
        <Modal
          onClose={() => setShowResumeModal(false)}
          title={`${selectedUser.nickname} 的履历`}
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

          <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {historyLoading ? (
               <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500"/></div>
            ) : historyTab === "player" ? (
              <div className="space-y-3">
                {playerHistory.map((item) => {
                  const char = item.character_snapshot;
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
                          url={char.avatar_url}
                          onUpload={() => {}}
                          editable={false}
                          size={40}
                        />
                        <div>
                          <div className="font-bold text-sm text-slate-200">
                            {char.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {char.job || "无职业"} · {char.sex}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {playerHistory.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无参与记录
                  </div>
                )}
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
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end">
            <Button variant="ghost" onClick={() => setShowResumeModal(false)}>
              关闭
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
