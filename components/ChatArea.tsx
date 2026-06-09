import React, { useRef, useEffect, useState } from "react";
import { Log, Character, ModuleInfo, Profile } from "../types";
import { useElasticScroll } from "../hooks/useElasticScroll";
import { fetchProfileDetails } from "../services/profiles";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatLogViewport } from "./chat/ChatLogViewport";
import { ChatUserProfileModal } from "./chat/ChatUserProfileModal";

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
  const [quoteMessage, setQuoteMessage] = useState<{
    id: string;
    content: string;
    charName: string;
  } | null>(null);

  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileLoadingUserId, setProfileLoadingUserId] = useState<string | null>(
    null
  );
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useElasticScroll(logsContainerRef, contentRef);

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

  useEffect(() => {
    // logsEndRef.current?.scrollIntoView({ behavior: "auto" }); // Removed in favor of auto-scroll logic
  }, [logs]);

  const openUserProfile = async (userId?: string | null) => {
    if (!userId || profileLoadingUserId) return;

    setProfileLoadingUserId(userId);
    const { data, error } = await fetchProfileDetails(userId);
    setProfileLoadingUserId(null);

    if (error || !data) {
      alert("用户信息加载失败，请稍后重试");
      return;
    }

    setSelectedProfile(data as Profile);
  };

  return (
    <>
      <ChatLogViewport
        logs={logs}
        characters={characters}
        isKP={isKP}
        hasMore={hasMore}
        isLoading={isLoading}
        logsContainerRef={logsContainerRef}
        contentRef={contentRef}
        logsEndRef={logsEndRef}
        activeMessageId={activeMessageId}
        profileLoadingUserId={profileLoadingUserId}
        onScroll={handleScroll}
        onOpenUserProfile={openUserProfile}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onQuoteMessage={setQuoteMessage}
        onClearActiveMessage={() => setActiveMessageId(null)}
        onDeleteMessage={onDeleteMessage}
      />

      <ChatComposer
        logs={logs}
        activeChar={activeChar}
        activeCharId={activeCharId}
        characters={characters}
        moduleInfo={moduleInfo}
        isKP={isKP}
        kpId={kpId}
        isVip={isVip}
        quoteMessage={quoteMessage}
        onSend={onSend}
        onRollDice={onRollDice}
        onShowStory={onShowStory}
        onClearQuote={() => setQuoteMessage(null)}
        onMessageSent={() => setActiveMessageId(null)}
      />

      <ChatUserProfileModal
        profile={selectedProfile}
        onClose={() => setSelectedProfile(null)}
      />
    </>
  );
};
