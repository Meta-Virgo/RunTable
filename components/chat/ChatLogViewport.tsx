import React from "react";
import {
  Activity,
  BookOpen,
  Dice5,
  EyeOff,
  Info,
  Quote,
  RefreshCw,
  Swords,
  Trash2,
  User,
  UserCog,
  Crown,
} from "lucide-react";
import type { Character, Log } from "../../types";
import { cn } from "../UI";

const getCharIcon = (role: string, size = 18) => {
  if (role === "Keeper") return <Crown size={size} />;
  if (role === "怪物") return <Swords size={size} />;
  if (role === "NPC") return <UserCog size={size} />;
  return <User size={size} />;
};

interface ChatLogViewportProps {
  logs: Log[];
  characters: Character[];
  isKP: boolean;
  hasMore: boolean;
  isLoading: boolean;
  logsContainerRef: React.RefObject<HTMLDivElement>;
  logsEndRef: React.RefObject<HTMLDivElement>;
  activeMessageId: string | null;
  profileLoadingUserId: string | null;
  onScroll: () => void;
  onOpenUserProfile: (userId?: string | null) => void;
  onTouchStart: (id: string) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onQuoteMessage: (quote: {
    id: string;
    content: string;
    charName: string;
  }) => void;
  onClearActiveMessage: () => void;
  onDeleteMessage: (id: string) => void;
}

