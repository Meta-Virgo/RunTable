import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type {
  DirectConversationSummary,
  DirectMessage,
  RoomInviteLinkPreview,
  RoomInvitationInboxItem,
  SocialMessageBadgeCounts,
} from "../types";
import {
  fetchDirectConversationSummaries,
  fetchDirectMessages,
  fetchRoomInvitationInbox,
  fetchRoomInviteLinkPreview,
  fetchSocialMessageBadgeCounts,
  getSocialMessageErrorMessage,
  getTotalSocialMessageBadgeCount,
  getOrCreateDirectConversation,
  isSocialMessageSchemaMissingError,
  markDirectConversationRead,
  sendDirectMessage,
} from "../services/socialMessages";

export function useSocialMessageBadges(currentUserId: string | null) {
  const [counts, setCounts] = useState<SocialMessageBadgeCounts | null>(null);

  const refresh = useCallback(async () => {
    if (!currentUserId) {
      setCounts(null);
      return;
    }

    const { data, error } = await fetchSocialMessageBadgeCounts();
    if (isSocialMessageSchemaMissingError(error)) {
      setCounts(null);
      return;
    }
    setCounts(data);
  }, [currentUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`social-badges:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_conversation_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_invitation_recipients",
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refresh]);

  return {
    counts,
    total: getTotalSocialMessageBadgeCount(counts),
    refresh,
  };
}

export function useSocialMessages(input: {
  currentUserId: string | null;
  initialInviteToken?: string | null;
}) {
  const { currentUserId, initialInviteToken } = input;
  const [conversations, setConversations] = useState<
    DirectConversationSummary[]
  >([]);
  const [invitations, setInvitations] = useState<RoomInvitationInboxItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null);
  const [activeLinkPreview, setActiveLinkPreview] =
    useState<RoomInviteLinkPreview | null>(null);
  const [activeLinkToken, setActiveLinkToken] = useState<string | null>(
    initialInviteToken || null
  );
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.conversation_id === activeConversationId
      ) || null,
    [activeConversationId, conversations]
  );

  const activeInvite = useMemo(
    () =>
      invitations.find(
        (invitation) => invitation.invitation_id === activeInviteId
      ) || null,
    [activeInviteId, invitations]
  );

  const refreshConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      return;
    }

    const { data, error } = await fetchDirectConversationSummaries();
    if (isSocialMessageSchemaMissingError(error)) {
      setConversations([]);
      return;
    }
    setConversations(data || []);
  }, [currentUserId]);

  const refreshInvitations = useCallback(async () => {
    if (!currentUserId) {
      setInvitations([]);
      return;
    }

    const { data, error } = await fetchRoomInvitationInbox();
    if (isSocialMessageSchemaMissingError(error)) {
      setInvitations([]);
      return;
    }
    setInvitations(data || []);
  }, [currentUserId]);

  const refreshMessages = useCallback(
    async (conversationId: string | null = activeConversationId) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      const { data, error } = await fetchDirectMessages(conversationId);
      if (isSocialMessageSchemaMissingError(error)) {
        setMessages([]);
        return;
      }
      setMessages(data || []);
      await markDirectConversationRead(conversationId);
      refreshConversations();
    },
    [activeConversationId, refreshConversations]
  );

  const refreshLinkPreview = useCallback(
    async (token: string | null = activeLinkToken) => {
      if (!token || !currentUserId) {
        setActiveLinkPreview(null);
        return;
      }

      const { data, error } = await fetchRoomInviteLinkPreview(token);
      if (isSocialMessageSchemaMissingError(error)) {
        setActiveLinkPreview(null);
        return;
      }
      setActiveLinkPreview(data || null);
    },
    [activeLinkToken, currentUserId]
  );

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      refreshConversations(),
      refreshInvitations(),
      refreshLinkPreview(),
    ]);
    setIsLoading(false);
  }, [refreshConversations, refreshInvitations, refreshLinkPreview]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (initialInviteToken) {
      setActiveLinkToken(initialInviteToken);
      setActiveConversationId(null);
      setActiveInviteId(null);
    }
  }, [initialInviteToken]);

  useEffect(() => {
    if (!currentUserId) return;

    const openDirectMessage = async (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId) return;

      const { data, error } = await getOrCreateDirectConversation(
        detail.userId
      );
      if (error || !data) {
        alert(getSocialMessageErrorMessage(error, "无法打开私信会话"));
        return;
      }

      await refreshConversations();
      setActiveConversationId(data);
      setActiveInviteId(null);
      setActiveLinkToken(null);
      setActiveLinkPreview(null);
    };

    window.addEventListener(
      "runtable:open-direct-message",
      openDirectMessage
    );
    return () => {
      window.removeEventListener(
        "runtable:open-direct-message",
        openDirectMessage
      );
    };
  }, [currentUserId, refreshConversations]);

  useEffect(() => {
    refreshMessages(activeConversationId);
  }, [activeConversationId, refreshMessages]);

  useEffect(() => {
    refreshLinkPreview(activeLinkToken);
  }, [activeLinkToken, refreshLinkPreview]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`social-messages:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_conversation_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        refreshConversations
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        () => {
          refreshConversations();
          refreshMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_invitation_recipients",
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        refreshInvitations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    refreshConversations,
    refreshInvitations,
    refreshMessages,
  ]);

  const selectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    setActiveInviteId(null);
    setActiveLinkToken(null);
    setActiveLinkPreview(null);
  }, []);

  const selectInvitation = useCallback((invitationId: string) => {
    setActiveInviteId(invitationId);
    setActiveConversationId(null);
    setActiveLinkToken(null);
    setActiveLinkPreview(null);
  }, []);

  const openInviteToken = useCallback((token: string) => {
    setActiveLinkToken(token);
    setActiveConversationId(null);
    setActiveInviteId(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversation) return { ok: false };

      const { error } = await sendDirectMessage({
        recipientUserId: activeConversation.friend_user_id,
        content,
      });

      if (error) {
        return {
          ok: false,
          message: getSocialMessageErrorMessage(
            error,
            "发送失败，请稍后重试。"
          ),
        };
      }

      await refreshMessages(activeConversation.conversation_id);
      await refreshConversations();
      return { ok: true };
    },
    [activeConversation, refreshConversations, refreshMessages]
  );

  return {
    conversations,
    invitations,
    activeConversation,
    activeInvite,
    activeLinkPreview,
    activeLinkToken,
    messages,
    isLoading,
    refreshAll,
    refreshConversations,
    refreshInvitations,
    refreshMessages,
    refreshLinkPreview,
    selectConversation,
    selectInvitation,
    openInviteToken,
    sendMessage,
  };
}
