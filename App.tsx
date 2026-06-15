import React, {
  Suspense,
  useState,
  useEffect,
} from "react";
import { LoginModal } from "./components/Login";
import { Welcome } from "./components/Welcome";
import { LoadingScreen } from "./components/LoadingScreen";
import { Button } from "./components/UI";
import "@livekit/components-styles";
import { Character } from "./types"; // Removed AppData as it might not be used anymore
import { Edit2, Menu, LogOut, Volume2, VolumeX } from "lucide-react";
import {
  CharacterModal,
  ChatArea,
  ConclusionModal,
  Dashboard,
  Home,
  LiveKitRoom,
  ModuleModal,
  MusicPlayer,
  RoomAudioRenderer,
  RoomSceneView,
  RoomTools,
  Sidebar,
  StartAudio,
  StatusModal,
  StoryModal,
} from "./components/AppLazyComponents";
import {
  INITIAL_CHAR_STATE,
  PAGE_SIZE,
} from "./constants/appState";
import { useLevelSystem } from "./hooks/useLevelSystem";
import { useAuthProfile } from "./hooks/useAuthProfile";
import { useGlobalPresence } from "./hooks/useGlobalPresence";
import {
  useRoomSessionState,
  type VoiceConnectionStatus,
} from "./hooks/useRoomSessionState";
import { useTabletopCommands } from "./hooks/useTabletopCommands";
import { useRoomCharacterActions } from "./hooks/useRoomCharacterActions";
import { clearLocalSupabaseSession, signOut } from "./services/auth";

const LOCAL_MUSIC_VOLUME_STORAGE_KEY = "runtable:music-player-volume";
const DEFAULT_LOCAL_MUSIC_VOLUME = 0.8;

function clampLocalMusicVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LOCAL_MUSIC_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function readLocalMusicVolume() {
  if (typeof window === "undefined") return DEFAULT_LOCAL_MUSIC_VOLUME;

  const stored = window.localStorage.getItem(LOCAL_MUSIC_VOLUME_STORAGE_KEY);
  if (!stored) return DEFAULT_LOCAL_MUSIC_VOLUME;

  return clampLocalMusicVolume(Number(stored));
}

