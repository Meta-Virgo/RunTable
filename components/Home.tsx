import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { Room, Character } from "../types";
import { Button, Input, Textarea, Modal } from "./UI";
import {
  Plus,
  Search,
  User,
  LogOut,
  Loader2,
  Play,
  Users,
  Edit2,
  BookOpen,
} from "lucide-react";
import { CharacterModal } from "./Modals";
import { AvatarUpload } from "./AvatarUpload";

interface HomeProps {
  onJoinRoom: (roomId: string, charId: string | "pc") => void;
  onLogout: () => void;
  onlineUsers: Set<string>;
}

const INITIAL_CHAR_STATE: Character = {
  id: "",
  name: "",
  role: "调查员",
  job: "",
  age: "",
  sex: "",
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 50,
  pow: 50,
  edu: 50,
  luck: 50,
  hp: 10,
  san: 50,
  mp: 10,
  notes: "",
  type: "investigator",
  backstory: "",
  skills: {},
};

interface RoomCardProps {
  room: Room;
  currentUserId: string | null;
  myCharacters: Character[];
  onJoinRoom: (roomId: string, charId: string) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({
  room,
  currentUserId,
  myCharacters,
  onJoinRoom,
}) => {
  const isKP = currentUserId === room.kp_id;
  const [selectedCharId, setSelectedCharId] = useState<string>("");

  useEffect(() => {
    if (isKP) {
      setSelectedCharId("pc");
    } else if (myCharacters.length > 0) {
      setSelectedCharId(myCharacters[0].id);
    }
  }, [isKP, myCharacters]);

  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const onJoinClick = () => {
    if (room.password && !isKP) {
      if (!showPasswordInput) {
        setShowPasswordInput(true);
        return;
      }
      if (passwordInput !== room.password) {
        alert("密码错误");
        return;
      }
    }
    onJoinRoom(room.id, selectedCharId);
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 rounded-xl p-5 transition-all hover:bg-slate-800/50 group flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-lg line-clamp-1">
              {room.title}
            </h3>
          </div>
          {room.password && (
            <div className="mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                🔒 私密
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded border border-white/5">
            #{room.room_number || "???"}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
            Open
          </span>
        </div>
      </div>
      <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-1">
        {room.description || "暂无描述"}
      </p>

      <div className="pt-4 border-t border-white/5 space-y-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500 font-medium">
            选择角色加入:
          </label>
          <select
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-slate-300"
            value={selectedCharId}
            onChange={(e) => setSelectedCharId(e.target.value)}
          >
            {isKP && <option value="pc">我是 KP (主持人)</option>}
            {myCharacters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.job})
              </option>
            ))}
          </select>
        </div>

