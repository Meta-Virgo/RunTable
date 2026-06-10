import React, { Suspense, useState, useEffect } from "react";
import { Room, Character } from "../types";
import { Button, Input, Textarea, Modal, cn } from "./UI";
import {
  Plus,
  User,
  Loader2,
  Edit2,
  BookOpen,
  Lock,
  ArrowUp,
} from "lucide-react";
import { CharacterModal } from "./modals/CharacterModal";
import { AvatarUpload } from "./AvatarUpload";
import { Friends } from "./Friends";
import { useElasticScroll } from "../hooks/useElasticScroll";
import { useLobbyCatalog } from "../hooks/useLobbyCatalog";
import { useHomeProfileData } from "../hooks/useHomeProfileData";
import { useInvestigatorLibrary } from "../hooks/useInvestigatorLibrary";
import {
  HomeHeader,
  HomeMobileNav,
  type HomeTab,
} from "./home/HomeNavigation";
import { HomeHistoryModal } from "./home/HomeHistoryModal";
import { HomeLobbyView } from "./home/HomeLobbyView";
import {
  createRoom,
  setRoomPassword,
  updateRoomDetails,
} from "../services/rooms";
import { getCurrentUser } from "../services/auth";

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
  const [activeTab, setActiveTab] = useState<HomeTab>("rooms");
  const [loading, setLoading] = useState(false);

  // Rooms State
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomCoverImageUrl, setNewRoomCoverImageUrl] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [newRoomType, setNewRoomType] = useState<"text" | "voice">("text");

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Characters State
  const [showCharModal, setShowCharModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);

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

  const [historyTab, setHistoryTab] = useState<"kp" | "player">("player");
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Friend Requests Count
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const mainContentRef = React.useRef<HTMLDivElement>(null);
  const {
    currentUserId,
    userCode,
    userNickname,
    userBio,
    userAvatar,
    userCreatedAt,
    isVip,
    kpHistory,
    playerHistory,
    friendRequestCount,
    saveProfile,
    changePassword,
  } = useHomeProfileData();
  const { myCharacters, saveInvestigator, deleteInvestigator } =
    useInvestigatorLibrary();
  const {
    filteredRooms,
    isLoadingRooms,
    searchQuery,
    setSearchQuery,
    roomFilter,
    setRoomFilter,
    sortMode,
    setSortMode,
    refreshRooms,
  } = useLobbyCatalog({
    currentUserId,
    characters: myCharacters,
    onlineUsers,
  });

  useElasticScroll(mainRef, mainContentRef, {
    disabled: activeTab === "square",
  });

  useEffect(() => {
    setShowBackToTop(false);
  }, [activeTab]);

  // Handle scroll for non-square tabs
  useEffect(() => {
    const handleScroll = () => {
      if (activeTab === "square") return;

      if (mainRef.current) {
        const scrollTop = mainRef.current.scrollTop;
        setShowBackToTop(scrollTop > 300);

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
      coverImageUrl: newRoomCoverImageUrl.trim() || null,
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
      setNewRoomCoverImageUrl("");
      setNewRoomPassword("");
      setNewRoomType("text");
      setShowCreateRoom(false);
      refreshRooms();
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
      cover_image_url: editingRoom.cover_image_url || null,
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
    setLoading(true);
    const result = await saveProfile({
      nickname: editNickname,
      bio: editBio,
      avatar_url: editAvatar,
    });

    if (result.ok) {
      setIsEditingProfile(false);
    } else if (result.message) {
      alert(result.message);
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      alert("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    const result = await changePassword(newPassword);

    if (result.ok) {
      alert("密码修改成功");
      setShowChangePwdModal(false);
      setNewPassword("");
      setConfirmNewPassword("");
    } else if (result.message) {
      alert(result.message);
    }
    setLoading(false);
  };

  const handleSaveCharacter = async (char: Character) => {
    const result = await saveInvestigator(char, editingChar);
    if (result.ok) {
      setShowCharModal(false);
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const result = await deleteInvestigator(id);
    if (result.ok) {
      setShowCharModal(false);
    } else if (result.message) {
      alert(result.message);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden dicecho-page-bg text-slate-200 flex flex-col font-sans selection:bg-dicecho-primary/30">
      <HomeHeader
        activeTab={activeTab}
        friendRequestCount={friendRequestCount}
        onSelectTab={setActiveTab}
        onLogout={onLogout}
      />

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
            <HomeMobileNav
              activeTab={activeTab}
              friendRequestCount={friendRequestCount}
              onSelectTab={setActiveTab}
              mode="square"
            />
            <div className="flex-1 min-h-0 relative">
              <Suspense
                fallback={
                  <div className="h-full grid place-items-center text-slate-500">
                    Loading...
                  </div>
                }
              >
                <Square />
              </Suspense>
            </div>
          </>
        ) : (
          <div
            ref={mainContentRef}
            className="container mx-auto p-4 md:p-8 max-w-7xl"
          >
            {/* Mobile Nav */}
            <HomeMobileNav
              activeTab={activeTab}
              friendRequestCount={friendRequestCount}
              onSelectTab={setActiveTab}
              mode="default"
            />

            {activeTab === "rooms" ? (
              <HomeLobbyView
                currentUserId={currentUserId}
                filteredRooms={filteredRooms}
                isLoadingRooms={isLoadingRooms}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                roomFilter={roomFilter}
                setRoomFilter={setRoomFilter}
                sortMode={sortMode}
                setSortMode={setSortMode}
                myCharacters={myCharacters}
                onlineUsers={onlineUsers}
                onJoinRoom={onJoinRoom}
                showCreateRoom={showCreateRoom}
                setShowCreateRoom={setShowCreateRoom}
                newRoomTitle={newRoomTitle}
                setNewRoomTitle={setNewRoomTitle}
                newRoomDesc={newRoomDesc}
                setNewRoomDesc={setNewRoomDesc}
                newRoomCoverImageUrl={newRoomCoverImageUrl}
                setNewRoomCoverImageUrl={setNewRoomCoverImageUrl}
                newRoomPassword={newRoomPassword}
                setNewRoomPassword={setNewRoomPassword}
                newRoomType={newRoomType}
                setNewRoomType={setNewRoomType}
                loading={loading}
                onCreateRoom={handleCreateRoom}
              />
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
                      className="bg-dicecho-card/80 border border-dicecho-border/40 hover:border-dicecho-primary/50 rounded-lg p-5 transition-all group relative overflow-hidden shadow-sm"
                    >
                      <div className="flex gap-4 mb-3">
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
                              <div className="text-lg font-mono font-bold text-dicecho-primary">
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

                      <div className="mb-4">
                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                          {char.backstory || "暂无背景故事..."}
                        </p>
                      </div>

                      <div>
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
                    <div className="col-span-full py-12 text-center text-dicecho-muted border-2 border-dashed border-dicecho-border/40 rounded-lg">
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
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-dicecho-card/80 border border-dicecho-border/40 rounded-lg p-8 text-center relative overflow-hidden shadow-sm">
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
                          <span className="bg-dicecho-primary-strong text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm border border-dicecho-primary/40">
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
                            isVip ? "text-dicecho-primary" : "text-white"
                          }`}
                        >
                          {userNickname || "未命名用户"}
                        </h2>
                        {levelInfo && (
                          <span className="bg-dicecho-primary/20 text-dicecho-primary text-[10px] font-bold px-1.5 py-0.5 rounded border border-dicecho-primary/30">
                            LV.{levelInfo.level}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-center items-center gap-2 mb-4">
                        <span className="text-sm text-dicecho-muted font-mono bg-dicecho-panel/70 px-2 py-1 rounded">
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
                          className="bg-dicecho-panel/70 p-4 rounded-lg border border-dicecho-border/30 cursor-pointer hover:bg-dicecho-raised hover:border-dicecho-primary/50 transition-all group"
                          onClick={() => setShowHistoryModal(true)}
                        >
                          <div className="text-xs text-dicecho-muted uppercase font-bold mb-1 group-hover:text-dicecho-primary transition-colors">
                            个人履历
                          </div>
                          <div className="text-2xl font-mono font-bold text-dicecho-primary">
                            {playerHistory.length + kpHistory.length}
                          </div>
                        </div>
                        <div className="bg-dicecho-panel/70 p-4 rounded-lg border border-dicecho-border/30">
                          <div className="text-xs text-dicecho-muted uppercase font-bold mb-1">
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
                  <div className="bg-dicecho-card/80 border border-dicecho-border/40 rounded-lg p-6 text-center shadow-sm">
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
                <div className="bg-dicecho-card/80 border border-dicecho-border/40 rounded-lg p-6 text-center shadow-sm">
                  <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">
                    由衷期待您建议和反馈!
                  </h3>
                  <a
                    href="mailto:may331@foxmail.com"
                    className="text-dicecho-primary hover:text-white font-mono transition-colors text-lg"
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
          "fixed bottom-8 right-8 z-50 p-3 bg-dicecho-primary-strong text-white rounded-full shadow-lg shadow-black/20 transition-opacity duration-150 hover:bg-dicecho-primary",
          activeTab === "rooms" && showBackToTop
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
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
              label="房间封面 URL（可选）"
              value={editingRoom.cover_image_url || ""}
              onChange={(e) =>
                setEditingRoom({
                  ...editingRoom,
                  cover_image_url: e.target.value,
                })
              }
              placeholder="https://example.com/cover.jpg"
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

      <HomeHistoryModal
        open={showHistoryModal}
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
        kpHistory={kpHistory}
        playerHistory={playerHistory}
        onClose={() => setShowHistoryModal(false)}
      />

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
