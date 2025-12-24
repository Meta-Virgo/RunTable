import React, { useRef, useEffect, useState } from "react";
import {
  BookOpen,
  Activity,
  Info,
  Dice5,
  Send,
  FileText,
  User,
  Swords,
  UserCog,
  Crown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  X,
  Trash2,
  Quote,
} from "lucide-react";
import { cn, Button, NumberStepper } from "./UI";
import { Log, Character, ModuleInfo } from "../types";
import { Lock, Unlock, Sparkles, RefreshCw } from "lucide-react";
import { callDeepSeekAI, buildContext } from "../services/ai";

interface ChatAreaProps {
  logs: Log[];
  activeChar: { name: string; role: string };
  activeCharId: string;
  characters: Character[];
  moduleInfo?: ModuleInfo;
  onSend: (
    text: string,
    recipientId?: string | null,
    type?: Log["type"],
    quote?: { id: string; content: string; charName: string }
  ) => void;
  onRollDice: (
    count: number,
    type: number,
    isSecret: boolean,
    checkInfo?: { name: string; target: number }
  ) => void;
  onShowStory: () => void;
  isKP: boolean;
  kpId: string | null;
  isVip: boolean;
  onDeleteMessage: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

const getCharIcon = (role: string, size = 18) => {
  if (role === "Keeper") return <Crown size={size} />;
  if (role === "怪物") return <Swords size={size} />;
  if (role === "NPC") return <UserCog size={size} />;
  return <User size={size} />;
};

const ATTRIBUTES = [
  { key: "str", label: "力量" },
  { key: "con", label: "体质" },
  { key: "siz", label: "体型" },
  { key: "dex", label: "敏捷" },
  { key: "app", label: "外貌" },
  { key: "int", label: "智力" },
  { key: "pow", label: "意志" },
  { key: "edu", label: "教育" },
  { key: "luck", label: "幸运" },
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  logs,
  activeChar,
  activeCharId,
  characters,
  moduleInfo,
  onSend,
  onRollDice,
  onShowStory,
  isKP,
  kpId,
  isVip,
  onDeleteMessage,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [diceCount, setDiceCount] = useState(1);
  const [diceType, setDiceType] = useState(6);
  const [showDiceSelect, setShowDiceSelect] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [showRecipientSelect, setShowRecipientSelect] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string;
    name: string;
  } | null>(null);
  const [quoteMessage, setQuoteMessage] = useState<{
    id: string;
    content: string;
    charName: string;
  } | null>(null);

  const [showAttrSelect, setShowAttrSelect] = useState(false);
  const [showSkillSelect, setShowSkillSelect] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<React.CSSProperties>({});
  const diceButtonRef = useRef<HTMLButtonElement>(null);
  const attrButtonRef = useRef<HTMLButtonElement>(null);
  const skillButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateMenuStyles = (
    ref: React.RefObject<HTMLElement>,
    width: number
  ) => {
    if (!ref.current) return {};
    const rect = ref.current.getBoundingClientRect();
    const screenW = window.innerWidth;

    let left = rect.left;
    // Prevent right overflow
    if (left + width > screenW - 10) {
      left = screenW - width - 10;
    }
    // Prevent left overflow
    if (left < 10) left = 10;

    return {
      position: "fixed" as const,
      bottom: window.innerHeight - rect.top + 8, // 8px gap above button
      left: left,
      zIndex: 9999,
    };
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [inputText]);

  const handleTouchStart = (id: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setActiveMessageId(id);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // AI State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [prevScrollHeight, setPrevScrollHeight] = useState(0);

  // Auto scroll to bottom when new logs arrive (if auto scroll is enabled)
  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [logs, isAutoScroll]);

  // Handle scroll to load more and manage auto-scroll state
  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;

    // Check if user is near bottom to enable auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAutoScroll(isNearBottom);