export const ChatLogViewport: React.FC<ChatLogViewportProps> = ({
  logs,
  characters,
  isKP,
  hasMore,
  isLoading,
  logsContainerRef,
  logsEndRef,
  activeMessageId,
  profileLoadingUserId,
  onScroll,
  onOpenUserProfile,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onQuoteMessage,
  onClearActiveMessage,
  onDeleteMessage,
}) => (
  <div
    ref={logsContainerRef}
    onScroll={onScroll}
    className="flex-1 overflow-y-auto px-3 md:px-8 py-4 pt-4 pb-48 custom-scrollbar overscroll-contain scroll-smooth bg-dicecho-bg/35"
  >
    <div className="space-y-6 min-h-full">
      {hasMore && (
        <div className="flex justify-center py-2 shrink-0">
          {isLoading ? (
            <span className="text-xs text-dicecho-primary flex items-center gap-2">
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
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-600">
          <div className="w-24 h-24 bg-dicecho-panel rounded-lg flex items-center justify-center mb-6 ring-1 ring-dicecho-border/40 shadow-sm">
            <BookOpen size={40} className="text-dicecho-muted opacity-55" />
          </div>
          <p className="text-lg font-medium text-dicecho-muted">
            传奇故事，由此开始
          </p>
        </div>
      )}

      {logs.map((log) => (
        <ChatLogItem
          key={log.id}
          activeMessageId={activeMessageId}
          characters={characters}
          isKP={isKP}
          log={log}
          profileLoadingUserId={profileLoadingUserId}
          onClearActiveMessage={onClearActiveMessage}
          onDeleteMessage={onDeleteMessage}
          onOpenUserProfile={onOpenUserProfile}
          onQuoteMessage={onQuoteMessage}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchMove}
          onTouchStart={onTouchStart}
        />
      ))}
      <div ref={logsEndRef} />
    </div>
  </div>
);

const ChatLogItem: React.FC<{
  log: Log;
  characters: Character[];
  isKP: boolean;
  activeMessageId: string | null;
  profileLoadingUserId: string | null;
  onOpenUserProfile: (userId?: string | null) => void;
  onTouchStart: (id: string) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onQuoteMessage: (quote: {
    id: string;
    content: string;
    charName: string;
  }) => void;
  onClearActiveMessage: () => void;
  onDeleteMessage: (id: string) => void;
}> = ({
  log,
  characters,
  isKP,
  activeMessageId,
  profileLoadingUserId,
  onOpenUserProfile,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onQuoteMessage,
  onClearActiveMessage,
  onDeleteMessage,
}) => {
  const isSystem = log.type === "system";
  const isDice = log.type === "dice" || log.type === "dice_secret";
  const isStatus = log.type === "status";
  const isPrivate = !!log.recipientId;
  const displayName = log.charRole === "Keeper" ? "守秘人" : log.charName;

  if (isSystem || isStatus) {
    return <SystemLogItem isStatus={isStatus} log={log} />;
  }

  if (isDice) {
    return (
      <DiceLogItem
        displayName={displayName}
        isKP={isKP}
        log={log}
        onDeleteMessage={onDeleteMessage}
      />
    );
  }

  const bubbleColor = isPrivate
    ? "bg-dicecho-panel text-slate-300 border-dicecho-primary/50 shadow-black/10"
    : log.charRole === "Keeper"
    ? "bg-dicecho-primary-strong text-white border-dicecho-primary shadow-black/10"
    : log.charRole === "怪物"
    ? "bg-rose-900/80 text-rose-100 border-rose-800 shadow-rose-900/10"
    : log.charRole === "NPC"
    ? "bg-dicecho-card text-slate-200 border-dicecho-border/60 shadow-black/10"
    : "bg-dicecho-raised/80 text-white border-dicecho-border/60";
  const alignRight = log.isMine;
  const iconColor =
    log.charRole === "怪物"
      ? "text-rose-400"
      : log.charRole === "NPC"
      ? "text-cyan-400"
      : log.charRole === "Keeper"
      ? "text-dicecho-primary"
      : "text-dicecho-accent";

  const logCharacter = characters.find((character) => character.id === log.charId);
  const profileUserId = log.userId || logCharacter?.user_id || null;

  return (
    <div
      className={cn(
        "flex w-full gap-2 md:gap-3 group animate-slide-up",
        alignRight ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className="mt-1 shrink-0">
        <button
          type="button"
          disabled={!profileUserId || profileLoadingUserId === profileUserId}
          onClick={() => onOpenUserProfile(profileUserId)}
          className={cn(
            "rounded-lg bg-dicecho-card border border-dicecho-border/50 shadow-sm relative overflow-hidden flex items-center justify-center",
            log.charAvatar ? "w-9 h-9 p-0" : "p-1.5 md:p-2",
            !log.charAvatar && iconColor,
            profileUserId ? "cursor-pointer" : "cursor-default"
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
        </button>
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
            <span className="text-[10px] bg-dicecho-primary/20 text-dicecho-primary px-1.5 rounded border border-dicecho-primary/30">
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
          <MessageBubble
            alignRight={alignRight}
            bubbleColor={bubbleColor}
            log={log}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchMove}
            onTouchStart={onTouchStart}
          />
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity",
              activeMessageId === log.id
                ? "opacity-100"
                : "opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100",
              alignRight ? "flex-row-reverse" : "flex-row"
            )}
          >
            <button
              onClick={() => {
                onQuoteMessage({
                  id: log.id,
                  content: log.type === "image" ? "[图片]" : log.content,
                  charName: log.charName,
                });
                onClearActiveMessage();
              }}
              className="p-1.5 text-dicecho-muted hover:text-dicecho-primary transition-colors"
            >
              <Quote size={14} />
            </button>
            {log.isMine && (
              <button
                onClick={() => {
                  onDeleteMessage(log.id);
                  onClearActiveMessage();
                }}
                className="p-1.5 text-slate-500 hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemLogItem: React.FC<{ log: Log; isStatus: boolean }> = ({
  log,
  isStatus,
}) => (
  <div className="flex justify-center py-2 animate-fade-in">
    <div
      className={cn(
        "text-xs px-4 py-2 rounded-lg border flex items-start gap-2 shadow-sm backdrop-blur-sm max-w-[85%]",
        isStatus
          ? "bg-red-500/10 border-red-500/20 text-red-300"
          : "bg-dicecho-panel/70 border-dicecho-border/50 text-dicecho-muted"
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

const DiceLogItem: React.FC<{
  log: Log;
  displayName: string;
  isKP: boolean;
  onDeleteMessage: (id: string) => void;
}> = ({ log, displayName, isKP, onDeleteMessage }) => {
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
      <div className="flex flex-col items-center py-4 animate-slide-up">
        <div className="relative overflow-hidden bg-dicecho-panel rounded-lg border-l-4 border-dicecho-border shadow-sm p-4 min-w-[260px] max-w-sm w-full opacity-75">
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
  } catch (error) {
    diceData.total = log.content as any;
  }

  let borderColor = isHidden ? "border-dicecho-primary" : "border-dicecho-primary";
  let textColor = isHidden ? "text-dicecho-primary" : "text-dicecho-primary";
  let label = isHidden ? "Secret Roll" : "Dice Roll";
  let iconColor = isHidden ? "text-dicecho-primary/10" : "text-dicecho-primary/10";

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
    <div className="flex flex-col items-center py-4 animate-slide-up">
      <div
        className={cn(
          "relative overflow-hidden bg-dicecho-panel rounded-lg border-l-4 shadow-sm p-4 min-w-[260px] max-w-sm w-full",
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
            <span className="text-sm font-bold text-white">{displayName}</span>
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
          <span className="text-slate-400 text-sm font-medium">投掷了</span>
          <span className="text-white text-lg font-bold">
            {diceData.expression ? (
              <span className="text-base">{diceData.expression}</span>
            ) : (
              `${diceData.count}D${diceData.type || 6}`
            )}
          </span>
          <span className="text-slate-600">:</span>
          <span className={cn("text-4xl font-black font-mono", textColor)}>
            {diceData.total}
          </span>
          {diceData.checkTarget !== undefined && (
            <span className="text-xs text-slate-500 font-mono ml-1">
              / {diceData.checkTarget}
            </span>
          )}
        </div>
        {diceData.details && diceData.details.length > 0 && (
          <div className="mt-3 pt-2 border-t border-dicecho-border/40 relative z-10">
            <div className="flex flex-wrap gap-1 text-xs font-mono text-slate-500">
              {diceData.details.map((detail: any, index: number) => (
                <span
                  key={index}
                  className="bg-dicecho-card px-1.5 py-0.5 rounded text-slate-300"
                >
                  {detail}
                </span>
              ))}
            </div>
          </div>
        )}
        {log.isMine && (
          <button
            onClick={() => onDeleteMessage(log.id)}
            className="p-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{
  log: Log;
  alignRight?: boolean;
  bubbleColor: string;
  onTouchStart: (id: string) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
}> = ({
  log,
  alignRight,
  bubbleColor,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
}) => (
  <div
    className={cn(
      "px-4 py-2 md:px-5 md:py-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap shadow-sm border backdrop-blur-sm relative select-text",
      bubbleColor,
      alignRight ? "rounded-tr-none" : "rounded-tl-none"
    )}
    onTouchStart={() => onTouchStart(log.id)}
    onTouchEnd={onTouchEnd}
    onTouchMove={onTouchMove}
  >
    {log.quote && (
      <div className="mb-2 p-2 rounded bg-black/20 border-l-2 border-white/30 text-xs text-white/70 select-text">
        <div className="font-bold mb-0.5 opacity-80">
          {log.quote.charName}:
        </div>
        <div className="line-clamp-2 italic">{log.quote.content}</div>
      </div>
    )}
    {log.type === "image" ? (
      <img
        src={log.content}
        alt="sent image"
        className="max-w-full rounded-lg cursor-pointer max-h-[300px] object-contain hover:opacity-90 transition-opacity"
        onClick={() => {
          const target = window.open();
          if (target) {
            target.document.write(
              `<img src="${log.content}" style="max-width: 100%; height: auto;" />`
            );
            target.document.title = "Image Preview";
            target.document.body.style.margin = "0";
            target.document.body.style.backgroundColor = "#0f172a";
            target.document.body.style.display = "flex";
            target.document.body.style.justifyContent = "center";
            target.document.body.style.alignItems = "center";
            target.document.body.style.minHeight = "100vh";
          }
        }}
      />
    ) : (
      log.content
    )}
  </div>
);