const LocalMusicVolumeControl: React.FC<{
  volume: number;
  onVolumeChange: (volume: number) => void;
}> = ({ volume, onVolumeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const Icon = volume === 0 ? VolumeX : Volume2;
  const volumePercent = Math.round(volume * 100);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title="本地音量"
        aria-label="本地音量"
        aria-expanded={isOpen}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          isOpen
            ? "border-dicecho-primary/45 bg-dicecho-primary/15 text-white"
            : "border-transparent text-dicecho-muted hover:border-dicecho-border/45 hover:bg-dicecho-raised/65 hover:text-white"
        }`}
      >
        <Icon size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-11 top-1/2 z-40 flex h-9 -translate-y-1/2 items-center px-2">
          <input
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(event) =>
              onVolumeChange(Number(event.target.value) / 100)
            }
            aria-label="本地背景音乐音量"
            className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-dicecho-raised accent-dicecho-primary"
          />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Routing State
  // Improved detection for Welcome page (handles trailing slash and Supabase hash params)
  const [isWelcome, setIsWelcome] = useState(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;

    // 1. Explicit path match
    if (path.startsWith("/welcome")) return true;

    // 2. Check for Supabase signup confirmation in hash/search (e.g. #access_token=...&type=signup)
    // This handles cases where redirect might land on root but preserves auth params
    if (
      hash.includes("type=signup") ||
      search.includes("type=signup") ||
      hash.includes("type=invite") ||
      search.includes("type=invite") ||
      hash.includes("type=recovery") ||
      search.includes("type=recovery")
    ) {
      return true;
    }

    return false;
  });

  const [minLoadingPassed, setMinLoadingPassed] = useState(false); // Ensure loading screen shows for a bit
  const { session, authLoading, userNickname, isVip } = useAuthProfile();

  // Level System
  const levelInfo = useLevelSystem(session);

  const roomSession = useRoomSessionState({
    userId: session?.user?.id,
    userNickname,
    pageSize: PAGE_SIZE,
    voiceAccessToken: session?.access_token,
  });
  const {
    currentRoomId,
    roomType,
    token,
    voiceConnectionStatus,
    voiceError,
    characters,
    derivedCharacters,
    logs,
    hasMoreLogs,
    isLoadingMore,
    moduleInfo,
    roomPassword,
    activeCharId,
    isKP,
    roomMemberItems,
    kpId,
    onlineUsers,
    bgMusicUrl,
    isMusicPlaying,
    musicTrackIndex,
  } = roomSession.snapshot;
  const {
    restoreRoomFromUrl,
    joinRoomSession,
    leaveCurrentRoom,
    addLog,
    deleteCurrentRoom,
    clearCurrentRoomChat,
    deleteCurrentRoomMessage,
    buildCurrentRoomStory,
    removeRoomCharacter,
    kickRoomMemberByUserId,
    concludeCurrentRoom,
    updateModuleSettings,
    updateMusicUrl,
    updateMusicState,
    loadMoreLogs,
    clearRoomSession,
  } = roomSession.actions;
  const {
    replaceCharacters,
    selectActiveCharacter,
    markVoiceConnected,
    markVoiceReconnecting,
    markVoiceDisconnected,
    markVoiceError,
  } = roomSession.localUpdates;

  // Application State
  const [view, setView] = useState("main");
  const [isPageHidden, setIsPageHidden] = useState(() =>
    typeof document === "undefined" ? false : document.visibilityState === "hidden"
  );

  // ✅ 初始化为空数组/空对象，不再使用 DEFAULT_DATA
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const globalOnlineUsers = useGlobalPresence(session?.user?.id);
  const [globalMute, setGlobalMute] = useState(false);
  const [localMusicVolume, setLocalMusicVolumeState] =
    useState(readLocalMusicVolume);

  const setLocalMusicVolume = (nextVolume: number) => {
    const safeVolume = clampLocalMusicVolume(nextVolume);
    setLocalMusicVolumeState(safeVolume);
    if (safeVolume > 0 && globalMute) {
      setGlobalMute(false);
    }
  };

  useEffect(() => {
    window.localStorage.setItem(
      LOCAL_MUSIC_VOLUME_STORAGE_KEY,
      String(localMusicVolume)
    );
  }, [localMusicVolume]);

  useEffect(() => {
    const syncPageVisibility = () => {
      setIsPageHidden(document.visibilityState === "hidden");
    };

    syncPageVisibility();
    document.addEventListener("visibilitychange", syncPageVisibility);
    window.addEventListener("pageshow", syncPageVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncPageVisibility);
      window.removeEventListener("pageshow", syncPageVisibility);
    };
  }, []);


  // Modal State
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showCharModal, setShowCharModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [addingRole, setAddingRole] = useState<string>("调查员");
  // 新增：记录正在添加的角色类型，用于新建角色时正确设置 type
  const [addingType, setAddingType] = useState<
    "investigator" | "npc" | "monster"
  >("investigator");
  const [statusTargetId, setStatusTargetId] = useState<string | null>(null);
  const [storyContent, setStoryContent] = useState("");
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [showConclusionModal, setShowConclusionModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { rollDice, handleSend } = useTabletopCommands({
    characters,
    activeCharId,
    isKP,
    addLog,
  });
  const {
    duplicateCharacter,
    saveRoomCharacter,
    deleteRoomCharacter,
    updateCharacterVitals,
  } = useRoomCharacterActions({
    currentRoomId,
    userId: session?.user?.id,
    characters,
    setCharacters: replaceCharacters,
    setActiveCharId: selectActiveCharacter,
    addLog,
  });

  // Minimum Loading Time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingPassed(true);
    }, 2000); // Show loading screen for at least 2 seconds
    return () => clearTimeout(timer);
  }, []);

  // Session Restoration (URL & Persistence)
  useEffect(() => {
    if (!authLoading && session?.user && !currentRoomId) {
      restoreRoomFromUrl();
    }
  }, [session, authLoading, currentRoomId, restoreRoomFromUrl]);

  useEffect(() => {
    if (!authLoading && !session?.user && currentRoomId) {
      clearRoomSession();
    }
  }, [authLoading, clearRoomSession, currentRoomId, session]);

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // --- Helpers ---
  const handleJoinRoom = async (
    roomId: string,
    charId: string,
    password?: string | null,
    isRestoring = false,
    invitation?: { invitationId?: string; inviteToken?: string }
  ) => {
    const result = await joinRoomSession({
      roomId,
      charId,
      password,
      isRestoring,
      invitationId: invitation?.invitationId,
      inviteToken: invitation?.inviteToken,
    });

    if (!result.ok && result.message) {
      alert(result.message);
    }
  };

  const handleShowStory = async () => {
    setShowStoryModal(true);
    setIsGeneratingStory(true);
    setStoryContent("");

    const result = await buildCurrentRoomStory();
    setStoryContent(result.ok && result.story ? result.story : result.message || "");
    setIsGeneratingStory(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const result = await deleteCurrentRoomMessage(messageId);
    if (!result.ok && result.message) {
      alert(result.message);
    }
  };

  // --- CRUD ---
  const handleDuplicateCharacter = async (char: Character) => {
    const result = await duplicateCharacter(char);
    if (!result.ok && result.message) {
      alert(result.message);
    }
  };

  const handleSaveCharacter = async (char: Character) => {
    const result = await saveRoomCharacter(char, editingChar);
    if (result.ok) {
      setShowCharModal(false);
      setEditingChar(null);
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const result = await deleteRoomCharacter(id);
    if (result.ok) {
      setShowCharModal(false);
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleRemoveCharacter = async (id: string) => {
    const result = await removeRoomCharacter(id);
    if (result.ok) {
      setShowCharModal(false);
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleKickMember = async (userId: string) => {
    const result = await kickRoomMemberByUserId(userId);
    if (result.ok) {
      setShowCharModal(false);
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleUpdateStatus = async (hp: number, san: number, mp: number) => {
    const result = await updateCharacterVitals(statusTargetId, hp, san, mp);
    if (result.ok) {
      setShowStatusModal(false);
      setStatusTargetId(null);
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleDeleteRoom = async () => {
    const result = await deleteCurrentRoom();
    if (result.ok) {
      setView("main");
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleClearChat = async () => {
    const result = await clearCurrentRoomChat();
    if (!result.ok && result.message) {
      alert(result.message);
    }
  };

  const activeChar =
    activeCharId === "pc"
      ? { name: "守秘人", role: "Keeper" }
      : characters.find((c) => c.id === activeCharId) || {
          name: "未知",
          role: "Unknown",
        };

  const handleConcludeGame = async (outcomes: Record<string, string>) => {
    const result = await concludeCurrentRoom(outcomes);
    if (result.ok) {
      alert("结团成功！房间已归档。");
      setShowConclusionModal(false);
      setView("main");
    } else if (result.message) {
      alert(result.message);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) throw error;
    } catch (error) {
      console.warn("Logout error (safe to ignore):", error);
      // Fallback: Manually clear session from local storage if network request fails
      // This ensures the user is logged out locally even if the server request was aborted
      clearLocalSupabaseSession();
    } finally {
      // Force state reset
      clearRoomSession();
    }
  };

  const handleLeaveRoom = async () => {
    await leaveCurrentRoom();
  };

  const handleLoginRequest = () => {
    setShowLoginModal(true);
  };


  if (isWelcome) {
    return (
      <Welcome
        onNavigate={(path) => {
          if (path === "/") {
            setIsWelcome(false);
          }
        }}
      />
    );
  }

  if (authLoading || !minLoadingPassed) {
    return <LoadingScreen />;
  }

  if (!currentRoomId) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Home
          key={session?.user?.id ?? "guest"}
          onJoinRoom={handleJoinRoom}
          isAuthenticated={Boolean(session?.user)}
          onAuthAction={session?.user ? handleSignOut : handleLoginRequest}
          onLoginRequest={handleLoginRequest}
          onlineUsers={globalOnlineUsers}
          levelInfo={levelInfo}
        />
        <LoginModal
          open={!session?.user && showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </Suspense>
    );
  }

  if (!session?.user) {
    return <LoadingScreen />;
  }

  const currentUserId = session.user.id;

  const voiceStatusText: Record<VoiceConnectionStatus, string> = {
    idle: "",
    "requesting-token": "正在检查麦克风并获取语音凭证",
    connecting: "正在连接语音房间",
    connected: "语音已连接",
    disconnected: "语音连接已断开",
    error: "语音连接失败",
  };

  const voiceStatusClass =
    voiceConnectionStatus === "connected"
      ? "bg-emerald-500"
      : voiceConnectionStatus === "error" ||
        voiceConnectionStatus === "disconnected"
      ? "bg-rose-500"
      : "bg-amber-400 animate-pulse";

  const appContent = (
    <Suspense fallback={<LoadingScreen />}>
      <div className="flex h-[100dvh] overflow-hidden dicecho-page-bg text-slate-200 font-sans selection:bg-dicecho-primary/30">

      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        view={view}
        setView={setView}
        activeCharId={activeCharId}
        setActiveCharId={selectActiveCharacter}
        characters={derivedCharacters}
        onOpenStatusEdit={(id) => {
          setStatusTargetId(id);
          setShowStatusModal(true);
        }}
        onKickMember={handleKickMember}
        isMobile={isMobile}
        isKP={isKP}
        roomMemberItems={roomMemberItems}
        kpOnline={kpId ? onlineUsers.has(kpId) : false}
        userNickname={userNickname}
        roomType={roomType}
        isVoiceConnected={voiceConnectionStatus === "connected"}
      />

      <main className="flex-1 flex min-h-0 flex-col relative min-w-0">
        <header className="h-16 shrink-0 pt-safe flex items-center justify-between px-4 md:px-8 border-b border-dicecho-border/40 bg-dicecho-panel/85 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-white md:hidden"
            >
              <Menu size={24} />
            </button>
            <button
              type="button"
              onClick={isKP ? () => setShowModuleModal(true) : undefined}
              disabled={!isKP}
              className={`group flex min-w-0 flex-col justify-center rounded-lg px-2 py-1.5 text-left transition-colors ${
                isKP
                  ? "cursor-pointer"
                  : "cursor-default"
              }`}
              title={isKP ? "编辑房间信息" : undefined}
            >
              <span className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-white font-bold text-lg md:text-xl tracking-tight">
                  {moduleInfo.title || "未命名模组"}
                </h1>
                {isKP && (
                  <Edit2
                    size={14}
                    className="shrink-0 text-dicecho-muted opacity-70 transition-colors group-hover:text-dicecho-primary group-hover:opacity-100"
                  />
                )}
              </span>
              <p className="text-xs text-dicecho-muted truncate max-w-[150px] md:max-w-md mt-1">
                {moduleInfo.description || "暂无描述"}
              </p>
            </button>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {roomType !== "voice" && (
              <LocalMusicVolumeControl
                volume={localMusicVolume}
                onVolumeChange={setLocalMusicVolume}
              />
            )}
            <Button
              variant="ghost"
              size={isMobile ? "icon" : "sm"}
              icon={LogOut}
              onClick={handleLeaveRoom}
              title="退出房间"
            >
              {!isMobile && "退出房间"}
            </Button>
          </div>
        </header>

        {roomType === "voice" && voiceConnectionStatus !== "idle" && (
          <div className="shrink-0 px-4 md:px-8 py-2 border-b border-dicecho-border/40 bg-dicecho-card/70">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-2 font-medium text-slate-200">
                <span
                  className={`h-2 w-2 rounded-full ${voiceStatusClass}`}
                ></span>
                {voiceStatusText[voiceConnectionStatus]}
              </span>
              {voiceError && (
                <span className="text-rose-300 break-words">{voiceError}</span>
              )}
            </div>
          </div>
        )}

        {view !== "setup" &&
        view !== "music" &&
        view !== "tools" &&
        view !== "scene" ? (
          <>
            <ChatArea
              logs={logs}
              activeChar={activeChar}
              activeCharId={activeCharId}
              characters={derivedCharacters}
              moduleInfo={moduleInfo}
              onSend={(text, recipientId, type, quote) =>
                handleSend(text, recipientId, type, quote)
              }
              onRollDice={rollDice}
              onShowStory={handleShowStory}
              onDeleteMessage={handleDeleteMessage}
              onLoadMore={loadMoreLogs}
              hasMore={hasMoreLogs}
              isLoading={isLoadingMore}
              isKP={isKP}
              kpId={kpId}
              isVip={isVip}
            />
            {roomType === "voice" && token && (
              <>
                <RoomAudioRenderer />
                <StartAudio label="点击开启声音" />
              </>
            )}
          </>
        ) : view === "setup" ? (
          <Dashboard
            characters={derivedCharacters}
            onAddChar={(roleLabel) => {
              // 接收 role 标签，例如 "NPC", "怪物"
              setEditingChar(null);

              // 1. 根据标签推断 type
              let dbType: "investigator" | "npc" | "monster" = "investigator";
              if (roleLabel === "NPC") dbType = "npc";
              if (roleLabel === "怪物") dbType = "monster";

              setAddingType(dbType); // 保存 type
              setAddingRole(roleLabel); // 保存 role
              setShowCharModal(true);
            }}
            onEditChar={(char) => {
              setEditingChar(char);
              setShowCharModal(true);
            }}
            onDuplicateChar={handleDuplicateCharacter}
            isKP={isKP}
          />
        ) : view === "tools" ? (
          <RoomTools
            roomId={currentRoomId}
            isKP={isKP}
            userId={currentUserId}
            logs={logs}
            onDeleteRoom={handleDeleteRoom}
            onClearChat={handleClearChat}
            onConcludeGame={() => setShowConclusionModal(true)}
          />
        ) : view === "scene" ? (
          <RoomSceneView
            roomId={currentRoomId}
            isKP={isKP}
            currentUserId={currentUserId}
            characters={derivedCharacters}
            roomMemberItems={roomMemberItems}
          />
        ) : null}

        <MusicPlayer
          url={bgMusicUrl}
          isKP={isKP}
          onUpdateUrl={updateMusicUrl}
          mode={view === "music" ? "sidebar" : "fixed"}
          className={
            view === "music" ? "absolute inset-0 z-10 bg-dicecho-panel pt-16" : ""
          }
          isMobile={isMobile}
          isHidden={view !== "music" || roomType === "voice"}
          globalMute={globalMute}
          volume={localMusicVolume}
          syncedIsPlaying={isMusicPlaying}
          syncedTrackIndex={musicTrackIndex}
          onUpdateSyncState={updateMusicState}
        />
      </main>

      {/* Modals */}
      {showConclusionModal && (
        <ConclusionModal
          characters={characters.filter(
            (c) => c.type === "investigator" || c.role === "调查员"
          )}
          onConfirm={handleConcludeGame}
          onClose={() => setShowConclusionModal(false)}
        />
      )}

      {showModuleModal && (
        <ModuleModal
          info={moduleInfo}
          password={roomPassword}
          onSave={async (info, password) => {
            const result = await updateModuleSettings(info, password);
            if (result.message) {
              alert(result.message);
            }
          }}
          onClose={() => setShowModuleModal(false)}
        />
      )}

      {showCharModal && (
        <CharacterModal
          initialData={
            editingChar || {
              ...INITIAL_CHAR_STATE,
              role: addingRole,
              type: addingType,
            }
          } // 传入 type
          isEditing={!!editingChar}
          onSave={handleSaveCharacter}
          onDelete={isKP ? handleDeleteCharacter : undefined} // 仅 KP 可删除档案
          onRemove={isKP ? handleRemoveCharacter : undefined} // KP 可以移出 PC
          onClose={() => setShowCharModal(false)}
          readOnly={!isKP && editingChar?.user_id !== currentUserId} // 增加只读保护
        />
      )}

      {showStatusModal && statusTargetId && (
        <StatusModal
          char={characters.find((c) => c.id === statusTargetId)!}
          onSave={handleUpdateStatus}
          onClose={() => {
            setShowStatusModal(false);
            setStatusTargetId(null);
          }}
        />
      )}

      {showStoryModal && (
        <StoryModal
          content={storyContent}
          isLoading={isGeneratingStory}
          onClose={() => setShowStoryModal(false)}
        />
      )}
      </div>
    </Suspense>
  );

  if (roomType === "voice" && token) {
    return (
      <Suspense fallback={<LoadingScreen />}>
      <LiveKitRoom
        token={token}
        serverUrl={import.meta.env.VITE_LIVEKIT_URL}
        connect={true}
        options={{
          disconnectOnPageLeave: false,
        }}
        connectOptions={{
          maxRetries: 5,
          peerConnectionTimeout: 30_000,
          websocketTimeout: 30_000,
        }}
        audio={{
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }}
        video={false}
        data-lk-theme="default"
        onConnected={() => {
          markVoiceConnected();
        }}
        onDisconnected={() => {
          if (isPageHidden) {
            markVoiceReconnecting();
            return;
          }

          markVoiceDisconnected("语音连接已断开，正在尝试保持当前房间连接。");
        }}
        onError={(error) => {
          console.error("LiveKit Error:", error);
          markVoiceError(error.message || "语音房间连接异常");
        }}
      >
        {appContent}
      </LiveKitRoom>
      </Suspense>
    );
  }

  return appContent;
};

export default App;
