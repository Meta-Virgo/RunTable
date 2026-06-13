import React, { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCcw,
  Send,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import type {
  Character,
  DirectConversationSummary,
  DirectMessage,
  RoomInviteLinkPreview,
  RoomInvitationInboxItem,
} from "../types";
import { useSocialMessages } from "../hooks/useSocialMessages";
import {
  declineRoomInvitation,
  getSocialMessageErrorMessage,
} from "../services/socialMessages";
import { AvatarUpload } from "./AvatarUpload";
import { Button, Textarea, cn } from "./UI";

interface MessagesProps {
  currentUserId: string | null;
  myCharacters: Character[];
  initialInviteToken?: string | null;
  onLoginRequest: () => void;
  onJoinRoom: (
    roomId: string,
    charId: string,
    password?: string | null,
    isRestoring?: boolean,
    invitation?: { invitationId?: string; inviteToken?: string }
  ) => Promise<void> | void;
  onInviteTokenHandled?: () => void;
}

export const Messages: React.FC<MessagesProps> = ({
  currentUserId,
  myCharacters,
  initialInviteToken,
  onLoginRequest,
  onJoinRoom,
  onInviteTokenHandled,
}) => {
  const [activePane, setActivePane] = useState<"direct" | "invites">(
    initialInviteToken ? "invites" : "direct"
  );
  const social = useSocialMessages({ currentUserId, initialInviteToken });
  const pendingInvites = social.invitations.filter(
    (invite) =>
      invite.invitation_status === "pending" &&
      invite.recipient_status === "pending"
  ).length;

  useEffect(() => {
    if (initialInviteToken) setActivePane("invites");
  }, [initialInviteToken]);

  if (!currentUserId) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-8 text-center">
        <Mail size={42} className="mx-auto text-dicecho-primary" />
        <h2 className="mt-4 text-xl font-bold text-white">消息</h2>
        <p className="mt-2 text-sm text-dicecho-muted">
          登录后可以查看好友私信和房间邀请。
        </p>
        <Button className="mx-auto mt-5" onClick={onLoginRequest}>
          登录
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-screen-xl gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-2">
          <SegmentButton
            icon={MessageSquare}
            label="好友私信"
            active={activePane === "direct"}
            badge={social.conversations.reduce(
              (total, item) => total + Number(item.unread_count || 0),
              0
            )}
            onClick={() => setActivePane("direct")}
          />
          <SegmentButton
            icon={Inbox}
            label="房间邀请"
            active={activePane === "invites"}
            badge={pendingInvites}
            onClick={() => setActivePane("invites")}
          />
        </div>

        {activePane === "direct" ? (
          <ConversationList
            conversations={social.conversations}
            activeConversationId={social.activeConversation?.conversation_id}
            onSelect={social.selectConversation}
          />
        ) : (
          <InvitationList
            invitations={social.invitations}
            activeInvitationId={social.activeInvite?.invitation_id}
            hasLinkPreview={Boolean(social.activeLinkPreview)}
            onSelect={social.selectInvitation}
          />
        )}
      </aside>

      <section className="min-h-[36rem] overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75">
        <div className="flex items-center justify-between border-b border-dicecho-border/35 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-white">
              {activePane === "direct" ? "好友私信" : "房间邀请"}
            </h2>
            <p className="mt-0.5 text-xs text-dicecho-muted">
              {activePane === "direct"
                ? "仅已互为好友的用户可以继续发送。"
                : "接受邀请后选择调查员进入房间。"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={social.isLoading ? Loader2 : RefreshCcw}
            onClick={() => void social.refreshAll()}
          >
            刷新
          </Button>
        </div>

        {activePane === "direct" ? (
          <DirectThread
            currentUserId={currentUserId}
            conversation={social.activeConversation}
            messages={social.messages}
            onSend={social.sendMessage}
          />
        ) : (
          <InvitationDetail
            myCharacters={myCharacters}
            invite={social.activeInvite}
            linkPreview={social.activeLinkPreview}
            linkToken={social.activeLinkToken}
            onDeclined={async (invitationId) => {
              const { error } = await declineRoomInvitation(invitationId);
              if (error) {
                alert(getSocialMessageErrorMessage(error, "拒绝邀请失败"));
              }
              await social.refreshInvitations();
            }}
            onAccepted={async (input) => {
              if (input.kind === "friend") {
                await onJoinRoom(input.roomId, input.characterId, null, false, {
                  invitationId: input.invitationId,
                });
              } else {
                await onJoinRoom(input.roomId, input.characterId, null, false, {
                  inviteToken: input.token,
                });
                onInviteTokenHandled?.();
              }
            }}
          />
        )}
      </section>
    </div>
  );
};

const SegmentButton: React.FC<{
  icon: React.ElementType;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}> = ({ icon: Icon, label, active, badge = 0, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
      active
        ? "bg-dicecho-primary/25 text-white"
        : "text-dicecho-muted hover:bg-white/10 hover:text-white"
    )}
  >
    <Icon size={16} />
    <span className="flex-1 text-left">{label}</span>
    {badge > 0 && (
      <span className="rounded-full bg-dicecho-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
);

const ConversationList: React.FC<{
  conversations: DirectConversationSummary[];
  activeConversationId?: string;
  onSelect: (conversationId: string) => void;
}> = ({ conversations, activeConversationId, onSelect }) => (
  <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75">
    {conversations.length === 0 ? (
      <EmptyState icon={MessageSquare} text="暂无私信会话" />
    ) : (
      conversations.map((conversation) => (
        <button
          key={conversation.conversation_id}
          type="button"
          onClick={() => onSelect(conversation.conversation_id)}
          className={cn(
            "flex w-full items-center gap-3 border-b border-dicecho-border/25 px-3 py-3 text-left transition-colors last:border-b-0",
            activeConversationId === conversation.conversation_id
              ? "bg-dicecho-primary/18"
              : "hover:bg-white/10"
          )}
        >
          <AvatarUpload
            url={conversation.friend_avatar_url}
            onUpload={() => {}}
            editable={false}
            size={40}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {conversation.friend_nickname || "未命名用户"}
            </span>
            <span className="mt-0.5 block truncate text-xs text-dicecho-muted">
              {conversation.last_message_content || "还没有消息"}
            </span>
          </span>
          {Number(conversation.unread_count || 0) > 0 && (
            <span className="rounded-full bg-dicecho-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
              {conversation.unread_count}
            </span>
          )}
        </button>
      ))
    )}
  </div>
);

const InvitationList: React.FC<{
  invitations: RoomInvitationInboxItem[];
  activeInvitationId?: string;
  hasLinkPreview: boolean;
  onSelect: (invitationId: string) => void;
}> = ({ invitations, activeInvitationId, hasLinkPreview, onSelect }) => (
  <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75">
    {hasLinkPreview && (
      <div className="border-b border-dicecho-border/25 bg-dicecho-primary/12 px-3 py-3 text-sm font-semibold text-white">
        当前邀请链接
      </div>
    )}
    {invitations.length === 0 ? (
      <EmptyState icon={Inbox} text="暂无房间邀请" />
    ) : (
      invitations.map((invite) => (
        <button
          key={invite.invitation_id}
          type="button"
          onClick={() => onSelect(invite.invitation_id)}
          className={cn(
            "flex w-full items-start gap-3 border-b border-dicecho-border/25 px-3 py-3 text-left transition-colors last:border-b-0",
            activeInvitationId === invite.invitation_id
              ? "bg-dicecho-primary/18"
              : "hover:bg-white/10"
          )}
        >
          <CalendarClock size={18} className="mt-0.5 text-dicecho-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {invite.room_title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-dicecho-muted">
              {invite.keeper_nickname || "KP"} 邀请你加入
            </span>
          </span>
          <StatusPill status={invite.recipient_status} />
        </button>
      ))
    )}
  </div>
);

const DirectThread: React.FC<{
  currentUserId: string;
  conversation: DirectConversationSummary | null;
  messages: DirectMessage[];
  onSend: (content: string) => Promise<{ ok: boolean; message?: string }>;
}> = ({ currentUserId, conversation, messages, onSend }) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  if (!conversation) {
    return <EmptyState icon={MessageSquare} text="选择一个好友开始查看私信" />;
  }

  const submit = async () => {
    if (!draft.trim()) return;
    setSending(true);
    const result = await onSend(draft);
    setSending(false);
    if (result.ok) {
      setDraft("");
    } else if (result.message) {
      alert(result.message);
    }
  };

  return (
    <div className="flex h-[36rem] flex-col">
      <div className="flex items-center gap-3 border-b border-dicecho-border/35 px-5 py-4">
        <AvatarUpload
          url={conversation.friend_avatar_url}
          onUpload={() => {}}
          editable={false}
          size={42}
        />
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">
            {conversation.friend_nickname || "未命名用户"}
          </div>
          <div className="text-xs text-dicecho-muted">
            UID: {conversation.friend_user_code || "---"}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 custom-scrollbar">
        {messages.length === 0 ? (
          <EmptyState icon={Send} text="还没有消息，打个招呼吧" compact />
        ) : (
          messages.map((message) => (
            <DirectMessageBubble
              key={message.id}
              message={message}
              isMine={message.sender_id === currentUserId}
            />
          ))
        )}
      </div>

      <div className="border-t border-dicecho-border/35 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="写一条消息..."
          />
          <Button
            icon={sending ? Loader2 : Send}
            disabled={!draft.trim() || sending}
            onClick={submit}
            className="sm:self-end"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

const DirectMessageBubble: React.FC<{
  message: DirectMessage;
  isMine: boolean;
}> = ({ message, isMine }) => (
  <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
    <div
      className={cn(
        "max-w-[78%] rounded-lg border px-3 py-2",
        isMine
          ? "border-dicecho-primary/30 bg-dicecho-primary/20 text-white"
          : "border-dicecho-border/35 bg-dicecho-card/70 text-slate-200"
      )}
    >
      <p className="whitespace-pre-wrap break-words text-sm leading-6">
        {message.content}
      </p>
      <p className="mt-1 text-[10px] text-dicecho-muted">
        {new Date(message.created_at).toLocaleString()}
      </p>
    </div>
  </div>
);

const InvitationDetail: React.FC<{
  myCharacters: Character[];
  invite: RoomInvitationInboxItem | null;
  linkPreview: RoomInviteLinkPreview | null;
  linkToken: string | null;
  onDeclined: (invitationId: string) => Promise<void>;
  onAccepted: (
    input:
      | {
          kind: "friend";
          invitationId: string;
          roomId: string;
          characterId: string;
        }
      | { kind: "link"; token: string; roomId: string; characterId: string }
  ) => Promise<void>;
}> = ({
  myCharacters,
  invite,
  linkPreview,
  linkToken,
  onDeclined,
  onAccepted,
}) => {
  const target = linkPreview || invite;
  const [selectedCharId, setSelectedCharId] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setSelectedCharId((previous) => previous || myCharacters[0]?.id || "");
  }, [myCharacters]);

  if (!target) {
    return <EmptyState icon={Inbox} text="选择一个邀请查看详情" />;
  }

  const isPending =
    linkPreview ||
    (invite?.invitation_status === "pending" &&
      invite?.recipient_status === "pending");

  const accept = async () => {
    if (!selectedCharId || !isPending) return;
    setWorking(true);
    if (linkPreview && linkToken) {
      await onAccepted({
        kind: "link",
        token: linkToken,
        roomId: linkPreview.room_id,
        characterId: selectedCharId,
      });
    } else if (invite) {
      await onAccepted({
        kind: "friend",
        invitationId: invite.invitation_id,
        roomId: invite.room_id,
        characterId: selectedCharId,
      });
    }
    setWorking(false);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-card/60">
        {target.room_cover_image_url && (
          <img
            src={target.room_cover_image_url}
            alt=""
            className="h-52 w-full object-cover"
          />
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-dicecho-muted">
            <span>{target.room_type === "voice" ? "语音团" : "文字团"}</span>
            {target.room_has_password && (
              <span className="inline-flex items-center gap-1 text-amber-200">
                <ShieldCheck size={13} />
                邀请可免房间密码
              </span>
            )}
          </div>
          <h3 className="mt-2 text-2xl font-bold text-white">
            {target.room_title}
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-dicecho-muted">
            {target.room_description || "暂无房间简介"}
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <InfoLine
              label="KP"
              value={target.keeper_nickname || "未命名用户"}
            />
            <InfoLine
              label="开团时间"
              value={
                target.starts_at
                  ? new Date(target.starts_at).toLocaleString()
                  : "未设置"
              }
            />
            <InfoLine
              label="过期时间"
              value={
                target.expires_at
                  ? new Date(target.expires_at).toLocaleString()
                  : "不自动过期"
              }
            />
            <InfoLine
              label="状态"
              value={
                linkPreview
                  ? "链接有效"
                  : `${invite?.recipient_status || "pending"}`
              }
            />
          </div>
          {target.note && (
            <p className="mt-4 rounded-lg border border-dicecho-border/35 bg-dicecho-panel/70 p-3 text-sm text-slate-300">
              {target.note}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-card/60 p-4">
        <div className="mb-3 text-sm font-semibold text-white">选择调查员</div>
        {myCharacters.length === 0 ? (
          <p className="text-sm text-amber-200">
            需要先创建一个调查员角色，才能接受邀请进入房间。
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {myCharacters.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => setSelectedCharId(character.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                  selectedCharId === character.id
                    ? "border-dicecho-primary/60 bg-dicecho-primary/18 text-white"
                    : "border-dicecho-border/35 bg-dicecho-panel/60 text-slate-200 hover:border-dicecho-primary/40"
                )}
              >
                <User size={16} className="text-dicecho-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {character.name}
                  </span>
                  <span className="block truncate text-xs text-dicecho-muted">
                    {character.job || "调查员"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {invite && isPending && (
          <Button
            variant="ghost"
            icon={X}
            disabled={working}
            onClick={async () => {
              setWorking(true);
              await onDeclined(invite.invitation_id);
              setWorking(false);
            }}
          >
            拒绝
          </Button>
        )}
        <Button
          icon={working ? Loader2 : Check}
          disabled={!selectedCharId || !isPending || working}
          onClick={accept}
        >
          接受并进入
        </Button>
      </div>
    </div>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={cn(
      "rounded-full px-2 py-0.5 text-[10px] font-bold",
      status === "pending"
        ? "bg-dicecho-primary/20 text-dicecho-primary"
        : status === "accepted"
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-slate-500/15 text-slate-300"
    )}
  >
    {status}
  </span>
);

const InfoLine: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg border border-dicecho-border/30 bg-dicecho-panel/60 px-3 py-2">
    <div className="text-xs text-dicecho-muted">{label}</div>
    <div className="mt-1 truncate text-sm text-slate-200">{value}</div>
  </div>
);

const EmptyState: React.FC<{
  icon: React.ElementType;
  text: string;
  compact?: boolean;
}> = ({ icon: Icon, text, compact }) => (
  <div
    className={cn(
      "grid place-items-center text-center text-dicecho-muted",
      compact ? "py-10" : "min-h-[20rem] p-8"
    )}
  >
    <div>
      <Icon size={38} className="mx-auto mb-3 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  </div>
);
