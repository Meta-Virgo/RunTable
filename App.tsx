import React, {
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Login } from "./components/Login";
import { Welcome } from "./components/Welcome";
import { LoadingScreen } from "./components/LoadingScreen";
import { Button } from "./components/UI";
import "@livekit/components-styles";
import { ModuleInfo, Character, Log } from "./types"; // Removed AppData as it might not be used anymore
import { Menu, LogOut, Volume2, VolumeX } from "lucide-react";
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
  Sidebar,
  StartAudio,
  StatusModal,
  StoryModal,
} from "./components/AppLazyComponents";
import {
  EMPTY_MODULE_INFO,
  INITIAL_CHAR_STATE,
  PAGE_SIZE,
} from "./constants/appState";
import { parseDiceCommand } from "./utils/commandParser";
import { evaluateDiceExpression, resolveStatAlias } from "./utils/diceExpression";
import { buildStoryReport } from "./utils/storyReport";
import { useLevelSystem } from "./hooks/useLevelSystem";
import { useAuthProfile } from "./hooks/useAuthProfile";
import { useGlobalPresence } from "./hooks/useGlobalPresence";
import { useRoomRealtime } from "./hooks/useRoomRealtime";
import { mapCharacterRow } from "./utils/characterMapper";
import { buildCharacterMutationPayload } from "./utils/characterPayload";
import {
  addRoomSystemMessage,
  concludeRoom,
  deleteRoom,
  fetchProfileNickname,
  fetchRoomById,
  fetchRoomCharacters,
  joinRoom,
  kickRoomMember,
  setRoomPassword as saveRoomPassword,
  updateRoomModule,
  updateRoomMusicState,
  updateRoomMusicUrl,
} from "./services/rooms";
import { requestVoiceToken } from "./services/livekit";
import {
  addMessage,
  deleteMessage,
  deleteRoomMessages,
  fetchMessagesBefore,
  fetchMessagesPage,
  mapMessagesToLogs,
} from "./services/messages";
import {
  createCharacter,
  deleteCharacter as deleteCharacterRecord,
  fetchCharacterById,
  removeCharacterFromRoom,
  updateCharacter,
  updateCharacterStats as saveCharacterStats,
} from "./services/characters";
import { clearLocalSupabaseSession, getCurrentUser, signOut } from "./services/auth";

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

  // Application State
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomType, setRoomType] = useState<"text" | "voice">("text");
  const [view, setView] = useState("main");
  const [token, setToken] = useState("");

  // ✅ 初始化为空数组/空对象，不再使用 DEFAULT_DATA
  const [characters, setCharacters] = useState<Character[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo>(EMPTY_MODULE_INFO);
  const [roomPassword, setRoomPassword] = useState("");

  const [activeCharId, setActiveCharId] = useState("pc");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isKP, setIsKP] = useState(false);
  const [kpId, setKpId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const globalOnlineUsers = useGlobalPresence(session?.user?.id);
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicTrackIndex, setMusicTrackIndex] = useState(0);
  const [globalMute, setGlobalMute] = useState(false);

  useEffect(() => {
    if (roomType === "voice" && currentRoomId && session?.access_token) {
      (async () => {
        try {
          const participantName =
            activeCharId === "pc"
              ? userNickname || "守秘人"
              : characters.find((c) => c.id === activeCharId)?.name ||
                "未知用户";

          const voiceToken = await requestVoiceToken({
            accessToken: session.access_token,
            roomId: currentRoomId,
            activeCharId,
            participantName,
          });
          setToken(voiceToken);
        } catch (e) {
          console.error(e);
        }
      })();
    } else {
      setToken("");
    }
  }, [roomType, currentRoomId, activeCharId, userNickname, characters, session]);

  // Load More Logs Logic
  const handleLoadMoreLogs = async () => {
    if (isLoadingMore || !hasMoreLogs || logs.length === 0 || !currentRoomId)
      return;

    // Safety check: ensure logs are sorted by time (oldest first) before picking the first one
    // This handles edge cases where logs might be out of order
    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(a.createdAt || a.timestamp).getTime() -
        new Date(b.createdAt || b.timestamp).getTime()
    );
    const oldestLog = sortedLogs[0];

    if (!oldestLog) return;

    setIsLoadingMore(true);
    const oldestTime = oldestLog.createdAt;

    if (!oldestTime) {
      console.error("Missing createdAt for log:", oldestLog);
      setIsLoadingMore(false);
      return;
    }

    try {
      const { data: msgs, error: msgError } = await fetchMessagesBefore(
        currentRoomId,
        oldestTime,
        PAGE_SIZE
      );

      if (msgError) throw msgError;

      if (msgs && msgs.length > 0) {
        msgs.reverse(); // Sort oldest first

        const formattedLogs = await mapMessagesToLogs(
          msgs,
          session?.user?.id
        );

        setLogs((prev) => [...formattedLogs, ...prev]);

        if (msgs.length < PAGE_SIZE) {
          setHasMoreLogs(false);
        }
      } else {
        setHasMoreLogs(false);
      }
    } catch (error) {
      console.error("Error loading more logs:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

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

  // Pagination State
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Characters Ref for Realtime (Refs are needed to access latest state inside listeners)
  const charactersRef = useRef(characters);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  // Minimum Loading Time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingPassed(true);
    }, 2000); // Show loading screen for at least 2 seconds
    return () => clearTimeout(timer);
  }, []);

  // Session Restoration (URL & Persistence)
  useEffect(() => {
    const restoreSession = async () => {
      if (!session?.user) return;

      // Check URL for room ID
      const params = new URLSearchParams(window.location.search);
      const roomId = params.get("room");

      if (!roomId) return;

      // Fetch Room to validate access
      const { data: room, error } = await fetchRoomById(roomId);
      if (error || !room) {
        // Invalid room, clear URL
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }

      setKpId(room.kp_id);
      setBgMusicUrl(room.bg_music_url);
      setRoomType(room.type || "text");
      setIsMusicPlaying(room.is_music_playing || false);
      setMusicTrackIndex(room.music_track_index || 0);

      // Clear URL to keep lobby clean on refresh, per your requirement
      window.history.replaceState(null, "", window.location.pathname);
    };

    if (!authLoading && !currentRoomId) {
      restoreSession();
    }
  }, [session, authLoading]);

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
    isRestoring = false
  ) => {
    // Fetch Room Data
    const { data: room } = await fetchRoomById(roomId);
    if (room) {
      // Permission Check
      const {
        data: { user },
      } = await getCurrentUser();
      const userIsKP = user?.id === room.kp_id;

      if (!charId) {
        alert("请先选择角色！");
        return;
      }

      if (charId === "pc" && !userIsKP) {
        alert("权限不足：只有房主才能以守秘人身份进入！");
        return;
      }

      const { error: joinError } = await joinRoom({
        roomId,
        characterId: charId === "pc" ? null : charId,
        password,
      });

      if (joinError) {
        console.error("Failed to join room:", joinError);
        const message = joinError.message.includes("Invalid room password")
          ? "密码错误"
          : joinError.message;
        alert("加入房间失败：" + message);
        return;
      }

      // Set basic room info
      setModuleInfo({
        title: room.title,
        description: room.description || "",
        notes: "",
      });
      setRoomType(room.type || "text");
      setRoomPassword("");
      setActiveCharId(charId);
      setIsKP(userIsKP);
      setKpId(room.kp_id);
      setBgMusicUrl(room.bg_music_url);
      setIsMusicPlaying(room.is_music_playing || false);
      setMusicTrackIndex(room.music_track_index || 0);

      setCurrentRoomId(roomId);

      // URL Persistence
      if (!isRestoring) {
        const url = new URL(window.location.href);
        url.searchParams.set("room", roomId);
        window.history.pushState({}, "", url);
      }

      // Load Characters in Room
      const { data: chars } = await fetchRoomCharacters(roomId);
      if (chars) {
        const mappedChars = chars.map(mapCharacterRow);
        setCharacters(mappedChars);

        // 发送进入房间的系统消息（仅在非恢复会话且有用户信息时）
        if (!isRestoring && user) {
          let enterMsg = "";
          // Fetch nickname for better UX
          const userName = (await fetchProfileNickname(user.id)) || "User";

          if (charId === "pc") {
            enterMsg = `${userName} (守秘人) 进入了房间`;
          } else {
            const myChar = mappedChars.find((c) => c.id === charId);
            if (myChar) {
              enterMsg = `${userName} (${myChar.name}) 进入了房间`;
            }
          }

          if (enterMsg) {
            const { error: msgError } = await addRoomSystemMessage(
              roomId,
              user.id,
              enterMsg,
              charId === "pc" ? null : charId
            );
            if (msgError)
              console.error("Failed to send enter message:", msgError);
          }
        }
      }
    }
  };

  const addLog = async (
    type: Log["type"],
    content: string,
    customCharId?: string,
    recipientId?: string | null,
    meta?: Record<string, any>
  ) => {
    if (!content.trim() || !currentRoomId || !session?.user) return;

    const targetId = customCharId || activeCharId;
    const isMainPC = targetId === "pc";
    // If it's 'pc' (KP), character_id is NULL; otherwise use UUID
    const characterId = isMainPC ? null : targetId;

    const { error } = await addMessage({
      roomId: currentRoomId,
      userId: session.user.id,
      characterId,
      type,
      content,
      recipientId,
      meta,
    });

    if (error) {
      console.error("Failed to send message:", error);
      // alert('消息发送失败'); // Silece network errors to improve UX
    }
  };

  // 新增 isSecret 参数
  const rollDice = (
    count: number,
    type: number,
    isSecret: boolean = false,
    checkInfo?: { name: string; target?: number }
  ) => {
    let total = 0;
    let details: number[] = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * type) + 1;
      total += roll;
      details.push(roll);
    }

    let resultData: any = { count, type, total, details };

    if (checkInfo) {
      resultData.checkName = checkInfo.name;

      if (checkInfo.target !== undefined && count === 1 && type === 100) {
        resultData.checkTarget = checkInfo.target;

        // Result Calculation (CoC 7th Style Simplification)
        // Critical Success: 1-5
        // Critical Failure: 96-100
        if (total <= 5) {
          resultData.checkResult = "critical_success";
        } else if (total >= 96) {
          resultData.checkResult = "critical_failure";
        } else if (total <= checkInfo.target) {
          resultData.checkResult = "success";
        } else {
          resultData.checkResult = "failure";
        }
      }
    }

    // 如果是暗骰，使用 'dice_secret' 类型
    const msgType = isSecret ? "dice_secret" : "dice";
    addLog(
      msgType as any,
      JSON.stringify(resultData),
      activeCharId === "pc" ? "pc" : activeCharId
    );

    return total;
  };

  const handleShowStory = async () => {
    if (!currentRoomId) return;

    setShowStoryModal(true);
    setIsGeneratingStory(true);
    setStoryContent("");

    try {
      let allMsgs: any[] = [];
      let page = 0;
      const BATCH_SIZE = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await fetchMessagesPage(
          currentRoomId,
          page,
          BATCH_SIZE
        );

        if (error) throw error;

        if (data && data.length > 0) {
          allMsgs = [...allMsgs, ...data];
          if (data.length < BATCH_SIZE) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      const formattedLogs = await mapMessagesToLogs(
        allMsgs,
        session?.user?.id
      );

      const story = buildStoryReport(formattedLogs);
      setStoryContent(story);
    } catch (e) {
      console.error("Error generating story:", e);
      setStoryContent("生成战报失败，请重试。");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await deleteMessage(messageId);
    if (error) {
      console.error("撤回消息失败:", error);
      alert("撤回消息失败: " + error.message);
    } else {
      // 本地删除 (Realtime 会处理，但本地删除更流畅)
      setLogs((prev) => prev.filter((log) => log.id !== messageId));
    }
  };

  // --- CRUD ---
  const handleDuplicateCharacter = async (char: Character) => {
    if (!currentRoomId || !session?.user) return;

    // Greek letters for suffixes
    const greekSuffixes = [
      "β",
      "γ",
      "δ",
      "ε",
      "ζ",
      "η",
      "θ",
      "ι",
      "κ",
      "λ",
      "μ",
      "ν",
      "ξ",
      "ο",
      "π",
      "ρ",
      "σ",
      "τ",
      "υ",
      "φ",
      "χ",
      "ψ",
      "ω",
    ];

    // 1. Determine base name (remove existing Greek suffix if any)
    let baseName = char.name;
    // Check if it ends with space + suffix
    for (const suffix of greekSuffixes) {
      if (baseName.endsWith(" " + suffix)) {
        baseName = baseName.substring(0, baseName.length - suffix.length - 1);
        break;
      }
      // Check if it ends with suffix + number (e.g. β2)
      // Regex approach might be cleaner but let's stick to simple logic for now
    }
    // Also handle the case where it might be "Name β2"
    // For simplicity, let's just strip everything after the last known suffix or just start fresh if needed.
    // Actually, let's use a regex to strip existing suffix pattern
    // Pattern: space + greek letter + optional number
    // e.g. " Goblin β", " Goblin β2"
    const suffixRegex = new RegExp(` (${greekSuffixes.join("|")})\\d*$`);
    const match = char.name.match(suffixRegex);
    if (match) {
      baseName = char.name.substring(0, match.index);
    }

    // 2. Find next available suffix
    const existingNames = new Set(characters.map((c) => c.name));
    let newName = "";

    // Try suffixes in order
    for (const suffix of greekSuffixes) {
      const candidate = `${baseName} ${suffix}`;
      if (!existingNames.has(candidate)) {
        newName = candidate;
        break;
      }
      // Also check numbered versions if simple suffix is taken?
      // Requirement says "add β... and so on".
      // It implies β, γ, δ...
      // If we run out of letters, we can loop or add numbers.
    }

    // If all single letters taken, try adding numbers to them?
    if (!newName) {
      // Fallback: Try β2, β3...
      let counter = 2;
      while (!newName) {
        const candidate = `${baseName} ${greekSuffixes[0]}${counter}`;
        if (!existingNames.has(candidate)) {
          newName = candidate;
        }
        counter++;
        if (counter > 100) break; // Safety break
      }
    }

    if (!newName) newName = `${baseName} Copy`; // Ultimate fallback

    const charData = buildCharacterMutationPayload(char, {
      roomId: currentRoomId,
      userId: session.user.id,
      name: newName,
      typeFallback: "monster",
    });

    try {
      const { data, error } = await createCharacter(charData);

      if (error) throw error;

      if (data) {
        // addLog("system", `守秘人 复制了 [${char.name}] -> [${newName}]`);
        // State update handled by Realtime subscription
      }
    } catch (error: any) {
      console.error("复制角色失败:", error);
      alert("复制失败: " + error.message);
    }
  };

  const handleSaveCharacter = async (char: Character) => {
    if (!currentRoomId || !session?.user) return;

    const charData = buildCharacterMutationPayload(char, {
      roomId: currentRoomId,
      userId: editingChar?.user_id || session.user.id,
      typeFallback: "investigator",
    });

    try {
      if (editingChar) {
        const { error } = await updateCharacter(char.id, charData);

        if (error) throw error;

        // Refetch to ensure we have the latest DB state (including server-side defaults or triggers)
        const { data: latestChar, error: fetchError } = await fetchCharacterById(char.id);

        if (latestChar && !fetchError) {
          const mappedLatest = mapCharacterRow({ ...char, ...latestChar });
          setCharacters((prev) =>
            prev.map((c) => (c.id === char.id ? mappedLatest : c))
          );
        } else {
          // Fallback to local update if fetch fails
          setCharacters((prev) =>
            prev.map((c) => (c.id === char.id ? { ...char, ...charData } : c))
          );
        }
        // addLog('system', `守秘人 更新了 [${char.name}] 的档案`);
      } else {
        const { data, error } = await createCharacter(charData);

        if (error) throw error;

        if (data) {
          const newChar = mapCharacterRow({ ...char, ...data });
          // OPTIMIZATION: Do NOT manually update state here if Realtime is active.
          // Realtime subscription will handle the UI update to avoid duplication race conditions.
          // However, Realtime might be slightly delayed.
          // To be safe and responsive: Check if ID exists before adding.
          setCharacters((prev) => {
            if (prev.some((c) => c.id === newChar.id)) return prev;
            return [...prev, newChar];
          });
        }
      }
      setShowCharModal(false);
      setEditingChar(null);
    } catch (error: any) {
      console.error("保存角色失败:", error);
      alert("保存失败: " + error.message);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!id) return;

    const { error } = await deleteCharacterRecord(id);

    if (error) {
      console.error("删除失败:", error);
      alert("删除失败: " + error.message);
    } else {
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      if (activeCharId === id) setActiveCharId("pc");
      setShowCharModal(false);
    }
  };

  const handleRemoveCharacter = async (id: string) => {
    if (!id || !currentRoomId || !session?.user) return;

    const char = characters.find((c) => c.id === id);
    if (!char) return;

    // 1. Update DB through membership RPC for player characters.
    if (char.user_id) {
      try {
        await kickRoomMember(currentRoomId, char.user_id);
      } catch (error: any) {
        console.error("移出失败:", error);
        alert("移出失败: " + error.message);
        return;
      }
    } else {
      const { error } = await removeCharacterFromRoom(id);

      if (error) {
        console.error("移出失败:", error);
        alert("移出失败: " + error.message);
        return;
      }
    }

    // 2. Send system message with kick signal
    if (char.user_id) {
      await addMessage({
        roomId: currentRoomId,
        userId: session.user.id,
        type: "system",
        content: `守秘人将 [${char.name}] 移出了房间`,
        meta: { type: "kick", userId: char.user_id },
      });
    }

    // 3. Local update
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    if (activeCharId === id) setActiveCharId("pc");
    setShowCharModal(false);
  };

  const handleUpdateStatus = async (hp: number, san: number, mp: number) => {
    if (!statusTargetId) return;
    const target = characters.find((c) => c.id === statusTargetId);
    if (!target) return;

    const newStats = {
      str: target.str,
      con: target.con,
      siz: target.siz,
      dex: target.dex,
      app: target.app,
      int: target.int,
      pow: target.pow,
      edu: target.edu,
      luck: target.luck,
      hp: hp,
      san: san,
      mp: mp,
      skills: target.skills || {},
    };

    const { error } = await saveCharacterStats(target.id, newStats);

    if (error) {
      alert("状态更新失败");
      return;
    }

    const changes = [];
    if (hp !== target.hp)
      changes.push(`HP ${hp > target.hp ? "+" : ""}${hp - target.hp}`);
    if (san !== target.san)
      changes.push(`SAN ${san > target.san ? "+" : ""}${san - target.san}`);
    if (mp !== target.mp)
      changes.push(`MP ${mp > target.mp ? "+" : ""}${mp - target.mp}`);

    if (changes.length > 0) {
      setCharacters((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, hp, san, mp } : c))
      );
      addLog(
        "status",
        `${target.name} 状态变更: ${changes.join(", ")}`,
        target.id
      );
    }
    setShowStatusModal(false);
    setStatusTargetId(null);
  };

  const handleDeleteRoom = async () => {
    if (!currentRoomId) return;
    const { error } = await deleteRoom(currentRoomId);
    if (!error) {
      // ✅ Clean reset
      setCharacters([]);
      setLogs([]);
      setModuleInfo(EMPTY_MODULE_INFO);
      setCurrentRoomId(null);
      setIsKP(false);
      setActiveCharId("pc");
      setView("main");
    } else {
      alert("删除房间失败: " + error.message);
    }
  };

  const handleClearChat = async () => {
    if (!currentRoomId) return;

    const { error } = await deleteRoomMessages(currentRoomId);

    if (error) {
      console.error("清空聊天记录失败:", error);
      alert("清空聊天记录失败: " + error.message);
    } else {
      // Locally clear logs immediately for better UX
      setLogs([]);
      addLog("system", "守秘人已清空聊天记录");
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
    if (!currentRoomId || !isKP) return;

    try {
      const { error } = await concludeRoom(currentRoomId, outcomes);

      if (error) throw error;

      // Success
      alert("结团成功！房间已归档。");
      setShowConclusionModal(false);

      // Navigate back to home
      setCurrentRoomId(null);
      setCharacters([]);
      setLogs([]);
      setModuleInfo(EMPTY_MODULE_INFO);
      setIsKP(false);
      setActiveCharId("pc");
      setView("main");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error: any) {
      console.error("Error concluding game:", error);
      alert("结团失败: " + error.message);
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
      setCurrentRoomId(null);
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const updateCharacterStats = async (
    charId: string,
    changes: { stat: string; value: number; type: "=" | "+" | "-" }[]
  ) => {
    const target = characters.find((c) => c.id === charId);
    if (!target) return;

    // Use stats object, or fallback to top-level properties if stats is missing/empty
    const currentStats = target.stats || {
      str: target.str,
      con: target.con,
      siz: target.siz,
      dex: target.dex,
      app: target.app,
      int: target.int,
      pow: target.pow,
      edu: target.edu,
      luck: target.luck,
      hp: target.hp,
      san: target.san,
      mp: target.mp,
    };

    const newStats: any = { ...currentStats };

    const logChanges: string[] = [];

    changes.forEach((change) => {
      const key = resolveStatAlias(change.stat);
      // We only support updating stats present in the stats object for now
      if (newStats[key] !== undefined) {
        let current = newStats[key] || 0;
        let newValue = change.value;
        if (change.type === "+") newValue = current + change.value;
        if (change.type === "-") newValue = current - change.value;

        newStats[key] = newValue;
        logChanges.push(
          `${change.stat.toUpperCase()} ${current} -> ${newValue}`
        );
      }
    });

    if (logChanges.length === 0) return;

    const { error } = await saveCharacterStats(charId, newStats);

    if (!error) {
      addLog("system", `[${target.name}] 属性变更: ${logChanges.join(", ")}`);
    }
  };

  const handleSanityCheck = async (
    successExpr: string,
    failureExpr: string,
    currentSanVal?: number
  ) => {
    if (activeCharId === "pc") {
      addLog("system", "守秘人无法进行理智检定");
      return;
    }
    const char = characters.find((c) => c.id === activeCharId);
    if (!char) return;

    const currentSan = currentSanVal !== undefined ? currentSanVal : char.san;

    // 1. Roll 1d100
    const roll = Math.floor(Math.random() * 100) + 1;
    const isSuccess = roll <= currentSan;

    let checkResult = "failure";
    if (roll <= 5) checkResult = "critical_success"; // 大成功 1-5
    else if (roll >= 96) checkResult = "critical_failure"; // 大失败 96-100
    else if (isSuccess) checkResult = "success";

    // 2. Roll loss
    const lossExpr = isSuccess ? successExpr : failureExpr;
    let loss = 0;
    let lossDetails = "";

    if (/^\d+$/.test(lossExpr)) {
      loss = parseInt(lossExpr);
      lossDetails = lossExpr;
    } else {
      const match = lossExpr.match(/^(\d+)d(\d+)$/i);
      if (match) {
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const details = [];
        for (let i = 0; i < count; i++) {
          const r = Math.floor(Math.random() * sides) + 1;
          loss += r;
          details.push(r);
        }
        lossDetails = `${lossExpr}(${details.join("+")})=${loss}`;
      } else {
        // Fallback for unparsed or 0
        loss = 0;
        lossDetails = "0";
      }
    }

    // Construct Dice Log
    const resultData = {
      count: 1,
      type: 100,
      total: roll,
      details: [roll],
      checkName: "Sanity Check",
      checkTarget: currentSan,
      checkResult: checkResult,
    };

    addLog("dice", JSON.stringify(resultData), activeCharId);

    setTimeout(() => {
      const resultMsg = isSuccess
        ? `SC成功! 减少 ${lossDetails} 点理智`
        : `SC失败! 减少 ${lossDetails} 点理智`;

      const newSan = currentSan - loss;
      addLog("system", `[${char.name}] ${resultMsg}，当前 SAN: ${newSan}`);

      if (loss > 0) {
        updateCharacterStats(char.id, [
          { stat: "san", value: loss, type: "-" },
        ]);
      }
    }, 500);
  };

  const handleCommand = (
    cmd: any,
    _originalText: string,
    recipientId?: string | null
  ) => {
    switch (cmd.type) {
      case "help":
        addLog(
          "system",
          `🎲 指令帮助
────────────────
.r  [表达式] [原因]
    投掷骰子 (例: .r 1d100 侦查)

.rh [表达式] [原因]
    暗骰 (仅KP可用)

.ra [技能] [修正]
    技能检定 (例: .ra 侦查 +20)

.sc [成功]/[失败] [当前San]
    理智检定 (例: .sc 1/1d4)

.st [属性][操作符][值]
    修改属性 (例: .st hp-1)`,
          undefined,
          recipientId
        );
        break;
      case "roll":
      case "roll_hidden":
        if (cmd.type === "roll_hidden" && !isKP) {
          addLog("system", "只有守秘人可以使用暗骰 (.rh)");
          return;
        }

        if (cmd.payload.expression) {
          const char = characters.find((c) => c.id === activeCharId);
          const { total, details } = evaluateDiceExpression(
            cmd.payload.expression,
            char
          );
          const resultData = {
            count: 0,
            type: 0,
            total: total,
            details: details,
            expression: `${cmd.payload.expression} = ${total}`,
            checkName: cmd.payload.reason,
          };
          const msgType = cmd.type === "roll_hidden" ? "dice_secret" : "dice";
          addLog(
            msgType as any,
            JSON.stringify(resultData),
            activeCharId === "pc" ? "pc" : activeCharId
          );
        } else {
          // Fallback logic shouldn't be reached if parser works correctly
          rollDice(
            cmd.payload.count,
            cmd.payload.sides,
            cmd.type === "roll_hidden",
            { name: cmd.payload.reason }
          );
        }
        break;
      case "check":
        // Find skill
        const charToCheck = characters.find((c) => c.id === activeCharId);
        let checkTarget = 0;
        let checkName = "";

        if (cmd.payload.targetExpression) {
          // Case 1: Expression Target (e.g. .ra 3d6+力量)
          const { total } = evaluateDiceExpression(
            cmd.payload.targetExpression,
            charToCheck
          );
          checkTarget = total;
          checkName = cmd.payload.targetExpression;
        } else if (cmd.payload.skill) {
          // Case 2: Skill [+ Modifier] (e.g. .ra 力量 +10)
          const skillName = cmd.payload.skill;
          let baseVal = 0;

          if (charToCheck) {
            if (
              charToCheck.skills &&
              charToCheck.skills[skillName] !== undefined
            ) {
              baseVal = charToCheck.skills[skillName];
            } else if (charToCheck.stats) {
              const key = resolveStatAlias(skillName);
              if (charToCheck.stats[key] !== undefined) {
                baseVal = charToCheck.stats[key];
              }
            }
          }

          if (cmd.payload.modifier) {
            const modStr = cmd.payload.modifier;
            const { total: modVal } = evaluateDiceExpression(
              modStr,
              charToCheck
            );

            // Determine if modifier is relative or absolute
            // If it starts with + or -, or is an expression like "1d4" (which we treat as additive usually? No, "1d4" usually means +1d4 in this context)
            // But if user types ".ra 力量 50" (space 50), it means target=50.
            // If user types ".ra 力量 +50", it means target=base+50.

            // Check original string for leading operator
            const isRelative = /^[\+\-\*\/]/.test(modStr.trim());

            if (isRelative) {
              // evaluateDiceExpression result includes the sign if expression was "+10" -> eval("+10") -> 10.
              // But we need to add to base.
              // Wait, eval("+10") is 10. eval("-10") is -10.
              // So target = base + modVal is correct for both cases.
              checkTarget = baseVal + modVal;
              checkName = `${skillName} ${modStr}`;
            } else {
              // Absolute (e.g. "50" or "3d6" without plus)
              // If user types ".ra 力量 3d6", it likely means target is result of 3d6.
              checkTarget = modVal;
              checkName = `${skillName} ${modStr}`;
            }
          } else {
            checkTarget = baseVal;
            checkName = skillName;
          }
        }

        rollDice(1, 100, false, {
          name: checkName,
          target: checkTarget,
        });
        break;
      case "sanity":
        handleSanityCheck(
          cmd.payload.success,
          cmd.payload.failure,
          cmd.payload.value
        );
        break;
      case "set":
        if (activeCharId !== "pc") {
          updateCharacterStats(activeCharId, cmd.payload);
        } else {
          addLog("system", "守秘人没有属性可以修改");
        }
        break;
      case "error":
        addLog("system", `指令错误: ${cmd.payload}`);
        break;
    }
  };

  const handleSend = (
    text: string,
    recipientId?: string | null,
    type?: Log["type"],
    quote?: { id: string; content: string; charName: string }
  ) => {
    const command = parseDiceCommand(text);
    if (command) {
      handleCommand(command, text, recipientId);
    } else {
      addLog(
        type || "normal",
        text,
        undefined,
        recipientId,
        quote ? { quote } : undefined
      );
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoomId || !session?.user) {
      doLeaveCleanup();
      return;
    }

    // Send system message before leaving
    const {
      error: userError,
      data: { user },
    } = await getCurrentUser();
    if (user && !userError) {
      let leaveMsg = "";

      if (isKP) {
        // KP leaving: Always show KP name + (守秘人), regardless of active character
        leaveMsg = `${userNickname || "守秘人"} (守秘人) 离开了房间`;
      } else {
        // Player leaving
        if (activeCharId === "pc") {
          // Should rarely happen for players, but fallback
          leaveMsg = `${userNickname || "玩家"} 离开了房间`;
        } else {
          const myChar = characters.find((c) => c.id === activeCharId);
          if (myChar) {
            leaveMsg = `${userNickname || "某人"} (${myChar.name}) 离开了房间`;
          }
        }
      }

      if (leaveMsg) {
        const { error: msgError } = await addMessage({
          roomId: currentRoomId,
          userId: user.id,
          characterId: !isKP && activeCharId !== "pc" ? activeCharId : null,
          type: "system",
          content: leaveMsg,
        });
        if (msgError) console.error("Failed to send leave message:", msgError);
      }
    }

    // If active char is not PC/KP, remove room_id from character
    // FIX: KP's characters (NPC/Monster) should NOT be removed from room when KP leaves
    // MODIFIED: Per user request, do NOT remove room_id when player leaves.
    // It stays bound until they join a new room or are kicked by KP.

    doLeaveCleanup();
  };

  const doLeaveCleanup = useCallback(() => {
    // ✅ Clean reset
    setCurrentRoomId(null);
    setCharacters([]);
    setLogs([]);
    setModuleInfo(EMPTY_MODULE_INFO);
    setIsKP(false);
    setActiveCharId("pc");
    setBgMusicUrl(null);
    setOnlineUsers(new Set());
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useRoomRealtime({
    currentRoomId,
    userId: session?.user?.id,
    userNickname,
    pageSize: PAGE_SIZE,
    charactersRef,
    setCharacters,
    setLogs,
    setHasMoreLogs,
    setModuleInfo,
    setBgMusicUrl,
    setIsMusicPlaying,
    setMusicTrackIndex,
    setOnlineUsers,
    onKicked: doLeaveCleanup,
    onRoomDeleted: doLeaveCleanup,
  });

  const handleUpdateMusic = async (url: string) => {
    if (!currentRoomId || !isKP) return;
    const { error } = await updateRoomMusicUrl(currentRoomId, url);
    if (error) {
      console.error("Failed to update background music:", error);
      alert(`更新背景音乐失败: ${error.message || JSON.stringify(error)}`);
    }
  };

  const hasWarnedSchemaRef = useRef(false);

  const handleUpdateMusicState = async (
    isPlaying: boolean,
    trackIndex: number
  ) => {
    if (!currentRoomId || !isKP) return;
    const { error } = await updateRoomMusicState(
      currentRoomId,
      isPlaying,
      trackIndex
    );

    if (error) {
      console.error("Failed to update music state:", error);
      if (error.code === "PGRST204") {
        console.warn(
          "PGRST204 Error: The 'is_music_playing' column is missing in Supabase schema cache. Please reload the schema cache in Supabase Dashboard."
        );
        if (!hasWarnedSchemaRef.current) {
          alert(
            "【系统警告】检测到数据库配置未同步，背景音乐同步功能失效。\n请前往 Supabase 后台刷新 Schema Cache (Settings -> API -> Reload schema cache)。"
          );
          hasWarnedSchemaRef.current = true;
        }
      }
    }
  };

  const derivedCharacters = characters.map((c) => ({
    ...c,
    isOnline: c.user_id ? onlineUsers.has(c.user_id) : false,
  }));

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

  if (!session) {
    return <Login />;
  }

  if (!currentRoomId) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Home
          onJoinRoom={handleJoinRoom}
          onLogout={handleSignOut}
          onlineUsers={globalOnlineUsers}
          levelInfo={levelInfo}
        />
      </Suspense>
    );
  }

  const appContent = (
    <Suspense fallback={<LoadingScreen />}>
      <div className="flex h-screen text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden bg-[#020617]">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-900/20 rounded-full blur-[100px] animate-blob"></div>
        <div
          className="absolute bottom-[10%] right-[-5%] w-[30rem] h-[30rem] bg-indigo-900/10 rounded-full blur-[120px] animate-blob"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-[40%] left-[30%] w-72 h-72 bg-slate-800/20 rounded-full blur-[80px] animate-blob"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        view={view}
        setView={setView}
        activeCharId={activeCharId}
        setActiveCharId={setActiveCharId}
        characters={derivedCharacters}
        onOpenStatusEdit={(id) => {
          setStatusTargetId(id);
          setShowStatusModal(true);
        }}
        isMobile={isMobile}
        isKP={isKP}
        kpOnline={kpId ? onlineUsers.has(kpId) : false}
        userNickname={userNickname}
        roomType={token ? roomType : "text"}
        isVoiceConnected={!!token}
      />

      <main className="flex-1 flex flex-col relative min-w-0 z-10">
        <header className="h-16 shrink-0 pt-safe flex items-center justify-between px-4 md:px-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-20 bg-slate-900/80 md:bg-transparent">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-white md:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="flex flex-col justify-center">
              <h1 className="text-white font-bold text-lg md:text-xl tracking-tight">
                {moduleInfo.title || "未命名模组"}
              </h1>
              <p className="text-xs text-slate-500 truncate max-w-[150px] md:max-w-md mt-1">
                {moduleInfo.description || "暂无描述"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {roomType !== "voice" && (
              <Button
                variant="ghost"
                size={isMobile ? "icon" : "sm"}
                icon={globalMute ? VolumeX : Volume2}
                onClick={() => setGlobalMute(!globalMute)}
                title={globalMute ? "取消静音" : "静音"}
              >
                {!isMobile && (globalMute ? "已静音" : "静音")}
              </Button>
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

        {view !== "setup" && view !== "music" ? (
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
              onLoadMore={handleLoadMoreLogs}
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
            moduleInfo={moduleInfo}
            characters={derivedCharacters}
            onEditModule={() => setShowModuleModal(true)}
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
            onDeleteRoom={handleDeleteRoom}
            onClearChat={handleClearChat}
            onConcludeGame={() => setShowConclusionModal(true)}
            isKP={isKP}
          />
        ) : null}

        {/* Music Player (Persistent) */}
        <MusicPlayer
          url={bgMusicUrl}
          isKP={isKP}
          onUpdateUrl={handleUpdateMusic}
          mode={view === "music" ? "sidebar" : "fixed"}
          className={
            view === "music" ? "absolute inset-0 z-10 bg-slate-900 pt-16" : ""
          }
          isMobile={isMobile}
          isHidden={view === "setup" || roomType === "voice"}
          globalMute={globalMute}
          syncedIsPlaying={isMusicPlaying}
          syncedTrackIndex={musicTrackIndex}
          onUpdateSyncState={handleUpdateMusicState}
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
            if (!currentRoomId) return;
            const updates: any = {
              title: info.title,
              description: info.description,
            };
            const { error } = await updateRoomModule(currentRoomId, updates);

            if (error) {
              alert("保存失败: " + error.message);
            } else {
              if (password !== undefined) {
                try {
                  await saveRoomPassword(currentRoomId, password);
                } catch (passwordError: any) {
                  alert("Password save failed: " + passwordError.message);
                  return;
                }
              }
              // Local update for immediate feedback (Realtime will also trigger)
              setModuleInfo(info);
              if (password !== undefined) setRoomPassword(password);
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
          readOnly={!isKP && editingChar?.user_id !== session.user.id} // 增加只读保护
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
        audio={false}
        video={false}
        data-lk-theme="default"
        onDisconnected={handleLeaveRoom}
        onError={(error) => {
          console.error("LiveKit Error:", error);
          // 可以在这里处理全局错误，或者让组件自己处理
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
