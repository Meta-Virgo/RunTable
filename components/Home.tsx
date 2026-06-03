import React, { Suspense, useState, useEffect } from "react";
import { supabase } from "../supabase";
import { Room, Character, GameHistory, GameHistoryParticipant } from "../types";
import { Button, Input, Textarea, Modal, cn } from "./UI";
import {
  Plus,
  Search,
  User,
  LogOut,
  Loader2,
  Users,
  Edit2,
  BookOpen,
  Lock,
  History,
  Crown,
  Skull,
  ArrowUp,
  Mic,
  MessageSquare,
} from "lucide-react";
import { CharacterModal } from "./Modals";
import { AvatarUpload } from "./AvatarUpload";
import { Friends } from "./Friends";
import { RoomCard } from "./RoomCard";
import { useElasticScroll } from "../hooks/useElasticScroll";
import {
  createRoom,
  fetchRoomActivityCounts,
  fetchVisibleRooms,
  setRoomPassword,
  updateRoomDetails,
} from "../services/rooms";
import { getCurrentUser, updatePassword } from "../services/auth";
import {
  createCharacter,
  deleteCharacter,
  fetchUserInvestigators,
  updateCharacter,
} from "../services/characters";
import {
  createProfileForUser,
  fetchProfileDetails,
  updateProfile,
} from "../services/profiles";
import { mapCharacterRow } from "../utils/characterMapper";
import { buildCharacterMutationPayload } from "../utils/characterPayload";

const Square = React.lazy(() =>
  import("./Square").then((module) => ({ default: module.Square }))
);

interface HomeProps {
  onJoinRoom: (
    roomId: string,
    charId: string | "pc",
    password?: string | null
  ) => void;
  onLogout: () => void;
  onlineUsers: Set<string>;
  levelInfo?: {
    level: number;
    experience: number;
    nextLevelExp: number;
    claimReward: (type: "login" | "30m" | "60m" | "120m") => Promise<any>;
    dailyActivity: any;
  };
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
  items: [],
  spells: [],
};

