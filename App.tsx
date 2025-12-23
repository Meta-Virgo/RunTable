import React, { useState, useEffect, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Login } from "./components/Login";
import { Home } from "./components/Home";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { Dashboard } from "./components/Dashboard";
import {
  ModuleModal,
  CharacterModal,
  StatusModal,
  StoryModal,
} from "./components/Modals";
import { Button } from "./components/UI";
import { ModuleInfo, Character, Log } from "./types"; // Removed AppData as it might not be used anymore
import { Menu, LogOut } from "lucide-react";

// --- Constants ---
const INITIAL_CHAR_STATE: Character = {
  id: "",
  name: "",
  role: "调查员",
  type: "investigator",
  avatar_url: null,
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
  backstory: "",
  skills: {},
};

const EMPTY_MODULE_INFO: ModuleInfo = { title: "", description: "", notes: "" };

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Application State
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [view, setView] = useState("main");

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
  const [userNickname, setUserNickname] = useState<string>("");
  const [isVip, setIsVip] = useState(false);

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

  // Characters Ref for Realtime (Refs are needed to access latest state inside listeners)
  const charactersRef = useRef(characters);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  // Auth Check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      // Fetch nickname and VIP status
      if (session?.user) {
        supabase
          .from("profiles")
          .select("nickname, is_vip")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              if (data.nickname) setUserNickname(data.nickname);
              setIsVip(!!data.is_vip);
            }
          });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Fetch nickname and VIP status on auth change
      if (session?.user) {
        supabase
          .from("profiles")
          .select("nickname, is_vip")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              if (data.nickname) setUserNickname(data.nickname);
              setIsVip(!!data.is_vip);
            }
          });
      }
    });

    return () => subscription.unsubscribe();
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
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (error || !room) {
        // Invalid room, clear URL
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }

      setKpId(room.kp_id);

      // Clear URL to keep lobby clean on refresh, per your requirement
      window.history.replaceState(null, "", window.location.pathname);
    };

    if (!authLoading && !currentRoomId) {
      restoreSession();
    }
  }, [session, authLoading]);

  // =========================================================================
  //  ⚡️ Core Logic: Fetching & Realtime
  // =========================================================================
  useEffect(() => {
    if (!currentRoomId || !session?.user) return;

    // Fetch characters (Add this to ensure characters are loaded on restore/join)
    const fetchCharacters = async () => {
      const { data: chars } = await supabase
        .from("characters")
        .select("*")
        .eq("room_id", currentRoomId);
      if (chars) {
        const mappedChars = chars.map((c) => ({
          ...c,
          role: c.role || "调查员",
          avatar_url: c.avatar_url,
          job: c.info?.job || "",
          age: c.info?.age || "",
          sex: c.info?.sex || "",
          notes: c.info?.notes || "",
          backstory: c.info?.backstory || "",
          skills: c.info?.skills || c.stats?.skills || {},
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
        }));
        setCharacters(mappedChars);
      }
    };
    fetchCharacters();

    // Fetch history
    const fetchMessages = async () => {
      // 1. Get Messages with Join Query (一次性拿到角色名和昵称)
      const { data: msgs, error: msgError } = await supabase
        .from("messages")
        .select(
          `
                    *,
                    characters ( id, name, type, role, info, theme_color, avatar_url )
                `
        )
        .eq("room_id", currentRoomId)
        .order("created_at", { ascending: true });

      if (msgError) {
        console.error("Error fetching messages:", msgError);
        // return; // Don't return here, so we can try to render what we have or retry
      }

      if (msgs && msgs.length > 0) {
        // 1.5 Fetch Profiles manually for OOC messages
        const userIds = Array.from(new Set(msgs.map((m: any) => m.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

        // 2. Map to Logs using joined data
        const formattedLogs: Log[] = msgs.map((msg: any) => {
          // Logic: Character Name > Profile Nickname > '守秘人'
          const charName = msg.characters
            ? msg.characters.name
            : profileMap.get(msg.user_id)?.nickname || "守秘人";
          const charAvatar = msg.characters
            ? msg.characters.avatar_url
            : profileMap.get(msg.user_id)?.avatar_url;
          // Logic: Character Role > 'Keeper'
          let charRole = "Keeper";
          if (msg.characters) {
            // Use DB role column, fallback to type mapping if empty
            charRole =
              msg.characters.role ||
              (msg.characters.type === "investigator"
                ? "调查员"
                : msg.characters.type === "monster"
                ? "怪物"
                : "NPC");
          }

          return {
            id: msg.id,
            timestamp: new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            charId: msg.character_id || "pc",
            charName: charName,
            charRole: charRole,
            charAvatar: charAvatar,
            type: msg.type as Log["type"],
            content: msg.content,
            isMine: msg.user_id === session.user.id,
            recipientId: msg.recipient_id,
            quote: msg.meta?.quote,
          };
        });
        setLogs(formattedLogs);
      } else {
        setLogs([]);
      }
    };
    fetchMessages();

    // Subscribe to new messages & Presence
    const channel = supabase
      .channel(`room:${currentRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${currentRoomId}`,
        },
        async (payload) => {
          const msg = payload.new;

          // Check for kick signal
          if (
            msg.type === "system" &&
            msg.meta?.type === "kick" &&
            msg.meta?.userId === session.user.id
          ) {
            alert("你已被移出房间");
            doLeaveCleanup();
            return;
          }

          // Need to fetch metadata because Realtime payload is raw
          let charName = "守秘人";
          let charRole = "Keeper";
          let charAvatar: string | null = null;

          // 1. Try local cache
          const localChar = charactersRef.current.find(
            (c) => c.id === msg.character_id
          );

          if (localChar) {
            charName = localChar.name;
            charRole = localChar.role;
            charAvatar = localChar.avatar_url || null;
          } else if (msg.character_id) {
            // 2. Fetch from DB if not in local list
            const { data: char } = await supabase
              .from("characters")
              .select("name, role, avatar_url")
              .eq("id", msg.character_id)
              .single();
            if (char) {
              charName = char.name;
              charRole = char.role;
              charAvatar = char.avatar_url;
            }
          } else {
            // 3. Fetch user nickname if it's an OOC message
            const { data: profile } = await supabase
              .from("profiles")
              .select("nickname, avatar_url")
              .eq("id", msg.user_id)
              .single();
            if (profile) {
              charName = profile.nickname || "玩家";
              charAvatar = profile.avatar_url;
            }
          }

          const newLog: Log = {
            id: msg.id,
            timestamp: new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            charId: msg.character_id || "pc",
            charName,
            charRole,
            charAvatar,
            type: msg.type as Log["type"],
            content: msg.content,
            isMine: msg.user_id === session.user.id,
            quote: msg.meta?.quote,
          };

          setLogs((prev) => {
            if (prev.some((l) => l.id === newLog.id)) return prev;
            return [...prev, newLog];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "characters",
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          const newChar = payload.new as any;
          // Check if already exists to avoid dupes
          setCharacters((prev) => {
            if (prev.find((c) => c.id === newChar.id)) return prev;

            const mappedChar: Character = {
              id: newChar.id,
              user_id: newChar.user_id,
              room_id: newChar.room_id,
              name: newChar.name,
              type: newChar.type,
              avatar_url: newChar.avatar_url,
              role:
                newChar.role ||
                (newChar.type === "investigator"
                  ? "调查员"
                  : newChar.type === "monster"
                  ? "怪物"
                  : "NPC"),
              job: newChar.info?.job || "",
              age: newChar.info?.age || "",
              sex: newChar.info?.sex || "",
              notes: newChar.info?.notes || "",
              backstory: newChar.info?.backstory || "",
              skills: newChar.info?.skills || newChar.stats?.skills || {},
              str: newChar.stats?.str || 50,
              con: newChar.stats?.con || 50,
              siz: newChar.stats?.siz || 50,
              dex: newChar.stats?.dex || 50,
              app: newChar.stats?.app || 50,
              int: newChar.stats?.int || 50,
              pow: newChar.stats?.pow || 50,
              edu: newChar.stats?.edu || 50,
              luck: newChar.stats?.luck || 50,
              hp: newChar.stats?.hp || 10,
              san: newChar.stats?.san || 50,
              mp: newChar.stats?.mp || 10,
            };
            return [...prev, mappedChar];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "characters",
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          const newChar = payload.new as any;

          // 检查角色是否已存在于当前列表中
          const exists = charactersRef.current.some((c) => c.id === newChar.id);

          if (exists) {
            // 如果存在，更新信息
            setCharacters((prev) =>
              prev.map((c) => {
                if (c.id === newChar.id) {
                  // Handle potential partial updates and JSON parsing
                  const safeInfo =
                    typeof newChar.info === "string"
                      ? JSON.parse(newChar.info)
                      : newChar.info || c.info || {};

                  const safeStats =
                    typeof newChar.stats === "string"
                      ? JSON.parse(newChar.stats)
                      : newChar.stats || c.stats || {};

                  return {
                    ...c,
                    name: newChar.name !== undefined ? newChar.name : c.name,
                    type: newChar.type !== undefined ? newChar.type : c.type,
                    avatar_url:
                      newChar.avatar_url !== undefined
                        ? newChar.avatar_url
                        : c.avatar_url,
                    role:
                      newChar.role !== undefined
                        ? newChar.role
                        : newChar.type !== undefined
                        ? newChar.type === "investigator"
                          ? "调查员"
                          : newChar.type === "monster"
                          ? "怪物"
                          : "NPC"
                        : c.role,

                    // Update mapped fields from info
                    job: safeInfo.job !== undefined ? safeInfo.job : c.job,
                    age: safeInfo.age !== undefined ? safeInfo.age : c.age,
                    sex: safeInfo.sex !== undefined ? safeInfo.sex : c.sex,
                    notes:
                      safeInfo.notes !== undefined ? safeInfo.notes : c.notes,
                    backstory:
                      safeInfo.backstory !== undefined
                        ? safeInfo.backstory
                        : c.backstory,
                    skills:
                      safeInfo.skills || safeStats.skills || c.skills || {},

                    // Update mapped fields from stats
                    str: safeStats.str !== undefined ? safeStats.str : c.str,
                    con: safeStats.con !== undefined ? safeStats.con : c.con,
                    siz: safeStats.siz !== undefined ? safeStats.siz : c.siz,
                    dex: safeStats.dex !== undefined ? safeStats.dex : c.dex,
                    app: safeStats.app !== undefined ? safeStats.app : c.app,
                    int: safeStats.int !== undefined ? safeStats.int : c.int,
                    pow: safeStats.pow !== undefined ? safeStats.pow : c.pow,
                    edu: safeStats.edu !== undefined ? safeStats.edu : c.edu,
                    luck:
                      safeStats.luck !== undefined ? safeStats.luck : c.luck,
                    hp: safeStats.hp !== undefined ? safeStats.hp : c.hp,
                    san: safeStats.san !== undefined ? safeStats.san : c.san,
                    mp: safeStats.mp !== undefined ? safeStats.mp : c.mp,

                    room_id:
                      newChar.room_id !== undefined
                        ? newChar.room_id
                        : c.room_id,
                    user_id:
                      newChar.user_id !== undefined
                        ? newChar.user_id
                        : c.user_id,

                    // Preserve raw objects for future reference
                    info: safeInfo,
                    stats: safeStats,
                  };
                }
                return c;
              })
            );
          } else {
            // 如果不存在（说明是通过 UPDATE 进入房间的），当作新角色添加
            const mappedChar: Character = {
              id: newChar.id,
              user_id: newChar.user_id,
              room_id: newChar.room_id,
              name: newChar.name,
              type: newChar.type,
              avatar_url: newChar.avatar_url,
              role:
                newChar.role ||
                (newChar.type === "investigator"
                  ? "调查员"
                  : newChar.type === "monster"
                  ? "怪物"
                  : "NPC"),
              job: newChar.info?.job || "",
              age: newChar.info?.age || "",
              sex: newChar.info?.sex || "",
              notes: newChar.info?.notes || "",
              backstory: newChar.info?.backstory || "",
              skills: newChar.info?.skills || newChar.stats?.skills || {},
              str: newChar.stats?.str || 50,
              con: newChar.stats?.con || 50,
              siz: newChar.stats?.siz || 50,
              dex: newChar.stats?.dex || 50,
              app: newChar.stats?.app || 50,
              int: newChar.stats?.int || 50,
              pow: newChar.stats?.pow || 50,
              edu: newChar.stats?.edu || 50,
              luck: newChar.stats?.luck || 50,
              hp: newChar.stats?.hp || 10,
              san: newChar.stats?.san || 50,
              mp: newChar.stats?.mp || 10,
            };
            setCharacters((prev) => [...prev, mappedChar]);
          }
        }
      )
      // Listen for Message Deletion
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          setLogs((prev) => prev.filter((l) => l.id !== deletedId));
        }
      )
      // Listen for Room Deletion/Update
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${currentRoomId}`,
        },
        () => {
          // Room deleted by owner (or someone else), just cleanup locally
          alert("房间已被房主解散");
          doLeaveCleanup();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${currentRoomId}`,
        },
        (payload) => {
          const newRoom = payload.new as any;
          setModuleInfo((prev) => ({
            ...prev,
            title: newRoom.title !== undefined ? newRoom.title : prev.title,
            description:
              newRoom.description !== undefined
                ? newRoom.description
                : prev.description,
          }));
        }
      )
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const userIds = new Set<string>();
        for (const id in newState) {
          (newState[id] as any[]).forEach((p) => {
            if (p.user_id) userIds.add(p.user_id);
          });
        }
        setOnlineUsers(userIds);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: session.user.id,
            nickname: userNickname || "User",
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoomId, session, userNickname]);

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
    isRestoring = false
  ) => {
    // Fetch Room Data
    const { data: room } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    if (room) {
      // Permission Check
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userIsKP = user?.id === room.kp_id;

      if (!charId) {
        alert("请先选择角色！");
        return;
      }

      if (charId === "pc" && !userIsKP) {
        alert("权限不足：只有房主才能以守秘人身份进入！");
        return;
      }

      // Set basic room info
      setModuleInfo({
        title: room.title,
        description: room.description || "",
        notes: "",
      });
      setRoomPassword(room.password || "");
      setCurrentRoomId(roomId);
      setActiveCharId(charId);
      setIsKP(userIsKP);
      setKpId(room.kp_id);

      // URL Persistence
      if (!isRestoring) {
        const url = new URL(window.location.href);
        url.searchParams.set("room", roomId);
        window.history.pushState({}, "", url);
      }

      // If joining as character, update character's room_id
      if (charId !== "pc" && user) {
        const { data: updatedChar, error } = await supabase
          .from("characters")
          .update({
            room_id: roomId,
            user_id: user.id,
          })
          .eq("id", charId)
          .select();

        if (error) {
          console.error("Failed to update character room:", error);
          alert("加入房间失败：无法更新角色信息");
          return;
        }

        if (!updatedChar || updatedChar.length === 0) {
          console.error("Character update returned no rows. ID:", charId);
          alert("加入房间失败：找不到该角色或无权操作");
          return;
        }
      }

      // Load Characters in Room
      const { data: chars } = await supabase
        .from("characters")
        .select("*")
        .eq("room_id", roomId);
      if (chars) {
        const mappedChars = chars.map((c) => ({
          ...c,
          role: c.role || "调查员",
          avatar_url: c.avatar_url,
          job: c.info?.job || "",
          age: c.info?.age || "",
          sex: c.info?.sex || "",
          notes: c.info?.notes || "",
          backstory: c.info?.backstory || "",
          skills: c.info?.skills || c.stats?.skills || {},
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
        }));
        setCharacters(mappedChars);

        // 发送进入房间的系统消息（仅在非恢复会话且有用户信息时）
        if (!isRestoring && user) {
          let enterMsg = "";
          // Fetch nickname for better UX
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", user.id)
            .single();
          const userName = profile?.nickname || "某人";

          if (charId === "pc") {
            enterMsg = `${userName} (守秘人) 进入了房间`;
          } else {
            const myChar = mappedChars.find((c) => c.id === charId);
            if (myChar) {
              enterMsg = `${userName} (${myChar.name}) 进入了房间`;
            }
          }

          if (enterMsg) {
            const { error: msgError } = await supabase.from("messages").insert({
              room_id: roomId,
              user_id: user.id,
              type: "system",
              content: enterMsg,
            });
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

    const { error } = await supabase.from("messages").insert({
      room_id: currentRoomId,
      user_id: session.user.id,
      character_id: characterId,
      type: type,
      content: content,
      recipient_id: recipientId || null,
      meta: meta || {},
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
    checkInfo?: { name: string; target: number }
  ) => {
    let total = 0;
    let details: number[] = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * type) + 1;
      total += roll;
      details.push(roll);
    }

    let resultData: any = { count, type, total, details };

    if (checkInfo && count === 1 && type === 100) {
      resultData.checkName = checkInfo.name;
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

    // 如果是暗骰，使用 'dice_secret' 类型
    const msgType = isSecret ? "dice_secret" : "dice";
    addLog(
      msgType as any,
      JSON.stringify(resultData),
      activeCharId === "pc" ? "pc" : activeCharId
    );
  };

  const generateStory = () => {
    if (logs.length === 0) return "暂无记录。";
    return logs
      .filter((log) => {
        // 过滤掉不必要的系统消息
        if (log.type === "system") {
          if (log.content.includes("已清空聊天记录")) return false;
          if (log.content.includes("进入了房间")) return false;
          if (log.content.includes("离开了房间")) return false;
        }
        return true;
      })
      .map((log) => {
        // Handle name display: replace nickname with "守秘人" if role is Keeper
        const displayName = log.charRole === "Keeper" ? "守秘人" : log.charName;

        if (log.type === "dice" || log.type === "dice_secret") {
          try {
            const d = JSON.parse(log.content);
            const prefix = log.type === "dice_secret" ? "(暗骰) " : "";
            return `> [${displayName}] ${prefix}投掷了 ${d.count}D${
              d.type || 6
            }: ${d.total} [${d.details.join(", ")}]`;
          } catch (e) {
            return `> [${displayName}] ${log.content}`;
          }
        }
        if (["system", "status"].includes(log.type))
          return `> [${displayName}] ${log.content}`;

        if (log.type === "image") {
          return `${displayName}: [图片]`;
        }

        // Remove markdown symbols like **
        const cleanContent = log.content.replace(/\*\*/g, "");
        return `${displayName}: ${cleanContent}`;
      })
      .join("\n\n");
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);
    if (error) {
      console.error("撤回消息失败:", error);
      alert("撤回消息失败: " + error.message);
    } else {
      // 本地删除 (Realtime 会处理，但本地删除更流畅)
      setLogs((prev) => prev.filter((log) => log.id !== messageId));
    }
  };

  // --- CRUD ---
  const handleSaveCharacter = async (char: Character) => {
    if (!currentRoomId || !session?.user) return;

    const charData = {
      room_id: currentRoomId,
      // 如果是编辑现有角色，保留原 user_id；否则使用当前用户 ID
      user_id: editingChar ? editingChar.user_id : session.user.id,
      name: char.name,
      role: char.role,
      avatar_url: char.avatar_url,
      // 确保 type 被正确设置，如果 char.type 为空则使用默认值
      type: char.type || "investigator",

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
        skills: char.skills || {},
      },
    };

    try {
      if (editingChar) {
        const { error } = await supabase
          .from("characters")
          .update(charData)
          .eq("id", char.id);

        if (error) throw error;

        // Refetch to ensure we have the latest DB state (including server-side defaults or triggers)
        const { data: latestChar, error: fetchError } = await supabase
          .from("characters")
          .select("*")
          .eq("id", char.id)
          .single();

        if (latestChar && !fetchError) {
          const mappedLatest: Character = {
            ...char, // Keep local fields
            ...latestChar, // Overwrite with DB fields
            // Remap JSONB fields
            role: latestChar.role || "调查员",
            avatar_url: latestChar.avatar_url,
            job: latestChar.info?.job || "",
            age: latestChar.info?.age || "",
            sex: latestChar.info?.sex || "",
            notes: latestChar.info?.notes || "",
            backstory: latestChar.info?.backstory || "",
            skills: latestChar.info?.skills || latestChar.stats?.skills || {},
            str: latestChar.stats?.str || 50,
            con: latestChar.stats?.con || 50,
            siz: latestChar.stats?.siz || 50,
            dex: latestChar.stats?.dex || 50,
            app: latestChar.stats?.app || 50,
            int: latestChar.stats?.int || 50,
            pow: latestChar.stats?.pow || 50,
            edu: latestChar.stats?.edu || 50,
            luck: latestChar.stats?.luck || 50,
            hp: latestChar.stats?.hp || 10,
            san: latestChar.stats?.san || 50,
            mp: latestChar.stats?.mp || 10,
          };
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
        const { data, error } = await supabase
          .from("characters")
          .insert(charData)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newChar: Character = {
            ...char,
            id: data.id,
            // 确保从数据库返回的数据中正确读取 type 和 role
            type: data.type,
            role: data.role,
            // Remap JSONB fields from DB response
            job: data.info?.job || "",
            age: data.info?.age || "",
            sex: data.info?.sex || "",
            notes: data.info?.notes || "",
            backstory: data.info?.backstory || "",
            skills: data.info?.skills || data.stats?.skills || {},
            str: data.stats?.str || 50,
            con: data.stats?.con || 50,
            siz: data.stats?.siz || 50,
            dex: data.stats?.dex || 50,
            app: data.stats?.app || 50,
            int: data.stats?.int || 50,
            pow: data.stats?.pow || 50,
            edu: data.stats?.edu || 50,
            luck: data.stats?.luck || 50,
            hp: data.stats?.hp || 10,
            san: data.stats?.san || 50,
            mp: data.stats?.mp || 10,
          };
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

    const { error } = await supabase.from("characters").delete().eq("id", id);

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

    // 1. Update DB: Set room_id to null
    const { error } = await supabase
      .from("characters")
      .update({ room_id: null })
      .eq("id", id);

    if (error) {
      console.error("移出失败:", error);
      alert("移出失败: " + error.message);
      return;
    }

    // 2. Send system message with kick signal
    if (char.user_id) {
      await supabase.from("messages").insert({
        room_id: currentRoomId,
        user_id: session.user.id,
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

    const { error } = await supabase
      .from("characters")
      .update({ stats: newStats })
      .eq("id", target.id);

    if (error) {
      alert("状态更新失败");
      return;
    }

    const changes = [];
    if (hp !== target.hp)
      changes.push(`HP ${hp > target.hp ? "+" : ""}${hp - target.hp}`);
    if (san !== target.san)
      changes.push(`SAN ${san > target.san ? "+" : ""}${san - target.san}`);

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
    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", currentRoomId);
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

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("room_id", currentRoomId);

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

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.warn("Logout error (safe to ignore):", error);
      // Fallback: Manually clear session from local storage if network request fails
      // This ensures the user is logged out locally even if the server request was aborted
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key);
        }
      });
    } finally {
      // Force state reset
      setSession(null);
      setCurrentRoomId(null);
      window.history.replaceState(null, "", window.location.pathname);
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
    } = await supabase.auth.getUser();
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
        const { error: msgError } = await supabase.from("messages").insert({
          room_id: currentRoomId,
          user_id: user.id, // Use validated user.id instead of session.user.id
          type: "system",
          content: leaveMsg,
        });
        if (msgError) console.error("Failed to send leave message:", msgError);
      }
    }

    // If active char is not PC/KP, remove room_id from character
    // FIX: KP's characters (NPC/Monster) should NOT be removed from room when KP leaves
    if (activeCharId !== "pc" && !isKP) {
      await supabase
        .from("characters")
        .update({ room_id: null })
        .eq("id", activeCharId);
    }

    doLeaveCleanup();
  };

  const doLeaveCleanup = () => {
    // ✅ Clean reset
    setCurrentRoomId(null);
    setCharacters([]);
    setLogs([]);
    setModuleInfo(EMPTY_MODULE_INFO);
    setIsKP(false);
    setActiveCharId("pc");
    setOnlineUsers(new Set());
    window.history.replaceState(null, "", window.location.pathname);
  };

  const derivedCharacters = characters.map((c) => ({
    ...c,
    isOnline: c.user_id ? onlineUsers.has(c.user_id) : false,
  }));

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#020617] text-slate-500">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (!currentRoomId) {
    return <Home onJoinRoom={handleJoinRoom} onLogout={handleSignOut} />;
  }

  return (
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

        {view === "main" ? (
          <ChatArea
            logs={logs}
            activeChar={activeChar}
            activeCharId={activeCharId}
            characters={derivedCharacters}
            moduleInfo={moduleInfo}
            onSend={(text, recipientId, type, quote) =>
              addLog(
                type || "normal",
                text,
                undefined,
                recipientId,
                quote ? { quote } : undefined
              )
            }
            onRollDice={rollDice}
            onShowStory={() => setShowStoryModal(true)}
            onDeleteMessage={handleDeleteMessage}
            isKP={isKP}
            kpId={kpId}
            isVip={isVip}
          />
        ) : (
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
            onDeleteRoom={handleDeleteRoom}
            onClearChat={handleClearChat}
            isKP={isKP}
          />
        )}
      </main>

      {/* Modals */}
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
            if (password !== undefined) updates.password = password;

            const { error } = await supabase
              .from("rooms")
              .update(updates)
              .eq("id", currentRoomId);

            if (error) {
              alert("保存失败: " + error.message);
            } else {
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
          content={generateStory()}
          onClose={() => setShowStoryModal(false)}
        />
      )}
    </div>
  );
};

export default App;
