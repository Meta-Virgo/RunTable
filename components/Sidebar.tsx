import React from "react";
import {
  Dice5,
  MessageSquare,
  Users,
  Crown,
  Swords,
  UserCog,
  User,
  ChevronLeft,
  ChevronRight,
  Activity,
  ClipboardList,
  Music,
  Mic,
  MicOff,
} from "lucide-react";
import {
  useLocalParticipant,
  useParticipants,
  useIsSpeaking,
} from "@livekit/components-react";
import { cn } from "./UI";
import { Character } from "../types";
import { useElasticScroll } from "../hooks/useElasticScroll";
import type { RoomMemberPanelItem } from "../services/roomMembers";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  view: string;
  setView: (view: string) => void;
  activeCharId: string;
  setActiveCharId: (id: string) => void;
  characters: Character[];
  onOpenStatusEdit: (charId: string) => void;
  onKickMember?: (userId: string) => void;
  isMobile: boolean;
  isKP: boolean;
  roomMemberItems?: RoomMemberPanelItem[];
  kpOnline?: boolean;
  roomType?: "text" | "voice";
  userNickname?: string;
  isVoiceConnected?: boolean;
}

const VoiceIndicatorContent = ({ participant }: { participant: any }) => {
  const isSpeaking = useIsSpeaking(participant);

  return (
    <div className="absolute -top-1 -right-1 z-20">
      <div
        className={cn(
          "w-3 h-3 rounded-full border-2 border-slate-900 transition-colors",
          isSpeaking ? "bg-green-500 animate-pulse" : "bg-slate-600"
        )}
      />
    </div>
  );
};

const VoiceIndicator = ({ name }: { name: string }) => {
  const participants = useParticipants();
  const participant = participants.find(
    (p) => p.name === name || p.identity === name
  );

  if (!participant) {
    return (
      <div className="absolute -top-1 -right-1 z-20">
        <div className="w-3 h-3 rounded-full border-2 border-slate-900 transition-colors bg-slate-600" />
      </div>
    );
  }

  return <VoiceIndicatorContent participant={participant} />;
};

const VoiceControls = ({
  isOpen,
  isConnected,
}: {
  isOpen: boolean;
  isConnected?: boolean;
}) => {
  return (
    <>
      {/* Microphone Toggle - Only show if connected */}
      {isConnected && <MicrophoneButton isOpen={isOpen} />}
    </>
  );
};