export const Home: React.FC<HomeProps> = ({
  onJoinRoom,
  onLogout,
  onlineUsers = new Set(),
  levelInfo,
}) => {
  const [activeTab, setActiveTab] = useState<
    "rooms" | "characters" | "friends" | "profile" | "square"
  >("rooms");
  const [loading, setLoading] = useState(false);

  // Rooms State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<
    "all" | "mine" | "created" | "kp_online"
  >("all");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [newRoomType, setNewRoomType] = useState<"text" | "voice">("text");

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Characters State
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [showCharModal, setShowCharModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<number | null>(null);
  const [_userEmail, setUserEmail] = useState<string>("");
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

  // Change Password State
  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Game History State
  const [kpHistory, setKpHistory] = useState<GameHistory[]>([]);
  const [playerHistory, setPlayerHistory] = useState<
    (GameHistoryParticipant & { game_history: GameHistory })[]
  >([]);
  const [historyTab, setHistoryTab] = useState<"kp" | "player">("player");
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Friend Requests Count
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [showHeader, setShowHeader] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const mainContentRef = React.useRef<HTMLDivElement>(null);

  useElasticScroll(mainRef, mainContentRef, {
    disabled: activeTab === "square",
  });

  const lastScrollTop = React.useRef(0);

  // Reset header visibility when switching tabs
  useEffect(() => {
    setShowHeader(true);
    setShowBackToTop(false);
  }, [activeTab]);

  // Handle scroll for non-square tabs
  useEffect(() => {
    const handleScroll = () => {
      if (activeTab === "square") return;

      if (mainRef.current) {
        const scrollTop = mainRef.current.scrollTop;
        setShowBackToTop(scrollTop > 300);

        const diff = scrollTop - lastScrollTop.current;
        const isScrollingDown = diff > 0;
        const threshold = isScrollingDown ? 10 : 800; // 向下敏感(10)，向上极大阈值(800)防止误触

        if (Math.abs(diff) > threshold) {
          if (isScrollingDown && scrollTop > 50) {
            setShowHeader(false);
          } else if (!isScrollingDown || scrollTop < 20) {
            // 向上滚动超过阈值 或 在顶部区域 -> 显示
            setShowHeader(true);
          }
          lastScrollTop.current = scrollTop;
        } else if (scrollTop < 20) {
          // 强制处理回到顶部的情况，防止累积距离不够导致不显示
          setShowHeader(true);
          lastScrollTop.current = scrollTop;
        }
      }
    };

    const container = mainRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [activeTab]);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Initial Data Fetch & Realtime
  useEffect(() => {
    fetchRooms();
    fetchMyCharacters();
    getCurrentUser().then(async ({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        setUserEmail(user.email || "");
        const { data: profile } = await fetchProfileDetails(user.id);
        if (profile) {
          setUserCode(profile.user_code);
          setUserNickname(profile.nickname);
          setUserBio(profile.bio || "");
          setUserAvatar(profile.avatar_url);
          setUserCreatedAt(profile.created_at);
          setIsVip(!!profile.is_vip);

          // Fetch History
          fetchGameHistory(user.id);
          fetchFriendRequestCount(user.id);
        } else {
          // Auto-create profile if missing (fallback for old users)
          const { data: newProfile } = await createProfileForUser(
            user.id,
            user.email
          );
          if (newProfile) {
            setUserCode(newProfile.user_code);
            setUserNickname(newProfile.nickname);
            setUserBio(newProfile.bio || "");
            setUserAvatar(newProfile.avatar_url);
            setUserCreatedAt(newProfile.created_at);
            setIsVip(!!newProfile.is_vip);

            // Fetch History
            fetchGameHistory(user.id);
            fetchFriendRequestCount(user.id);
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

  // Friend Request Realtime Subscription
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("friendships_monitor")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `friend_id=eq.${currentUserId}`,
        },
        () => {
          fetchFriendRequestCount(currentUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchFriendRequestCount = async (userId: string) => {
    // Remove head: true to avoid ERR_ABORTED on some clients/proxies
    const { count, error } = await supabase
      .from("friendships")
      .select("id", { count: "exact" })
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (!error && count !== null) {
      setFriendRequestCount(count);
    }
  };

  const fetchGameHistory = async (userId: string) => {
    // 1. Fetch KP History
    const { data: kpData } = await supabase
      .from("game_histories")
      .select("*")
      .eq("kp_id", userId)
      .order("created_at", { ascending: false });

    if (kpData) {
      setKpHistory(kpData);
    }

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
      .order("id", { ascending: false }); // ideally order by game_history.created_at but simple ID sort works for now

    if (playerData) {
      // Fetch latest character data
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
  };

  const fetchRooms = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await getCurrentUser();

    const { data, error } = await fetchVisibleRooms(user?.id);

    if (data) {
      const activityCounts = await fetchRoomActivityCounts(
        data.map((room) => room.id)
      );
      const now = new Date().getTime();
      const processed = data.map((r: any) => {
        const activity = activityCounts.get(r.id);
        const charCount =
          activity?.character_count ?? r.characters?.[0]?.count ?? 2;
        const msgCount = activity?.message_count ?? r.messages?.[0]?.count ?? 5;
        const createdAt = new Date(r.created_at).getTime();
        const lastActive = r.last_active_at
          ? new Date(r.last_active_at).getTime()
          : createdAt;

        // Zombie Logic: Created > 24h ago, <= 1 person, < 5 messages
        const isZombie =
          now - createdAt > 24 * 60 * 60 * 1000 &&
          charCount <= 1 &&
          msgCount < 5;

        // Archived Logic: > 7 days no activity
        const isArchived = now - lastActive > 7 * 24 * 60 * 60 * 1000;

        return {
          ...r,
          isZombie,
          isArchived,
          last_active_at: r.last_active_at || r.created_at,
        };
      });

      // Sort: Non-Zombie first, then by Activity
      processed.sort((a: any, b: any) => {
        if (a.isZombie !== b.isZombie) return a.isZombie ? 1 : -1;
        return (
          new Date(b.last_active_at).getTime() -
          new Date(a.last_active_at).getTime()
        );
      });

      setRooms(processed);
    }
    if (error) console.error("Error fetching rooms:", error);
    setLoading(false);
  };

  const fetchMyCharacters = async () => {
    const {
      data: { user },
    } = await getCurrentUser();
    if (!user) return;

    const { data, error } = await fetchUserInvestigators(user.id);

    if (data) {
      const mappedChars = data.map(mapCharacterRow);
      setMyCharacters(mappedChars);
    }
    if (error) console.error("Error fetching characters:", error);
  };

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await getCurrentUser();
    if (!user) return;

    const { data, error } = await createRoom({
      title: newRoomTitle,
      description: newRoomDesc,
      kpId: user.id,
      hasPassword: !!newRoomPassword,
      type: newRoomType,
    });

    if (data) {
      if (newRoomPassword) {
        try {
          await setRoomPassword(data.id, newRoomPassword);
        } catch (passwordError: any) {
          alert("房间已创建，但密码保存失败: " + passwordError.message);
          setLoading(false);
          return;
        }
      }
      setNewRoomTitle("");
      setNewRoomDesc("");
      setNewRoomPassword("");
      setNewRoomType("text");
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

    const { error } = await updateRoomDetails(editingRoom.id, {
      title: editingRoom.title,
      description: editingRoom.description,
    });

    if (!error) {
      if (editingRoom.password !== undefined) {
        try {
          await setRoomPassword(editingRoom.id, editingRoom.password || "");
        } catch (passwordError: any) {
          alert("房间已更新，但密码保存失败: " + passwordError.message);
          setLoading(false);
          return;
        }
      }
      setEditingRoom(null);
    } else {
      alert("更新房间失败: " + error.message);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    if (!currentUserId) return;
    setLoading(true);
    const { error } = await updateProfile(currentUserId, {
      nickname: editNickname,
      bio: editBio,
      avatar_url: editAvatar,
    });

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

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      alert("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(newPassword);

    if (!error) {
      alert("密码修改成功");
      setShowChangePwdModal(false);
      setNewPassword("");
      setConfirmNewPassword("");
    } else {
      alert("修改失败: " + error.message);
    }
    setLoading(false);
  };

  const handleSaveCharacter = async (char: Character) => {
    const {
      data: { user },
    } = await getCurrentUser();
    if (!user) return;

    const dbChar = buildCharacterMutationPayload(char, {
      userId: user.id,
      typeFallback: "investigator",
    });

    if (editingChar) {
      const { error } = await updateCharacter(char.id, dbChar);
      if (!error) {
        setMyCharacters((prev) =>
          prev.map((c) => (c.id === char.id ? char : c))
        );
        setShowCharModal(false);
      } else {
        alert("更新失败: " + error.message);
      }
    } else {
      const { data, error } = await createCharacter(dbChar);
      if (data) {
        setMyCharacters((prev) => [...prev, { ...char, id: data.id }]);
        setShowCharModal(false);
      } else if (error) {
        alert("创建失败: " + error.message);
      }
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const { error } = await deleteCharacter(id);
    if (!error) {
      setMyCharacters((prev) => prev.filter((c) => c.id !== id));
      setShowCharModal(false);
    } else {
      alert("删除失败: " + error.message);
    }
  };

  const myRoomIds = new Set(myCharacters.map((c) => c.room_id).filter(Boolean));

  const filteredRooms = rooms.filter((r: any) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      r.title.toLowerCase().includes(query) ||
      (r.description && r.description.toLowerCase().includes(query)) ||
      (r.room_number && String(r.room_number).includes(query)) ||
      (r.room_number && `#${r.room_number}`.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (roomFilter === "all") {
      // Default Lobby: Hide Archived
      if (r.isArchived) return false;
      return true;
    }

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
      <header
        className={`min-h-[4rem] h-auto pt-safe border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20 transition-all duration-300 ease-in-out ${
          showHeader
            ? "translate-y-0"
            : "-translate-y-full -mb-[4.1rem] opacity-0 pointer-events-none"
        }`}
      >
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
              onClick={() => setActiveTab("square")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "square"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              广场
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
              onClick={() => setActiveTab("friends")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all relative ${
                activeTab === "friends"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              好友
              {friendRequestCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
              )}
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

      <main
        ref={mainRef}
        className={`flex-1 w-full overscroll-y-none ${
          activeTab === "square"
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto custom-scrollbar"
        }`}
      >
        {activeTab === "square" ? (
          <>
            <div
              key="mobile-nav-square"
              className={`md:hidden flex bg-slate-800/50 p-1 rounded-lg m-4 shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
                showHeader
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-full -mt-16 opacity-0 pointer-events-none"
              }`}
            >
              <button
                onClick={() => setActiveTab("rooms")}
                className="flex-1 py-2 rounded-md text-sm font-medium text-slate-400"
              >
                大厅
              </button>
              <button
                onClick={() => setActiveTab("square")}
                className="flex-1 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white"
              >
                广场
              </button>
              <button
                onClick={() => setActiveTab("characters")}
                className="flex-1 py-2 rounded-md text-sm font-medium text-slate-400"
              >
                车卡
              </button>
              <button
                onClick={() => setActiveTab("friends")}
                className="flex-1 py-2 rounded-md text-sm font-medium relative text-slate-400"
              >
                好友
                {friendRequestCount > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className="flex-1 py-2 rounded-md text-sm font-medium text-slate-400"
              >
                我的
              </button>
            </div>
            <div className="flex-1 min-h-0 relative">
              <Suspense
                fallback={
                  <div className="h-full grid place-items-center text-slate-500">
                    Loading...
                  </div>
                }
              >
                <Square onScrollChange={(dir) => setShowHeader(dir === "up")} />
              </Suspense>
            </div>
          </>
        ) : (
          <div
            ref={mainContentRef}
            className="container mx-auto p-4 md:p-8 max-w-6xl"
          >
            {/* Mobile Nav */}
            <div
              key="mobile-nav-default"
              className="md:hidden flex bg-slate-800/50 p-1 rounded-lg mb-6"
            >
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
                onClick={() => setActiveTab("square")}
                className={`flex-1 py-2 rounded-md text-sm font-medium ${
                  (activeTab as string) === "square"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400"
                }`}
              >
                广场
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
                onClick={() => setActiveTab("friends")}
                className={`flex-1 py-2 rounded-md text-sm font-medium relative ${
                  activeTab === "friends"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400"
                }`}
              >
                好友
                {friendRequestCount > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
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
                  <div className="flex gap-2 overflow-x-auto pb-2">
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
                      <div className="flex gap-4">
                        <button
                          onClick={() => setNewRoomType("text")}
                          className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                            newRoomType === "text"
                              ? "bg-indigo-500/20 border-indigo-500 text-indigo-400"
                              : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600"
                          }`}
                        >
                          <MessageSquare size={24} />
                          <span className="text-sm font-bold">文字团</span>
                        </button>
                        <button
                          onClick={() => setNewRoomType("voice")}
                          className={`flex-1 py-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                            newRoomType === "voice"
                              ? "bg-pink-500/20 border-pink-500 text-pink-400"
                              : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600"
                          }`}
                        >
                          <Mic size={24} />
                          <span className="text-sm font-bold">语音团</span>
                        </button>
                      </div>
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
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500 animate-fade-in">
                    <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
                    <p className="text-slate-400 font-medium">
                      正在加载房间...
                    </p>
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
            ) : activeTab === "friends" ? (
              <Friends
                currentUser={
                  currentUserId
                    ? {
                        id: currentUserId,
                        nickname: userNickname,
                        bio: userBio,
                        user_code: userCode || undefined,
                        created_at: userCreatedAt || "",
                        is_vip: isVip,
                        avatar_url: userAvatar,
                      }
                    : null
                }
              />
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
                      <div className="mx-auto mb-4 flex justify-center relative">
                        <div className="relative">
                          {/* Circular Progress */}
                          {levelInfo && (
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
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r="48"
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="3"
                                strokeDasharray="301.59"
                                strokeDashoffset={
                                  301.59 -
                                  Math.min(
                                    levelInfo.experience /
                                      levelInfo.nextLevelExp,
                                    1
                                  ) *
                                    301.59
                                }
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                          )}

                          <AvatarUpload
                            url={userAvatar}
                            onUpload={() => {}}
                            editable={false}
                            size={96}
                          />
                        </div>
                      </div>
                      <div className="relative inline-flex items-center gap-2">
                        <h2
                          className={`text-2xl font-bold mb-1 transition-colors ${
                            isVip
                              ? "text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                              : "text-white"
                          }`}
                        >
                          {userNickname || "未命名用户"}
                        </h2>
                        {levelInfo && (
                          <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
                            LV.{levelInfo.level}
                          </span>
                        )}
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
                        <div
                          className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30 cursor-pointer hover:bg-slate-800 hover:border-indigo-500/50 transition-all group"
                          onClick={() => setShowHistoryModal(true)}
                        >
                          <div className="text-xs text-slate-500 uppercase font-bold mb-1 group-hover:text-indigo-400 transition-colors">
                            个人履历
                          </div>
                          <div className="text-2xl font-mono font-bold text-indigo-400">
                            {playerHistory.length + kpHistory.length}
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
                        <Button
                          onClick={handleUpdateProfile}
                          disabled={loading}
                        >
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

                {!isEditingProfile && (
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 text-center">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">
                      账户安全
                    </h3>
                    <Button
                      variant="secondary"
                      className="w-full md:w-auto min-w-[120px]"
                      icon={Lock}
                      onClick={() => {
                        setOldPassword("");
                        setNewPassword("");
                        setConfirmNewPassword("");
                        setShowChangePwdModal(true);
                      }}
                    >
                      修改密码
                    </Button>
                  </div>
                )}

                {/* Suggestion Section */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 text-center">
                  <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">
                    由衷期待您建议和反馈!
                  </h3>
                  <a
                    href="mailto:may331@foxmail.com"
                    className="text-indigo-400 hover:text-indigo-300 font-mono transition-colors text-lg"
                  >
                    may331@foxmail.com
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 right-8 z-50 p-3 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 transition-all duration-300 hover:bg-indigo-500 hover:scale-110",
          activeTab === "rooms" && showBackToTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none"
        )}
      >
        <ArrowUp size={24} />
      </button>

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

      {/* Game History Modal */}
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

          <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {historyTab === "player" ? (
              <div className="space-y-3">
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
            <Button variant="ghost" onClick={() => setShowHistoryModal(false)}>
              关闭
            </Button>
          </div>
        </Modal>
      )}

      {/* Change Password Modal */}
      {showChangePwdModal && (
        <Modal
          onClose={() => setShowChangePwdModal(false)}
          title="修改密码"
          icon={Lock}
          className="max-w-md"
        >
          <div className="p-6 space-y-4">
            <Input
              label="旧密码"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入旧密码"
            />
            <Input
              label="新密码"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码"
            />
            <Input
              label="确认新密码"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="请再次输入新密码"
            />
          </div>
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowChangePwdModal(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={!newPassword || loading}
              icon={loading ? Loader2 : Lock}
            >
              {loading ? "修改中..." : "确认修改"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