    // Check if user is at top to load more
    if (scrollTop < 20 && hasMore && onLoadMore && !isLoading) {
      // Save current scroll height to maintain position after load
      setPrevScrollHeight(scrollHeight);
      onLoadMore();
    }
  };

  // Restore scroll position after loading more
  useEffect(() => {
    if (logsContainerRef.current && prevScrollHeight > 0 && !isLoading) {
      const newScrollHeight = logsContainerRef.current.scrollHeight;
      const heightDiff = newScrollHeight - prevScrollHeight;
      // Only adjust if height actually increased (data loaded)
      if (heightDiff > 0) {
        logsContainerRef.current.scrollTop = heightDiff;
        setPrevScrollHeight(0);
      }
    }
  }, [logs, isLoading]);

  const handleAskAI = async () => {
    if (!isVip) {
      alert("AI 功能仅限 VIP 用户使用。");
      return;
    }
    if (!moduleInfo) return;
    setAiLoading(true);
    setAiError("");
    setAiResult("");

    try {
      const { system, context } = buildContext(moduleInfo, logs, characters);
      const messages = [
        { role: "system", content: system } as any,
        {
          role: "user",
          content: `${context}\n\n[指令]\n${
            aiPrompt || "请根据当前情况继续推进剧情。"
          }`,
        },
      ];

      const result = await callDeepSeekAI(messages);
      setAiResult(result);
    } catch (e: any) {
      setAiError(e.message || "AI 请求失败");
    } finally {
      setAiLoading(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    // Check file size (e.g. limit to 2MB to avoid DB issues)
    if (file.size > 2 * 1024 * 1024) {
      alert("图片大小不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setPendingImage({ dataUrl: result, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const myChar = characters.find((c) => c.id === activeCharId);
  const canRollCheck = !!myChar;

  useEffect(() => {
    // logsEndRef.current?.scrollIntoView({ behavior: "auto" }); // Removed in favor of auto-scroll logic
  }, [logs]);

  const getRecipientLabel = () => {
    if (!recipientId) return "所有人";
    if (kpId && recipientId === kpId) return "守秘人 (KP)";
    const char = characters.find((c) => c.user_id === recipientId);
    return char ? `${char.name}` : "未知用户";
  };

  const handleSend = () => {
    if (pendingImage) {
      onSend(pendingImage.dataUrl, recipientId, "image");
      setPendingImage(null);
    }
    if (!inputText.trim()) return;
    onSend(inputText, recipientId, "normal", quoteMessage || undefined);
    setInputText("");
    setQuoteMessage(null);
    setActiveMessageId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 修复：检查是否正在使用输入法（如中文输入）
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Logs View */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 md:px-8 py-4 pt-4 pb-48 space-y-6 custom-scrollbar"
      >
        {hasMore && (
          <div className="flex justify-center py-2 shrink-0">
            {isLoading ? (
              <span className="text-xs text-indigo-400 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" /> 加载中...
              </span>
            ) : (
              <span className="text-xs text-slate-500 animate-pulse">
                加载更多历史记录...
              </span>
            )}
          </div>
        )}
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-600 animate-slide-up">
            <div className="w-24 h-24 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-full flex items-center justify-center mb-6 ring-1 ring-slate-700/50 shadow-2xl">
              <BookOpen size={40} className="text-slate-500 opacity-50" />
            </div>
            <p className="text-lg font-medium text-slate-500">
              传奇故事，由此开始
            </p>
          </div>
        )}

        {logs.map((log) => {
          const isSystem = log.type === "system";
          const isDice = log.type === "dice" || log.type === "dice_secret";
          const isStatus = log.type === "status";
          const isPrivate = !!log.recipientId;

          // Only show character name if it's NOT Keeper. If it is Keeper, show '守秘人'
          const displayName =
            log.charRole === "Keeper" ? "守秘人" : log.charName;

          if (isSystem || isStatus) {
            return (
              <div
                key={log.id}
                className="flex justify-center py-2 animate-fade-in"
              >
                <div
                  className={cn(
                    "text-xs px-4 py-2 rounded-xl border flex items-start gap-2 shadow-sm backdrop-blur-sm max-w-[85%]",
                    isStatus
                      ? "bg-red-500/10 border-red-500/20 text-red-300"
                      : "bg-slate-800/60 border-slate-700/50 text-slate-400"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isStatus ? <Activity size={12} /> : <Info size={12} />}
                  </div>
                  <span className="font-mono whitespace-pre-wrap text-left leading-relaxed">
                    {log.content}
                  </span>
                </div>
              </div>
            );
          }

          if (isDice) {
            let diceData: any = {
              count: "?",
              total: "?",
              details: [] as number[],
              type: 6,
            };
            const isHidden = log.type === "dice_secret";
            const canSee = isKP || log.isMine;

            if (isHidden && !canSee) {
              return (
                <div
                  key={log.id}
                  className="flex flex-col items-center py-4 animate-slide-up"
                >
                  <div className="relative overflow-hidden bg-slate-900 rounded-xl border-l-4 border-slate-600 shadow-2xl p-4 min-w-[260px] max-w-sm w-full opacity-70">
                    <EyeOff className="absolute -right-4 -bottom-4 text-slate-500/10 w-32 h-32 transform rotate-12" />
                    <div className="flex justify-between items-center mb-2 relative z-10">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">
                          {displayName}
                        </span>
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase opacity-70">
                          Secret Roll
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {log.timestamp}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 relative z-10 py-2">
                      <span className="text-slate-400 text-sm font-medium">
                        进行了一次暗骰
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            try {
              diceData = JSON.parse(log.content);
            } catch (e) {
              diceData.total = log.content as any;
            }

            let borderColor = isHidden
              ? "border-purple-500"
              : "border-indigo-500";
            let textColor = isHidden ? "text-purple-400" : "text-indigo-400";
            let label = isHidden ? "Secret Roll" : "Dice Roll";
            let iconColor = isHidden
              ? "text-purple-500/10"
              : "text-indigo-500/10";

            if (diceData.checkResult) {
              switch (diceData.checkResult) {
                case "critical_success":
                  borderColor = "border-amber-400";
                  textColor = "text-amber-400";
                  iconColor = "text-amber-400/10";
                  label = "大成功";
                  break;
                case "success":
                  borderColor = "border-emerald-500";
                  textColor = "text-emerald-500";
                  iconColor = "text-emerald-500/10";
                  label = "成功";
                  break;
                case "failure":
                  borderColor = "border-slate-500";
                  textColor = "text-slate-500";
                  iconColor = "text-slate-500/10";
                  label = "失败";
                  break;
                case "critical_failure":
                  borderColor = "border-red-600";
                  textColor = "text-red-600";
                  iconColor = "text-red-600/10";
                  label = "大失败";
                  break;
              }
            }

            return (
              <div
                key={log.id}
                className="flex flex-col items-center py-4 animate-slide-up"
              >
                <div
                  className={cn(
                    "relative overflow-hidden bg-slate-900 rounded-xl border-l-4 shadow-2xl p-4 min-w-[260px] max-w-sm w-full",
                    borderColor
                  )}
                >
                  {isHidden ? (
                    <EyeOff
                      className={cn(
                        "absolute -right-4 -bottom-4 w-32 h-32 transform rotate-12",
                        iconColor
                      )}
                    />
                  ) : (
                    <Dice5
                      className={cn(
                        "absolute -right-4 -bottom-4 w-32 h-32 transform rotate-12",
                        iconColor
                      )}
                    />
                  )}
                  <div className="flex justify-between items-center mb-2 relative z-10">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">
                        {displayName}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold tracking-widest uppercase opacity-70",
                          textColor
                        )}
                      >
                        {diceData.checkName
                          ? `${diceData.checkName} ${label}`
                          : label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {log.timestamp}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 relative z-10">
                    <span className="text-slate-400 text-sm font-medium">
                      投掷了
                    </span>
                    <span className="text-white text-lg font-bold">
                      {diceData.expression ? (
                        <span className="text-base">{diceData.expression}</span>
                      ) : (
                        `${diceData.count}D${diceData.type || 6}`
                      )}
                    </span>
                    <span className="text-slate-600">:</span>
                    <span
                      className={cn("text-4xl font-black font-mono", textColor)}
                    >
                      {diceData.total}
                    </span>
                    {diceData.checkTarget !== undefined && (
                      <span className="text-xs text-slate-500 font-mono ml-1">
                        / {diceData.checkTarget}
                      </span>
                    )}
                  </div>
                  {diceData.details && diceData.details.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800 relative z-10">
                      <div className="flex flex-wrap gap-1 text-xs font-mono text-slate-500">
                        {diceData.details.map((d: any, i: number) => (
                          <span
                            key={i}
                            className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {log.isMine && (
                    <button
                      onClick={() => onDeleteMessage(log.id)}
                      className="p-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="撤回"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          }

          const bubbleColor = isPrivate
            ? "bg-slate-900 text-slate-300 border-indigo-500/50 shadow-indigo-500/10" // Private message style
            : log.charRole === "Keeper"
            ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/10"
            : log.charRole === "怪物"
            ? "bg-rose-900/80 text-rose-100 border-rose-800 shadow-rose-900/10"
            : log.charRole === "NPC"
            ? "bg-slate-800 text-slate-200 border-slate-700 shadow-slate-900/10"
            : "bg-slate-700/80 text-white border-slate-600";
          const alignRight = log.isMine;
          const iconColor =
            log.charRole === "怪物"
              ? "text-rose-400"
              : log.charRole === "NPC"
              ? "text-cyan-400"
              : log.charRole === "Keeper"
              ? "text-indigo-400"
              : "text-purple-400";

          // DisplayName is already calculated above

          return (
            <div
              key={log.id}
              className={cn(
                "flex w-full gap-2 md:gap-3 group animate-slide-up",
                alignRight ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className="mt-1 shrink-0">
                <div
                  className={cn(
                    "rounded-lg bg-slate-800/80 border border-slate-700/50 shadow-lg relative overflow-hidden flex items-center justify-center",
                    log.charAvatar ? "w-9 h-9 p-0" : "p-1.5 md:p-2",
                    !log.charAvatar && iconColor
                  )}
                >
                  {log.charAvatar ? (
                    <img
                      src={log.charAvatar}
                      alt={log.charName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getCharIcon(log.charRole, 20)
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex flex-col max-w-[80%] md:max-w-[75%]",
                  alignRight ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-baseline gap-2 mb-1 px-1 opacity-70">
                  <span className="text-xs font-bold text-slate-300">
                    {displayName}
                  </span>
                  {isPrivate && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 rounded border border-indigo-500/30">
                      私信
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 font-mono">
                    {log.timestamp}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 group/bubble",
                    alignRight ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2 md:px-5 md:py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-md border backdrop-blur-sm relative select-none md:select-text",
                      bubbleColor,
                      alignRight ? "rounded-tr-none" : "rounded-tl-none"
                    )}
                    onTouchStart={() => handleTouchStart(log.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                  >
                    {log.quote && (
                      <div className="mb-2 p-2 rounded bg-black/20 border-l-2 border-white/30 text-xs text-white/70 select-none">
                        <div className="font-bold mb-0.5 opacity-80">
                          {log.quote.charName}:
                        </div>
                        <div className="line-clamp-2 italic">
                          {log.quote.content}
                        </div>
                      </div>
                    )}
                    {log.type === "image" ? (
                      <img
                        src={log.content}
                        alt="sent image"
                        className="max-w-full rounded-lg cursor-pointer max-h-[300px] object-contain hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const w = window.open();
                          if (w) {
                            w.document.write(
                              `<img src="${log.content}" style="max-width: 100%; height: auto;" />`
                            );
                            w.document.title = "Image Preview";
                            w.document.body.style.margin = "0";
                            w.document.body.style.backgroundColor = "#0f172a";
                            w.document.body.style.display = "flex";
                            w.document.body.style.justifyContent = "center";
                            w.document.body.style.alignItems = "center";
                            w.document.body.style.minHeight = "100vh";
                          }
                        }}
                      />
                    ) : (
                      log.content
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1 transition-opacity",
                      activeMessageId === log.id
                        ? "opacity-100"
                        : "opacity-0 group-hover/bubble:opacity-100",
                      alignRight ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <button
                      onClick={() => {
                        setQuoteMessage({
                          id: log.id,
                          content:
                            log.type === "image" ? "[图片]" : log.content,
                          charName: log.charName,
                        });
                        setActiveMessageId(null);
                      }}
                      className="p-1.5 text-slate-500 hover:text-indigo-400 transition-all"
                      title="引用"
                    >
                      <Quote size={14} />
                    </button>
                    {log.isMine && (
                      <button
                        onClick={() => {
                          onDeleteMessage(log.id);
                          setActiveMessageId(null);
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-all"
                        title="撤回"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full z-50 p-2 md:p-6 pt-0 md:pt-2 bg-slate-950/50 md:bg-transparent backdrop-blur-md md:backdrop-blur-none pb-safe">
        <div className="max-w-4xl mx-auto rounded-2xl relative z-20 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50 shadow-2xl">
          <div className="absolute inset-0 glass-panel rounded-2xl z-0 pointer-events-none"></div>
          <div className="relative z-10 p-2 md:p-3">
            <div className="absolute -top-3 left-4 bg-slate-900 text-slate-300 text-[10px] px-3 py-1 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 font-medium tracking-wide z-10">
              <span
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  activeCharId === "pc" ? "bg-indigo-500" : "bg-emerald-500"
                )}
              ></span>
              正在扮演:{" "}
              <span className="text-white font-bold max-w-[100px] truncate">
                {activeChar.name}
              </span>
            </div>
            {pendingImage && (
              <div className="mx-4 mt-2 flex items-center gap-2 bg-slate-800/80 border border-slate-700 p-2 rounded-lg w-fit animate-fade-in relative z-20">
                <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700">
                  <ImageIcon size={14} className="text-indigo-400" />
                </div>
                <span className="text-xs text-slate-300 truncate max-w-[150px] font-mono">
                  {pendingImage.name}
                </span>
                <button
                  onClick={() => setPendingImage(null)}
                  className="ml-1 p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-white/5"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {quoteMessage && (
              <div className="mx-4 mt-2 flex items-center gap-2 bg-slate-800/80 border-l-4 border-indigo-500 p-2 rounded-r-lg w-fit animate-fade-in relative z-20 max-w-[80%]">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-indigo-400">
                    回复 {quoteMessage.charName}:
                  </span>
                  <span className="text-xs text-slate-300 truncate font-mono opacity-80">
                    {quoteMessage.content}
                  </span>
                </div>
                <button
                  onClick={() => setQuoteMessage(null)}
                  className="ml-2 p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-white/5 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onDrop={handleDrop}
              placeholder={`以 ${activeChar.name} 的身份发言...`}
              rows={1}
              className="w-full bg-transparent border-none text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-0 resize-none px-4 py-3 min-h-[3rem] max-h-[200px] custom-scrollbar text-sm md:text-base"
            />
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0 px-1 md:px-2 pt-2 border-t border-white/5 mt-1">
              <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto overflow-x-auto md:overflow-visible custom-scrollbar justify-start md:justify-start pb-1 md:pb-0">
                <div className="flex items-center gap-2 shrink-0">
                  {canRollCheck && (
                    <>
                      <div className="relative shrink-0">
                        <button
                          ref={attrButtonRef}
                          type="button"
                          onClick={() => {
                            if (!showAttrSelect) {
                              setMenuPosition(
                                calculateMenuStyles(attrButtonRef, 256)
                              );
                              setShowAttrSelect(true);
                              setShowSkillSelect(false);
                              setShowDiceSelect(false);
                            } else {
                              setShowAttrSelect(false);
                            }
                          }}
                          className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group min-w-[3.5rem]"
                          title="属性判定"
                        >
                          <span className="text-sm font-bold text-slate-300 font-mono group-hover:text-white">
                            属性
                          </span>
                        </button>
                        {showAttrSelect && (
                          <>
                            <div
                              className="fixed inset-0 z-[9990]"
                              onClick={() => setShowAttrSelect(false)}
                            ></div>
                            <div
                              className="fixed bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-[9999] animate-scale-in w-64 max-w-[90vw]"
                              style={menuPosition}
                            >
                              {ATTRIBUTES.map((attr) => {
                                const val = (myChar as any)[attr.key] || 0;
                                return (
                                  <button
                                    key={attr.key}
                                    onClick={() => {
                                      onRollDice(1, 100, isSecret, {
                                        name: attr.label,
                                        target: val,
                                      });
                                      setShowAttrSelect(false);
                                    }}
                                    className="flex flex-col items-center p-2 hover:bg-indigo-600 rounded-lg transition-colors group/item"
                                  >
                                    <span className="text-xs font-bold text-slate-300 group-hover/item:text-white">
                                      {attr.label}
                                    </span>
                                    <span className="text-[10px] text-slate-500 group-hover/item:text-slate-200">
                                      {val}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="relative shrink-0">
                        <button
                          ref={skillButtonRef}
                          type="button"
                          onClick={() => {
                            if (!showSkillSelect) {
                              setMenuPosition(
                                calculateMenuStyles(skillButtonRef, 256)
                              );
                              setShowSkillSelect(true);
                              setShowAttrSelect(false);
                              setShowDiceSelect(false);
                            } else {
                              setShowSkillSelect(false);
                            }
                          }}
                          className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group min-w-[3.5rem]"
                          title="技能判定"
                        >
                          <span className="text-sm font-bold text-slate-300 font-mono group-hover:text-white">
                            技能
                          </span>
                        </button>
                        {showSkillSelect && (
                          <>
                            <div
                              className="fixed inset-0 z-[9990]"
                              onClick={() => setShowSkillSelect(false)}
                            ></div>
                            <div
                              className="fixed bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-2 gap-1 shadow-xl z-[9999] animate-scale-in w-64 max-w-[90vw] max-h-64 overflow-y-auto custom-scrollbar"
                              style={menuPosition}
                            >
                              {Object.keys(myChar?.skills || {}).length ===
                              0 ? (
                                <div className="col-span-2 text-center text-xs text-slate-500 py-2">
                                  暂无技能
                                </div>
                              ) : (
                                Object.entries(myChar?.skills || {}).map(
                                  ([name, val]) => (
                                    <button
                                      key={name}
                                      onClick={() => {
                                        onRollDice(1, 100, isSecret, {
                                          name: name,
                                          target: val,
                                        });
                                        setShowSkillSelect(false);
                                      }}
                                      className="flex justify-between items-center px-3 py-2 hover:bg-indigo-600 rounded-lg transition-colors text-left group/item"
                                    >
                                      <span className="text-xs font-bold text-slate-300 group-hover/item:text-white truncate max-w-[80px]">
                                        {name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 group-hover/item:text-slate-200">
                                        {val}
                                      </span>
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  <NumberStepper
                    value={diceCount}
                    onChange={setDiceCount}
                    min={1}
                    max={100}
                    className="w-24 md:w-28"
                  />

                  <div className="relative shrink-0">
                    <button
                      ref={diceButtonRef}
                      type="button"
                      onClick={() => {
                        if (!showDiceSelect) {
                          setMenuPosition(
                            calculateMenuStyles(diceButtonRef, 192)
                          );
                          setShowDiceSelect(true);
                          setShowAttrSelect(false);
                          setShowSkillSelect(false);
                        } else {
                          setShowDiceSelect(false);
                        }
                      }}
                      className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 min-w-[3.5rem] md:min-w-[4.5rem] shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group"
                    >
                      <span className="text-base font-bold text-white font-mono">
                        D{diceType}
                      </span>
                    </button>
                    {showDiceSelect && (
                      <>
                        <div
                          className="fixed inset-0 z-[9990]"
                          onClick={() => setShowDiceSelect(false)}
                        ></div>
                        <div
                          className="fixed bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-[9999] animate-scale-in w-48"
                          style={menuPosition}
                        >
                          {[2, 3, 4, 6, 8, 10, 12, 20, 100].map((d) => (
                            <button
                              key={d}
                              onClick={() => {
                                setDiceType(d);
                                setShowDiceSelect(false);
                              }}
                              className="p-2 hover:bg-indigo-600 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors"
                            >
                              D{d}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {isKP && (
                    <button
                      onClick={() => setIsSecret(!isSecret)}
                      className={cn(
                        "p-2 md:p-1.5 rounded-xl transition-colors h-10 w-10 flex items-center justify-center border shrink-0",
                        isSecret
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                          : "bg-transparent text-slate-400 border-transparent hover:bg-slate-800 hover:text-indigo-400"
                      )}
                      title={isSecret ? "暗骰模式已开启" : "开启暗骰模式"}
                    >
                      {isSecret ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  )}

                  <button
                    onClick={() => onRollDice(diceCount, diceType, isSecret)}
                    className="p-2 md:p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors h-10 w-10 flex items-center justify-center border border-transparent hover:border-slate-700 shrink-0"
                    title="投掷"
                  >
                    <Dice5 size={20} />
                  </button>
                </div>
                {isKP && (
                  <button
                    onClick={onShowStory}
                    className="p-2 text-slate-500 hover:text-slate-300 transition-colors hover:bg-white/5 rounded-lg shrink-0"
                    title="战报预览"
                  >
                    <FileText size={18} />
                  </button>
                )}
                {isKP && (
                  <button
                    onClick={() => setShowAIModal(true)}
                    className="p-2 text-purple-400 hover:text-purple-300 transition-colors hover:bg-purple-500/10 rounded-lg shrink-0"
                    title="AI 辅助"
                  >
                    <Sparkles size={18} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 relative w-full md:w-auto justify-end shrink-0">
                {/* Recipient Popup */}
                {showRecipientSelect && (
                  <div className="absolute bottom-full right-0 mb-3 w-52 bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in flex flex-col p-1 ring-1 ring-white/5">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      发送给
                    </div>
                    <button
                      onClick={() => {
                        setRecipientId(null);
                        setShowRecipientSelect(false);
                      }}
                      className={cn(
                        "px-3 py-2.5 text-left text-xs rounded-xl transition-all flex items-center gap-3 group",
                        !recipientId
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                          !recipientId
                            ? "bg-indigo-500/20 text-indigo-400"
                            : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                        )}
                      >
                        <Unlock size={14} />
                      </div>
                      <span className="font-medium">所有人</span>
                      {!recipientId && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      )}
                    </button>

                    <div className="h-px bg-slate-800/50 my-1 mx-2" />

                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                      {isKP &&
                        characters
                          .filter((c) => c.type === "investigator")
                          .map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setRecipientId(c.user_id || null);
                                setShowRecipientSelect(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-xs rounded-xl transition-all flex items-center gap-3 group",
                                recipientId === c.user_id
                                  ? "bg-indigo-500/10 text-indigo-400"
                                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                  recipientId === c.user_id
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                                )}
                              >
                                <User size={14} />
                              </div>
                              <span className="font-medium truncate flex-1">
                                {c.name}
                              </span>
                              {recipientId === c.user_id && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                              )}
                            </button>
                          ))}

                      {!isKP && kpId && (
                        <button
                          onClick={() => {
                            setRecipientId(kpId);
                            setShowRecipientSelect(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs rounded-xl transition-all flex items-center gap-3 group",
                            recipientId === kpId
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                              recipientId === kpId
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                            )}
                          >
                            <Crown size={14} />
                          </div>
                          <span className="font-medium truncate flex-1">
                            守秘人 (KP)
                          </span>
                          {recipientId === kpId && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowRecipientSelect(!showRecipientSelect)}
                  className={cn(
                    "h-9 px-4 rounded-xl border flex items-center gap-2 transition-all font-medium text-xs",
                    recipientId
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                  )}
                  title="选择发送对象"
                >
                  {recipientId ? (
                    <Lock size={14} className="opacity-70" />
                  ) : (
                    <Unlock size={14} className="opacity-70" />
                  )}
                  <span className="max-w-[100px] truncate">
                    {getRecipientLabel()}
                  </span>
                </button>
                <Button
                  onClick={handleSend}
                  disabled={!inputText.trim() && !pendingImage}
                  size="sm"
                  icon={Send}
                  className="rounded-lg shadow-indigo-500/20 px-4"
                >
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-purple-400" />
                AI 跑团助手 (DeepSeek)
              </h3>
              <button
                onClick={() => setShowAIModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">
                  指令 (Prompt)
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="例如：描述一下调查员们推开门后看到的景象，要恐怖一点..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all min-h-[80px] resize-y placeholder-slate-600"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    onClick={handleAskAI}
                    disabled={aiLoading}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500 text-white border-none shadow-lg shadow-purple-900/20"
                  >
                    {aiLoading ? (
                      <RefreshCw size={14} className="animate-spin mr-2" />
                    ) : (
                      <Sparkles size={14} className="mr-2" />
                    )}
                    {aiLoading ? "生成中..." : "开始生成"}
                  </Button>
                </div>
              </div>

              {aiError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <Activity size={16} /> {aiError}
                </div>
              )}

              {aiResult && (
                <div className="space-y-2 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                      生成结果
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setInputText(aiResult);
                          setShowAIModal(false);
                        }}
                        className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <Send size={12} /> 填入输入框
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {aiResult}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-slate-600 text-center pt-2">
                AI 可能会产生错误或虚构事实，请核对后使用。
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