const MicrophoneButton = ({ isOpen }: { isOpen: boolean }) => {
  const { localParticipant, isMicrophoneEnabled: enabled } =
    useLocalParticipant();

  const handleToggle = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!enabled, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    } catch (error: any) {
      console.error("Microphone toggle error:", error);
      // 处理常见的权限错误
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError" ||
        error.message?.includes("Permission denied") ||
        error.message?.includes("device") ||
        error.message?.includes("权限")
      ) {
        alert("无法开启麦克风：权限被拒绝。");
      } else {
        alert("麦克风开启失败: " + (error.message || "未知错误"));
      }
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group border",
        enabled
          ? "bg-dicecho-primary/15 text-white border-dicecho-primary/35"
          : "text-rose-300 hover:text-white hover:bg-white/10 border-transparent",
        !isOpen && "justify-center"
      )}
    >
      {enabled ? (
        <Mic
          size={20}
          className={cn(
            "transition-colors",
            enabled ? "text-dicecho-primary" : "text-rose-400"
          )}
        />
      ) : (
        <MicOff
          size={20}
          className={cn(
            "transition-colors",
            enabled ? "text-dicecho-primary" : "text-rose-400"
          )}
        />
      )}
      {isOpen && (
        <span className="font-medium text-sm">
          {enabled ? "麦克风已开" : "麦克风已关"}
        </span>
      )}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  view,
  setView,
  activeCharId,
  setActiveCharId,
  characters,
  onOpenStatusEdit,
  isMobile,
  isKP,
  kpOnline = false,
  roomType = "text",
  userNickname,
  isVoiceConnected,
}) => {
  const pcCharacters = characters.filter((c) => c.role === "调查员");
  const npcCharacters = characters.filter((c) =>
    ["NPC", "怪物"].includes(c.role)
  );

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  useElasticScroll(scrollContainerRef, contentRef);

  const getCharIcon = (role: string, size = 18) => {
    if (role === "Keeper") return <Crown size={size} />;
    if (role === "怪物") return <Swords size={size} />;
    if (role === "NPC") return <UserCog size={size} />;
    return <User size={size} />;
  };

  const handleNavClick = (viewId: string) => {
    setView(viewId);
    if (isMobile) setIsOpen(false);
  };

  const handleCharClick = (id: string) => {
    if (isKP) {
      // KP can switch to Keeper ('pc') or NPC/Monster
      // KP cannot switch to Investigator
      const char = characters.find((c) => c.id === id);
      if (id === "pc" || (char && ["NPC", "怪物"].includes(char.role))) {
        setActiveCharId(id);
      }
    } else {
      // Players cannot switch characters
    }

    if (isMobile) setIsOpen(false);
  };

  const renderCharacterItem = (
    char: Character,
    isClickable: boolean,
    showOnline: boolean
  ) => {
    const isMonster = char.role === "怪物";
    const isNPC = char.role === "NPC";
    const activeBorder = isMonster
      ? "border-rose-500/30"
      : isNPC
      ? "border-cyan-500/30"
      : "border-dicecho-primary/35";
    const iconBg = isMonster
      ? activeCharId === char.id
        ? "bg-rose-500/80 text-white"
        : "bg-dicecho-card text-dicecho-muted group-hover:bg-dicecho-raised group-hover:text-rose-300"
      : isNPC
      ? activeCharId === char.id
        ? "bg-cyan-500/80 text-white"
        : "bg-dicecho-card text-dicecho-muted group-hover:bg-dicecho-raised group-hover:text-cyan-300"
      : activeCharId === char.id
      ? "bg-dicecho-primary-strong text-white"
      : "bg-dicecho-card text-dicecho-muted group-hover:bg-dicecho-raised group-hover:text-dicecho-primary";

    const isOnline = char.isOnline;

    return (
      <div
        key={char.id}
        onClick={() => isClickable && handleCharClick(char.id)}
        className={cn(
          "relative group flex items-center gap-3 p-2 rounded-lg transition-colors border",
          activeCharId === char.id
            ? `bg-dicecho-primary/16 ${activeBorder}`
            : "bg-transparent border-transparent hover:bg-white/10",
          !isOpen && "justify-center",
          isClickable ? "cursor-pointer" : "cursor-default",
          showOnline && !isOnline && "opacity-50 grayscale"
        )}
      >
        <div className="relative shrink-0">
          <div
            className={cn(
              "transition-colors flex items-center justify-center",
              char.avatar_url
                ? "w-[34px] h-[34px] rounded-lg overflow-hidden border border-dicecho-border/40 bg-dicecho-card"
                : "p-2 rounded-lg",
              !char.avatar_url && iconBg
            )}
          >
            {char.avatar_url ? (
              <img
                src={char.avatar_url}
                alt={char.name}
                className="w-full h-full object-cover"
              />
            ) : (
              getCharIcon(char.role, 18)
            )}
          </div>
          {roomType === "voice" && isVoiceConnected && (
            <VoiceIndicator name={char.name} />
          )}
        </div>
        {isOpen && (
          <div className="flex-1 overflow-hidden animate-fade-in">
            <div
              className={cn(
                "font-bold text-sm truncate transition-colors",
                activeCharId === char.id ? "text-white" : "text-slate-300"
              )}
            >
              {char.name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-500">
                {char.job || char.role}
              </span>
            </div>
          </div>
        )}
        {isOpen && isKP && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenStatusEdit(char.id);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-dicecho-muted hover:text-white hover:bg-dicecho-raised opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer"
          >
            <Activity size={14} />
          </button>
        )}
      </div>
    );
  };

  const renderKeeperItem = () => (
    <div
      onClick={() => handleCharClick("pc")}
      className={cn(
        "relative group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border",
        activeCharId === "pc"
          ? "bg-dicecho-primary/16 border-dicecho-primary/40 shadow-[inset_2px_0_0_0_#9b86f6]"
          : "bg-transparent border-transparent hover:bg-white/10",
        !isOpen && "justify-center",
        !kpOnline && "opacity-50 grayscale"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg shrink-0 transition-colors relative",
          activeCharId === "pc" || kpOnline
            ? "bg-dicecho-primary-strong text-white"
            : "bg-dicecho-card text-dicecho-muted group-hover:bg-dicecho-raised"
        )}
      >
        <Crown size={18} />
        {roomType === "voice" && isVoiceConnected && isKP && (
          <VoiceIndicator name={userNickname || "守秘人"} />
        )}
      </div>
      {isOpen && (
        <div className="overflow-hidden animate-fade-in">
          <div
            className={cn(
              "font-bold text-sm truncate",
              activeCharId === "pc" ? "text-white" : "text-slate-300"
            )}
          >
            守秘人
          </div>
          <div className="text-[10px] text-slate-500 truncate">Game Master</div>
        </div>
      )}
      {activeCharId === "pc" && isOpen && (
        <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-dicecho-primary shadow-[0_0_10px_#9b86f6]"></div>
      )}
    </div>
  );

  return (
    <>
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 animate-fade-in"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
      <aside
        className={cn(
          "flex flex-col border-r border-dicecho-border/40 bg-dicecho-panel/90 shadow-sm transition-all duration-300 ease-in-out z-40 shrink-0",
          "fixed inset-y-0 left-0 h-full",
          "md:relative",
          isOpen
            ? "w-72 translate-x-0"
            : "w-72 -translate-x-full md:w-20 md:translate-x-0"
        )}
      >
        {/* Header Section */}
        <div className="h-16 shrink-0 pt-safe flex items-center justify-center px-4 border-b border-dicecho-border/40 bg-dicecho-card/60">
          <div className="flex items-center gap-3 text-dicecho-primary overflow-hidden w-full justify-center">
            <div className="bg-dicecho-primary-strong p-2.5 rounded-lg text-white shrink-0 shadow-sm">
              <Dice5 size={24} />
            </div>
            {isOpen && (
              <div className="flex flex-col animate-fade-in flex-1">
                <span className="font-bold text-lg tracking-tight text-white whitespace-nowrap">
                  RunTable
                </span>
                <span className="text-[10px] text-dicecho-muted font-medium tracking-widest uppercase">
                  Pro Edition
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="p-3 space-y-2">
          {[
            { id: "main", icon: MessageSquare, label: "现场 & 通讯" },
            {
              id: "setup",
              icon: Users,
              label: isKP ? "角色 & 模组" : "调查员名册",
            },
            { id: "tools", icon: ClipboardList, label: "房间工具" },
            { id: "music", icon: Music, label: "背景音乐" },
          ]
            .filter((nav) => {
              if (nav.id === "music") return isKP && roomType !== "voice";
              return true;
            })
            .map((nav) => (
              <button
                key={nav.id}
                onClick={() => handleNavClick(nav.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group",
                  view === nav.id
                    ? "bg-dicecho-primary/18 text-white border border-dicecho-primary/45"
                    : "text-dicecho-muted hover:text-white hover:bg-white/10 border border-transparent",
                  !isOpen && "justify-center"
                )}
              >
                <nav.icon
                  size={20}
                  className={cn(
                    "transition-colors",
                    view === nav.id
                      ? "text-dicecho-primary"
                      : "text-dicecho-muted group-hover:text-slate-200"
                  )}
                />
                {isOpen && (
                  <span className="font-medium text-sm">{nav.label}</span>
                )}
              </button>
            ))}

          {/* Voice Room Controls */}
          {roomType === "voice" && (
            <VoiceControls isOpen={isOpen} isConnected={isVoiceConnected} />
          )}
        </div>

        {/* Character/Role Lists */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 overscroll-y-none"
        >
          <div ref={contentRef} className="space-y-6">
            {/* --- KP VIEW --- */}
            {isKP && (
              <>
                {/* Role List (Keeper, NPC, Monster) */}
                <div className="space-y-2">
                  {isOpen && (
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                      角色列表
                    </div>
                  )}

                  {/* Keeper Item */}
                  {renderKeeperItem()}

                  {/* NPCs & Monsters */}
                  {npcCharacters.map((char) =>
                    renderCharacterItem(char, true, false)
                  )}
                </div>

                {/* Investigators List (View Only) */}
                <div className="space-y-2">
                  {isOpen && (
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 flex justify-between">
                      <span>调查员</span>
                      <span className="text-[10px] bg-dicecho-card px-1.5 rounded text-dicecho-muted">
                        {pcCharacters.length}
                      </span>
                    </div>
                  )}
                  {pcCharacters.map((char) =>
                    renderCharacterItem(char, false, true)
                  )}
                </div>
              </>
            )}

            {/* --- PC VIEW (Only Investigators) --- */}
            {!isKP && (
              <div className="space-y-2">
                {renderKeeperItem()}
                {pcCharacters.map((char) =>
                  renderCharacterItem(char, char.id === "pc", true)
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-dicecho-border/40 hidden md:block">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-center p-2 text-dicecho-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
};
