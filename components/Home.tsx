import React, { Suspense, useState, useEffect } from "react";
import { Room, Character } from "../types";
import { Button, Input, Textarea, Modal, cn } from "./UI";
import {
  Plus,
  User,
  Edit2,
  BookOpen,
  ArrowUp,
} from "lucide-react";
import { CharacterModal } from "./modals/CharacterModal";
import { AvatarUpload } from "./AvatarUpload";
import { CoverImageUpload } from "./CoverImageUpload";
import { Friends } from "./Friends";
import { useElasticScroll } from "../hooks/useElasticScroll";
import { useLobbyCatalog } from "../hooks/useLobbyCatalog";
import { useHomeProfileData } from "../hooks/useHomeProfileData";
import { useSocialMessageBadges } from "../hooks/useSocialMessages";
import { useInvestigatorLibrary } from "../hooks/useInvestigatorLibrary";
import {
  HomeHeader,
  HomeMobileNav,
  type HomeTab,
} from "./home/HomeNavigation";
import { HomeHistoryModal } from "./home/HomeHistoryModal";
import { HomeLobbyView } from "./home/HomeLobbyView";
import { HomeAccountViews } from "./home/HomeAccountViews";
import {
  CharacterCardSkeleton,
  FeedSkeletonList,
  StaggeredItem,
} from "./Skeleton";
import {
  createRoom,
  setRoomPassword,
  updateRoomDetails,
} from "../services/rooms";
import { getCurrentUser } from "../services/auth";
import { useSquareNotifications } from "../hooks/useSquareNotifications";

const Square = React.lazy(() =>
  import("./Square").then((module) => ({ default: module.Square }))
);