        {showPasswordInput && (
          <div className="animate-fade-in">
            <Input
              type="password"
              placeholder="输入房间密码..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <Button className="w-full" icon={Play} onClick={onJoinClick}>
          {showPasswordInput
            ? "验证并进入"
            : room.password && !isKP
            ? "输入密码进入"
            : "进入房间"}
        </Button>
      </div>
    </div>
  );
};

export const Home: React.FC<HomeProps> = ({
  onJoinRoom,
  onLogout,
  onlineUsers = new Set(),
}) => {
  const [activeTab, setActiveTab] = useState<
    "rooms" | "characters" | "profile"
  >("rooms");
  const [loading, setLoading] = useState(false);

  // Rooms State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<'all' | 'mine' | 'created' | 'kp_online'>('all');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Characters State
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [showCharModal, setShowCharModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<number | null>(null);
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [userBio, setUserBio] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  // Initial Data Fetch & Realtime
  useEffect(() => {
    fetchRooms();
    fetchMyCharacters();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        // Fetch User Profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_code, nickname, bio, created_at, is_vip, avatar_url")
          .eq("id", user.id)
          .single();
        if (profile) {
          setUserCode(profile.user_code);
          setUserNickname(profile.nickname);
          setUserBio(profile.bio || "");
          setUserAvatar(profile.avatar_url);
          setUserCreatedAt(profile.created_at);
          setIsVip(!!profile.is_vip);
        } else {
          // Auto-create profile if missing (fallback for old users)
          const { data: newProfile } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              nickname: user.email?.split("@")[0] || "User",
            })
            .select()
            .single();
          if (newProfile) {
            setUserCode(newProfile.user_code);
            setUserNickname(newProfile.nickname);
            setUserBio(newProfile.bio || "");
            setUserAvatar(newProfile.avatar_url);
            setUserCreatedAt(newProfile.created_at);
            setIsVip(!!newProfile.is_vip);
          }
        }
      }
    });

    // Realtime Rooms Subscription
    const channel = supabase
      .channel("public:rooms_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Only add if status is open
            const newRoom = payload.new as Room;
            if (newRoom.status === "open") {
              setRooms((prev) => [newRoom, ...prev]);
            }
          } else if (payload.eventType === "DELETE") {
            setRooms((prev) => prev.filter((r) => r.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            const updatedRoom = payload.new as Room;
            if (updatedRoom.status !== "open") {
              // Remove if closed/archived
              setRooms((prev) => prev.filter((r) => r.id !== updatedRoom.id));
            } else {
              // Update or Add
              setRooms((prev) => {
                const exists = prev.find((r) => r.id === updatedRoom.id);
                if (exists)
                  return prev.map((r) =>
                    r.id === updatedRoom.id ? { ...r, ...updatedRoom } : r
                  );
                return [updatedRoom, ...prev];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (user) {
      // Show open rooms OR rooms created by me
      query = query.or(`status.eq.open,kp_id.eq.${user.id}`);
    } else {
      query = query.eq("status", "open");
    }

    const { data, error } = await query;

    if (data) setRooms(data);
    if (error) console.error("Error fetching rooms:", error);
    setLoading(false);
  };

  const fetchMyCharacters = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "investigator");

    if (data) {
      // Map DB fields to Frontend fields
      const mappedChars = data.map((c) => ({
        ...c,
        role: "调查员", // Default role
        avatar_url: c.avatar_url,
        job: c.info?.job || "",
        age: c.info?.age || "",
        sex: c.info?.sex || "",
        notes: c.info?.notes || "",
        backstory: c.info?.backstory || "",
        str: c.stats?.str || 50,
        con: c.stats?.con || 50,
        siz: c.stats?.siz || 50,
        dex: c.stats?.dex || 50,
        app: c.stats?.app || 50,
        int: c.stats?.int || 50,
        pow: c.stats?.pow || 50,
        edu: c.stats?.edu || 50,
        luck: c.stats?.luck || 50,
        hp: c.stats?.hp || 10,
        san: c.stats?.san || 50,
        mp: c.stats?.mp || 10,
        skills: c.info?.skills || c.stats?.skills || {},
      }));
      setMyCharacters(mappedChars);
    }
    if (error) console.error("Error fetching characters:", error);
  };

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        title: newRoomTitle,
        description: newRoomDesc,
        kp_id: user.id,
        status: "open",
        password: newRoomPassword || null,
      })
      .select()
      .single();

    if (data) {
      setNewRoomTitle("");
      setNewRoomDesc("");
      setNewRoomPassword("");
      setShowCreateRoom(false);
      onJoinRoom(data.id, "pc"); // Creator joins as KP (pc)
    }
    setLoading(false);
    if (error) {
      alert("创建房间失败: " + error.message);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom || !editingRoom.title.trim()) return;
    setLoading(true);

    const { error } = await supabase
      .from("rooms")
      .update({
        title: editingRoom.title,
        description: editingRoom.description,
        password: editingRoom.password || null,
      })
      .eq("id", editingRoom.id);

    if (!error) {
      setEditingRoom(null);
    } else {
      alert("更新房间失败: " + error.message);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    if (!currentUserId) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nickname: editNickname, bio: editBio, avatar_url: editAvatar })
      .eq("id", currentUserId);

    if (!error) {
      setUserNickname(editNickname);
      setUserBio(editBio);
      setUserAvatar(editAvatar);
      setIsEditingProfile(false);
    } else {
      alert("更新失败: " + error.message);
    }
    setLoading(false);
  };

  const handleSaveCharacter = async (char: Character) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const dbChar = {
      user_id: user.id,
      name: char.name,
      type: "investigator",
      avatar_url: char.avatar_url,
      info: {
        job: char.job,
        age: char.age,
        sex: char.sex,
        notes: char.notes,
        backstory: char.backstory,
        skills: char.skills || {},
      },
      stats: {
        str: char.str,
        con: char.con,
        siz: char.siz,
        dex: char.dex,
        app: char.app,
        int: char.int,
        pow: char.pow,
        edu: char.edu,
        luck: char.luck,
        hp: char.hp,
        san: char.san,
        mp: char.mp,
        skills: char.skills || {}, // Backup in stats as well
      },
    };

    if (editingChar) {
      const { error } = await supabase
        .from("characters")
        .update(dbChar)
        .eq("id", char.id);
      if (!error) {
        setMyCharacters((prev) =>
          prev.map((c) => (c.id === char.id ? char : c))
        );
        setShowCharModal(false);
      } else {
        alert("更新失败: " + error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("characters")
        .insert(dbChar)
        .select()
        .single();
      if (data) {
        setMyCharacters((prev) => [...prev, { ...char, id: data.id }]);
        setShowCharModal(false);
      } else if (error) {
        alert("创建失败: " + error.message);
      }
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const { error } = await supabase.from("characters").delete().eq("id", id);
    if (!error) {
      setMyCharacters((prev) => prev.filter((c) => c.id !== id));
      setShowCharModal(false);
    } else {
      alert("删除失败: " + error.message);
    }
  };

  const myRoomIds = new Set(myCharacters.map((c) => c.room_id).filter(Boolean));

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.title.includes(searchQuery) ||
      (r.description && r.description.includes(searchQuery));

    if (!matchesSearch) return false;

    if (roomFilter === "mine") {
      return myRoomIds.has(r.id);
    }
    if (roomFilter === "created") {
      return r.kp_id === currentUserId;
    }
    if (roomFilter === "kp_online") {
      return onlineUsers.has(r.kp_id);
    }

    return true;
  });

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#020617] text-slate-200 flex flex-col font-sans">
      {/* Header */}
      <header className="min-h-[4rem] h-auto pt-safe border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white tracking-tight">
            RunTable Pro
          </h1>
          <nav className="hidden md:flex bg-slate-800/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("rooms")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "rooms"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              大厅
            </button>
            <button
              onClick={() => setActiveTab("characters")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "characters"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              车卡
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              我的
            </button>
          </nav>
        </div>
        <Button variant="ghost" icon={LogOut} onClick={onLogout}>
          退出
        </Button>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-6xl overflow-y-auto custom-scrollbar">
        {/* Mobile Nav */}
        <div className="md:hidden flex bg-slate-800/50 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab("rooms")}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${
              activeTab === "rooms"
                ? "bg-indigo-600 text-white"
                : "text-slate-400"
            }`}
          >
            大厅
          </button>
          <button
            onClick={() => setActiveTab("characters")}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${
              activeTab === "characters"
                ? "bg-indigo-600 text-white"
                : "text-slate-400"
            }`}
          >
            车卡
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-2 rounded-md text-sm font-medium ${
              activeTab === "profile"
                ? "bg-indigo-600 text-white"
                : "text-slate-400"
            }`}
          >
            我的
          </button>
        </div>

        {activeTab === "rooms" ? (
          <div className="space-y-6">
            {/* Room Controls */}
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button icon={Plus} onClick={() => setShowCreateRoom(true)}>
                  创建房间
                </Button>
              </div>

              {/* Filters */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {[
                  { id: "all", label: "全部" },
                  { id: "mine", label: "我的角色" },
                  { id: "created", label: "我的房间" },
                  { id: "kp_online", label: "KP在线" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setRoomFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      roomFilter === f.id
                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                        : "bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-800 hover:text-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Create Room Form (Inline) */}
            {showCreateRoom && (
              <div className="bg-slate-800/30 border border-indigo-500/30 rounded-2xl p-6 animate-scale-in">
                <h3 className="text-lg font-bold text-white mb-4">
                  新建跑团房间
                </h3>
                <div className="space-y-4">
                  <Input
                    label="房间标题"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="例如：印斯茅斯之影"
                  />
                  <Input
                    label="房间密码 (可选)"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    placeholder="留空则为公开房间"
                    type="password"
                  />
                  <Textarea
                    label="简介 (可选)"
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    placeholder="简单的模组介绍或招募要求..."
                  />
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <Button
                      variant="ghost"
                      onClick={() => setShowCreateRoom(false)}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleCreateRoom}
                      disabled={!newRoomTitle.trim() || loading}
                      icon={loading ? Loader2 : Plus}
                    >
                      {loading ? "创建中..." : "立即创建"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Rooms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <p>暂无公开房间，快来创建一个吧！</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "characters" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">车卡列表</h2>
              <Button
                icon={Plus}
                onClick={() => {
                  setEditingChar(null);
                  setShowCharModal(true);
                }}
              >
                新建角色
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCharacters.map((char) => (
                <div
                  key={char.id}
                  className="bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 rounded-xl p-5 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50"></div>
                  <div className="flex gap-4 mb-3 pl-3">
                    <div className="flex-shrink-0">
                      <AvatarUpload
                        url={char.avatar_url}
                        onUpload={() => {}}
                        editable={false}
                        size={64}
                      />
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-white text-lg">
                            {char.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            {char.sex} · {char.age}岁
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-mono font-bold text-indigo-400">
                            {char.hp}
                            <span className="text-xs text-slate-500 ml-1">
                              HP
                            </span>
                          </div>
                          <div className="text-sm font-mono text-slate-500">
                            {char.san} SAN
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 pl-3">
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {char.backstory || "暂无背景故事..."}
                    </p>
                  </div>

                  <div className="pl-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setEditingChar(char);
                        setShowCharModal(true);
                      }}
                    >
                      编辑档案
                    </Button>
                  </div>
                </div>
              ))}
              {myCharacters.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                  <User size={48} className="mx-auto mb-3 opacity-20" />
                  <p>还没有创建角色，点击右上角新建</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

              {!isEditingProfile ? (
                <>
                  <div className="absolute top-4 right-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit2}
                      onClick={() => {
                        setEditNickname(userNickname || "");
                        setEditBio(
                          userBio && userBio !== "NaN" && userBio !== "null"
                            ? userBio
                            : ""
                        );
                        setIsEditingProfile(true);
                      }}
                    >
                      编辑
                    </Button>
                  </div>
                  {isVip && (
                    <div className="absolute top-4 left-4">
                      <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-purple-400/30">
                        VIP
                      </span>
                    </div>
                  )}
                  <div className="mx-auto mb-4 flex justify-center">
                    <AvatarUpload
                      url={userAvatar}
                      onUpload={() => {}}
                      editable={false}
                      size={96}
                    />
                  </div>
                  <div className="relative inline-block">
                    <h2
                      className={`text-2xl font-bold mb-1 transition-colors ${
                        isVip
                          ? "text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          : "text-white"
                      }`}
                    >
                      {userNickname || "未命名用户"}
                    </h2>
                  </div>
                  <div className="flex justify-center items-center gap-2 mb-4">
                    <span className="text-sm text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                      UID: {userCode || "---"}
                    </span>
                  </div>
                  <p className="text-slate-300 mb-6 max-w-md mx-auto italic">
                    {userBio && userBio !== "NaN" && userBio !== "null"
                      ? `"${userBio}"`
                      : "这个人很神秘，什么都没有写..."}
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-left mt-6">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30">
                      <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                        我的车卡
                      </div>
                      <div className="text-2xl font-mono font-bold text-indigo-400">
                        {myCharacters.length}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30">
                      <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                        注册时间
                      </div>
                      <div className="text-sm text-slate-300">
                        {userCreatedAt
                          ? new Date(userCreatedAt).toLocaleDateString()
                          : "---"}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="max-w-md mx-auto space-y-4 text-left">
                  <h3 className="text-lg font-bold text-white mb-4 text-center">
                    编辑个人资料
                  </h3>
                  <div className="flex justify-center mb-4">
                    <AvatarUpload
                      url={editAvatar || userAvatar}
                      onUpload={(url) => setEditAvatar(url)}
                      editable={true}
                      size={96}
                    />
                  </div>
                  <Input
                    label="昵称"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                  />
                  <Textarea
                    label="个人简介"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                  />
                  <div className="flex justify-center gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      取消
                    </Button>
                    <Button onClick={handleUpdateProfile} disabled={loading}>
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        "保存更改"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Room Modal */}
      {editingRoom && (
        <Modal
          onClose={() => setEditingRoom(null)}
          title="编辑模组/房间"
          icon={BookOpen}
          className="max-w-xl"
        >
          <div className="p-6 space-y-4">
            <Input
              label="房间标题"
              value={editingRoom.title}
              onChange={(e) =>
                setEditingRoom({ ...editingRoom, title: e.target.value })
              }
            />
            <Input
              label="房间密码 (留空公开)"
              value={editingRoom.password || ""}
              onChange={(e) =>
                setEditingRoom({ ...editingRoom, password: e.target.value })
              }
              type="password"
              placeholder="留空则为公开房间"
            />
            <Textarea
              label="简介"
              value={editingRoom.description || ""}
              onChange={(e) =>
                setEditingRoom({ ...editingRoom, description: e.target.value })
              }
              rows={5}
            />
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditingRoom(null)}>
              取消
            </Button>
            <Button
              onClick={handleUpdateRoom}
              disabled={!editingRoom.title.trim() || loading}
              icon={loading ? Loader2 : Edit2}
            >
              {loading ? "保存中..." : "保存修改"}
            </Button>
          </div>
        </Modal>
      )}

      {showCharModal && (
        <CharacterModal
          initialData={editingChar || INITIAL_CHAR_STATE}
          isEditing={!!editingChar}
          onSave={handleSaveCharacter}
          onDelete={
            editingChar
              ? () => handleDeleteCharacter(editingChar.id)
              : undefined
          }
          onClose={() => setShowCharModal(false)}
        />
      )}
    </div>
  );
};