interface HomeProps {
  onJoinRoom: (
    roomId: string,
    charId: string | "pc",
    password?: string | null,
    isRestoring?: boolean,
    invitation?: { invitationId?: string; inviteToken?: string }
  ) => void;
  isAuthenticated: boolean;
  onAuthAction: () => void;
  onLoginRequest: () => void;
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
  isAuthenticated,
  onAuthAction,
  onLoginRequest,
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
  const [settingsSection, setSettingsSection] = useState<
    "profile" | "security"
  >("profile");
  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  // Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [historyTab, setHistoryTab] = useState<"kp" | "player">("player");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [messageCenterPane, setMessageCenterPane] = useState<
    "social" | "square"
  >("social");
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("room_invite")
  );

  // Friend Requests Count
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const mainContentRef = React.useRef<HTMLDivElement>(null);
  const {
    currentUserId,
    userCode,
    userEmail,
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
  const {
    myCharacters,
    isLoadingCharacters,
    saveInvestigator,
    deleteInvestigator,
  } = useInvestigatorLibrary();
  const {
    filteredRooms,
    isLoadingRooms,
    roomLoadError,
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
  const {
    notifications,
    unreadCount,
    refreshNotifications,
    markAsRead,
    deleteNotification,
  } = useSquareNotifications(
    currentUserId ? { id: currentUserId } : null,
    activeTab === "notifications"
  );
  const socialBadges = useSocialMessageBadges(currentUserId);

  useEffect(() => {
    setEditNickname(userNickname || "");
    setEditBio(
      userBio && userBio !== "NaN" && userBio !== "null" ? userBio : ""
    );
    setEditAvatar(userAvatar);
  }, [userAvatar, userBio, userNickname]);

  const requestLogin = React.useCallback(() => {
    onLoginRequest();
  }, [onLoginRequest]);

  const handleSelectTab = React.useCallback(
    (tab: HomeTab) => {
      if (!isAuthenticated && tab !== "rooms") {
        requestLogin();
        return;
      }
      if (tab === "settings") {
        setSettingsSection("profile");
      }
      setActiveTab(tab);
    },
    [isAuthenticated, requestLogin]
  );

  useElasticScroll(mainRef, mainContentRef, {
    disabled: activeTab === "square",
  });

  useEffect(() => {
    setShowBackToTop(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isAuthenticated && activeTab !== "rooms") {
      setActiveTab("rooms");
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!pendingInviteToken) return;
    if (!isAuthenticated) {
      requestLogin();
      return;
    }
    setMessageCenterPane("social");
    setActiveTab("notifications");
  }, [isAuthenticated, pendingInviteToken, requestLogin]);

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
    if (!isAuthenticated) {
      requestLogin();
      return;
    }

    if (!newRoomTitle.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await getCurrentUser();
    if (!user) {
      setLoading(false);
      requestLogin();
      return;
    }

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
      alert("个人资料已保存");
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
      setNewPassword("");
      setConfirmNewPassword("");
    } else if (result.message) {
      alert(result.message);
    }
    setLoading(false);
  };

  const handleResetProfileForm = () => {
    setEditNickname(userNickname || "");
    setEditBio(
      userBio && userBio !== "NaN" && userBio !== "null" ? userBio : ""
    );
    setEditAvatar(userAvatar);
  };

  const handleDeleteNotification = async (notificationId: string) => {
    const result = await deleteNotification(notificationId);
    if (!result.ok && result.message) {
      alert(result.message);
    }
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
        socialMessageCount={socialBadges.total}
        notificationUnreadCount={unreadCount + socialBadges.total}
        onSelectTab={handleSelectTab}
        isAuthenticated={isAuthenticated}
        userAvatar={userAvatar}
        userNickname={userNickname}
        onAuthAction={onAuthAction}
        onLoginRequest={requestLogin}
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
              socialMessageCount={socialBadges.total}
              onSelectTab={handleSelectTab}
              isAuthenticated={isAuthenticated}
              onLoginRequest={requestLogin}
              mode="square"
            />
            <div className="flex-1 min-h-0 relative">
              <Suspense
                fallback={
                  <div className="h-full overflow-hidden p-4 md:p-6">
                    <div className="mx-auto max-w-4xl space-y-6">
                      <FeedSkeletonList count={3} />
                    </div>
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
            className="container mx-auto max-w-screen-2xl p-4 md:p-8"
          >
            {/* Mobile Nav */}
            <HomeMobileNav
              activeTab={activeTab}
              friendRequestCount={friendRequestCount}
              socialMessageCount={socialBadges.total}
              onSelectTab={handleSelectTab}
              isAuthenticated={isAuthenticated}
              onLoginRequest={requestLogin}
              mode="default"
            />

            {activeTab === "rooms" ? (
              <HomeLobbyView
                isAuthenticated={isAuthenticated}
                currentUserId={currentUserId}
                filteredRooms={filteredRooms}
                isLoadingRooms={isLoadingRooms}
                roomLoadError={roomLoadError}
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
                onRefreshRooms={refreshRooms}
                onLoginRequest={requestLogin}
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
                  {isLoadingCharacters ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <StaggeredItem key={index} index={index}>
                        <CharacterCardSkeleton />
                      </StaggeredItem>
                    ))
                  ) : (
                    myCharacters.map((char, index) => (
                      <StaggeredItem
                        key={char.id}
                        index={index}
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
                      </StaggeredItem>
                    ))
                  )}
                  {!isLoadingCharacters && myCharacters.length === 0 && (
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
                onOpenDirectMessage={(profile) => {
                  setMessageCenterPane("social");
                  setActiveTab("notifications");
                  window.setTimeout(() => {
                    window.dispatchEvent(
                      new CustomEvent("runtable:open-direct-message", {
                        detail: { userId: profile.id },
                      })
                    );
                  }, 0);
                }}
              />
            ) : (
              <HomeAccountViews
                activeTab={
                  activeTab === "settings"
                    ? "settings"
                    : activeTab === "notifications" || activeTab === "messages"
                      ? "notifications"
                      : "profile"
                }
                messageCenterPane={messageCenterPane}
                onSelectMessageCenterPane={setMessageCenterPane}
                settingsSection={settingsSection}
                setSettingsSection={setSettingsSection}
                currentUserId={currentUserId}
                userCode={userCode}
                userNickname={userNickname || userEmail || null}
                userBio={userBio}
                userAvatar={userAvatar}
                userCreatedAt={userCreatedAt}
                isVip={isVip}
                levelInfo={levelInfo}
                kpHistory={kpHistory}
                playerHistory={playerHistory}
                editNickname={editNickname}
                setEditNickname={setEditNickname}
                editBio={editBio}
                setEditBio={setEditBio}
                editAvatar={editAvatar}
                setEditAvatar={setEditAvatar}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmNewPassword={confirmNewPassword}
                setConfirmNewPassword={setConfirmNewPassword}
                loading={loading}
                notifications={notifications}
                unreadCount={unreadCount}
                socialMessageCount={socialBadges.total}
                myCharacters={myCharacters}
                initialInviteToken={pendingInviteToken}
                onMarkNotificationRead={markAsRead}
                onDeleteNotification={handleDeleteNotification}
                onRefreshNotifications={refreshNotifications}
                onLoginRequest={requestLogin}
                onJoinRoom={onJoinRoom}
                onInviteTokenHandled={() => {
                  setPendingInviteToken(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete("room_invite");
                  window.history.replaceState(null, "", url);
                  void socialBadges.refresh();
                }}
                onSaveProfile={handleUpdateProfile}
                onResetProfile={handleResetProfileForm}
                onChangePassword={handleChangePassword}
                onShowHistory={() => setShowHistoryModal(true)}
              />
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
            <CoverImageUpload
              value={editingRoom.cover_image_url || ""}
              onChange={(url) =>
                setEditingRoom({
                  ...editingRoom,
                  cover_image_url: url,
                })
              }
              currentUserId={currentUserId}
              disabled={loading}
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
              icon={Edit2}
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

    </div>
  );
};
