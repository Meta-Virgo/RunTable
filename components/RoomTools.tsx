import React from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardList,
  Copy,
  Link,
  Lock,
  Send,
  Settings,
  Sparkles,
  Tags,
} from "lucide-react";
import type { Friendship, Log, RoomInvitationOutboxItem } from "../types";
import { Button, Input, Textarea, cn } from "./UI";
import {
  createClue,
  deleteClue,
  linkClueToEvidence,
  listVisibleClues,
  updateClue,
} from "../services/clueWall";
import {
  createRoomFriendInvitation,
  createRoomLinkInvitation,
  fetchRoomInvitationOutbox,
  getSocialMessageErrorMessage,
  revokeRoomInvitation,
  buildRoomInviteUrl,
} from "../services/socialMessages";
import { fetchAcceptedFriendships } from "../services/friendsRepository";
import { nowIso, parseTags, useRoomToolsState } from "../hooks/useRoomToolsState";

interface RoomToolsProps {
  roomId: string;
  isKP: boolean;
  userId?: string;
  logs: Log[];
  onDeleteRoom: () => void;
  onClearChat: () => void;
  onConcludeGame: () => void;
}

const tabs = [
  { id: "clues", label: "线索墙", icon: ClipboardList },
  { id: "invite", label: "邀请排期", icon: CalendarClock },
  { id: "management", label: "跑团管理", icon: Settings },
] as const;

export const RoomTools: React.FC<RoomToolsProps> = ({
  roomId,
  isKP,
  userId,
  logs,
  onDeleteRoom,
  onClearChat,
  onConcludeGame,
}) => {
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [clearChatConfirm, setClearChatConfirm] = React.useState(false);
  const {
    activeTab,
    setActiveTab,
    clues,
    setClues,
    clueTitle,
    setClueTitle,
    clueBody,
    setClueBody,
    clueTags,
    setClueTags,
    keeperNote,
    setKeeperNote,
    startsAt,
    setStartsAt,
    scheduleNote,
    setScheduleNote,
  } = useRoomToolsState(roomId);

  const viewerRole = isKP ? "keeper" : "player";
  const visibleClues = listVisibleClues(clues, {
    role: viewerRole,
    status: "active",
  });
  const latestPublicLog = [...logs]
    .reverse()
    .find((log: Log) => !log.recipientId && log.type !== "dice_secret");
  const [friends, setFriends] = React.useState<Friendship[]>([]);
  const [selectedFriendId, setSelectedFriendId] = React.useState("");
  const [outbox, setOutbox] = React.useState<RoomInvitationOutboxItem[]>([]);
  const [latestLinkUrl, setLatestLinkUrl] = React.useState("");
  const [inviteBusy, setInviteBusy] = React.useState(false);
  const refreshInvitations = React.useCallback(async () => {
    if (!isKP || !userId) return;
    const [{ data: friendRows }, { data: invitationRows }] = await Promise.all([
      fetchAcceptedFriendships(userId),
      fetchRoomInvitationOutbox(roomId),
    ]);

    setFriends((friendRows || []) as Friendship[]);
    setOutbox(invitationRows || []);
  }, [isKP, roomId, userId]);

  React.useEffect(() => {
    refreshInvitations();
  }, [refreshInvitations]);

  const handleCreateClue = () => {
    if (!clueTitle.trim()) return;
    setClues((prev) => [
      createClue({
        id: `clue-${Date.now()}`,
        roomId,
        title: clueTitle.trim(),
        body: clueBody.trim(),
        tags: parseTags(clueTags),
        keeperNote: keeperNote.trim() || null,
        createdByUserId: userId || "unknown",
        now: nowIso(),
      }),
      ...prev,
    ]);
    setClueTitle("");
    setClueBody("");
    setClueTags("");
    setKeeperNote("");
  };

  const getInviteStartsAt = () =>
    startsAt ? new Date(startsAt).toISOString() : null;

  const handleSendFriendInvite = async () => {
    if (!selectedFriendId) return;
    setInviteBusy(true);
    const { error } = await createRoomFriendInvitation({
      roomId,
      recipientUserId: selectedFriendId,
      startsAt: getInviteStartsAt(),
      note: scheduleNote.trim() || null,
    });
    setInviteBusy(false);

    if (error) {
      alert(getSocialMessageErrorMessage(error, "发送邀请失败"));
      return;
    }

    await refreshInvitations();
  };

  const handleCreateLinkInvite = async () => {
    setInviteBusy(true);
    const { data, error } = await createRoomLinkInvitation({
      roomId,
      startsAt: getInviteStartsAt(),
      note: scheduleNote.trim() || null,
    });
    setInviteBusy(false);

    if (error || !data) {
      alert(getSocialMessageErrorMessage(error, "生成邀请链接失败"));
      return;
    }

    const url = buildRoomInviteUrl(window.location.origin, data.token);
    setLatestLinkUrl(url);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    await refreshInvitations();
  };

  const handleRevokeInvite = async (invitationId: string) => {
    const { error } = await revokeRoomInvitation(invitationId);
    if (error) {
      alert(getSocialMessageErrorMessage(error, "撤销邀请失败"));
      return;
    }
    await refreshInvitations();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap gap-2">
          {tabs
            .filter(
              (tab) =>
                tab.id !== "management" || isKP
            )
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "bg-dicecho-primary/20 border-dicecho-primary/40 text-white"
                    : "bg-dicecho-card/70 border-dicecho-border/40 text-dicecho-muted hover:text-white hover:bg-dicecho-raised/70"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
        </div>

        {activeTab === "clues" && (
          <section className="grid lg:grid-cols-[360px_1fr] gap-4">
            {isKP && (
              <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <ClipboardList size={18} className="text-dicecho-primary" />
                  新线索
                </h2>
                <Input label="标题" value={clueTitle} onChange={(e) => setClueTitle(e.target.value)} />
                <Textarea label="内容" rows={4} value={clueBody} onChange={(e) => setClueBody(e.target.value)} />
                <Input label="标签" value={clueTags} onChange={(e) => setClueTags(e.target.value)} placeholder="人物 物品 庄园" />
                <Textarea label="Keeper 备注" rows={3} value={keeperNote} onChange={(e) => setKeeperNote(e.target.value)} />
                <Button icon={Sparkles} onClick={handleCreateClue} disabled={!clueTitle.trim()}>
                  创建隐藏线索
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {visibleClues.length === 0 && (
                <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/55 p-6 text-dicecho-muted">
                  暂无线索
                </div>
              )}
              {visibleClues.map((clue) => (
                <article
                  key={clue.id}
                  className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white">{clue.title}</h3>
                      <p className="text-sm text-slate-300 mt-1">{clue.body}</p>
                    </div>
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                      {clue.visibility === "hidden" ? <Lock size={13} /> : <Sparkles size={13} />}
                      {clue.visibility === "hidden" ? "隐藏" : "已公开"}
                    </span>
                  </div>
                  {clue.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {clue.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-lg bg-dicecho-primary/15 text-white border border-dicecho-primary/25 inline-flex items-center gap-1">
                          <Tags size={12} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {clue.keeperNote && (
                    <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                      {clue.keeperNote}
                    </p>
                  )}
                  {clue.evidenceLinks.length > 0 && (
                    <div className="space-y-1">
                      {clue.evidenceLinks.map((evidence) => (
                        <div key={evidence.id} className="text-xs text-slate-400 inline-flex items-center gap-2 mr-3">
                          <Link size={13} />
                          {evidence.label}
                        </div>
                      ))}
                    </div>
                  )}
                  {isKP && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          setClues((prev) =>
                            prev.map((item) =>
                              item.id === clue.id
                                ? updateClue(item, {
                                    visibility:
                                      item.visibility === "hidden"
                                        ? "revealed"
                                        : "hidden",
                                    now: nowIso(),
                                  })
                                : item
                            )
                          )
                        }
                      >
                        {clue.visibility === "hidden" ? "揭示" : "隐藏"}
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={!latestPublicLog}
                        onClick={() =>
                          latestPublicLog &&
                          setClues((prev) =>
                            prev.map((item) =>
                              item.id === clue.id
                                ? linkClueToEvidence(item, {
                                    id: `evidence-${Date.now()}`,
                                    type:
                                      latestPublicLog.type === "image"
                                        ? "image"
                                        : "message",
                                    sourceId: latestPublicLog.id,
                                    visibility: "public",
                                    label: `Log ${latestPublicLog.timestamp}`,
                                  })
                                : item
                            )
                          )
                        }
                      >
                        关联最新日志
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() =>
                          setClues((prev) =>
                            prev.map((item) =>
                              item.id === clue.id ? deleteClue(item, nowIso()) : item
                            )
                          )
                        }
                      >
                        删除
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "invite" && (
          <RoomInvitationsPanel
            roomId={roomId}
            isKP={isKP}
            userId={userId}
            friends={friends}
            selectedFriendId={selectedFriendId}
            setSelectedFriendId={setSelectedFriendId}
            startsAt={startsAt}
            setStartsAt={setStartsAt}
            scheduleNote={scheduleNote}
            setScheduleNote={setScheduleNote}
            outbox={outbox}
            latestLinkUrl={latestLinkUrl}
            inviteBusy={inviteBusy}
            refreshInvitations={refreshInvitations}
            handleSendFriendInvite={handleSendFriendInvite}
            handleCreateLinkInvite={handleCreateLinkInvite}
            handleRevokeInvite={handleRevokeInvite}
          />
        )}

        {activeTab === "management" && isKP && (
          <section className="space-y-4">
            <div className="rounded-lg border border-dicecho-accent/30 bg-dicecho-accent/12 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">完结跑团</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  当跑团结束时使用此功能。系统将生成跑团履历，记录所有玩家的最终状态，并将房间标记为“已完成”。
                </p>
              </div>
              <Button
                onClick={onConcludeGame}
                variant="ghost"
                size="lg"
                icon={Check}
                className="border border-dicecho-accent/70 bg-dicecho-accent/15 text-[#bff1d5] hover:bg-dicecho-accent/25 hover:text-white hover:border-dicecho-accent"
              >
                结团结算
              </Button>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">
                  清空聊天记录
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  删除当前房间的所有聊天记录（包括骰子和图片）。此操作不可恢复。
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {clearChatConfirm ? (
                  <>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        onClick={() => {
                          onClearChat();
                          setClearChatConfirm(false);
                        }}
                        variant="dangerActive"
                        icon={AlertTriangle}
                        size="lg"
                      >
                        确认清空
                      </Button>
                      <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider animate-pulse">
                        此操作不可撤销
                      </span>
                    </div>
                    <Button
                      onClick={() => setClearChatConfirm(false)}
                      variant="ghost"
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setClearChatConfirm(true)}
                    variant="danger"
                    icon={AlertTriangle}
                    size="lg"
                  >
                    清空记录
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">删除房间</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  这将永久删除该房间及其所有数据。此操作不可恢复。
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {deleteConfirm ? (
                  <>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        onClick={() => {
                          onDeleteRoom();
                          setDeleteConfirm(false);
                        }}
                        variant="dangerActive"
                        icon={AlertTriangle}
                        size="lg"
                      >
                        确认删除
                      </Button>
                      <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider animate-pulse">
                        此操作不可撤销
                      </span>
                    </div>
                    <Button
                      onClick={() => setDeleteConfirm(false)}
                      variant="ghost"
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setDeleteConfirm(true)}
                    variant="danger"
                    icon={AlertTriangle}
                    size="lg"
                  >
                    删除房间
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const RoomInvitationsPanel: React.FC<{
  roomId: string;
  isKP: boolean;
  userId?: string;
  friends: Friendship[];
  selectedFriendId: string;
  setSelectedFriendId: (value: string) => void;
  startsAt: string;
  setStartsAt: (value: string) => void;
  scheduleNote: string;
  setScheduleNote: (value: string) => void;
  outbox: RoomInvitationOutboxItem[];
  latestLinkUrl: string;
  inviteBusy: boolean;
  refreshInvitations: () => Promise<void>;
  handleSendFriendInvite: () => Promise<void>;
  handleCreateLinkInvite: () => Promise<void>;
  handleRevokeInvite: (invitationId: string) => Promise<void>;
}> = ({
  isKP,
  userId,
  friends,
  selectedFriendId,
  setSelectedFriendId,
  startsAt,
  setStartsAt,
  scheduleNote,
  setScheduleNote,
  outbox,
  latestLinkUrl,
  inviteBusy,
  refreshInvitations,
  handleSendFriendInvite,
  handleCreateLinkInvite,
  handleRevokeInvite,
}) => (
  <section className="grid lg:grid-cols-[360px_1fr] gap-4">
    {isKP && (
      <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
        <h2 className="text-white font-bold flex items-center gap-2">
          <CalendarClock size={18} className="text-dicecho-primary" />
          房间邀请
        </h2>
        <Input
          label="开团时间"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
        <Textarea
          label="邀请备注"
          rows={4}
          value={scheduleNote}
          onChange={(event) => setScheduleNote(event.target.value)}
        />
        <label className="text-xs text-dicecho-muted mb-1.5 font-medium ml-1">
          选择好友
        </label>
        <select
          value={selectedFriendId}
          onChange={(event) => setSelectedFriendId(event.target.value)}
          className="w-full bg-dicecho-panel/70 border border-dicecho-border/50 text-slate-100 rounded-lg px-4 py-2.5 focus:outline-none focus:border-dicecho-primary/70 transition-colors text-sm"
        >
          <option value="">选择要邀请的好友</option>
          {friends.map((friendship) => {
            const isSender = friendship.user_id === userId;
            const profile = isSender
              ? friendship.friend_profile
              : (friendship as any).user_profile;
            return (
              <option key={friendship.id} value={profile?.id || ""}>
                {profile?.nickname || profile?.user_code || "未命名用户"}
              </option>
            );
          })}
        </select>
        <div className="flex flex-col gap-2">
          <Button
            icon={Send}
            onClick={() => void handleSendFriendInvite()}
            disabled={!selectedFriendId || inviteBusy}
          >
            发送好友邀请
          </Button>
          <Button
            variant="secondary"
            icon={Link}
            onClick={() => void handleCreateLinkInvite()}
            disabled={inviteBusy}
          >
            生成邀请链接
          </Button>
        </div>
        {latestLinkUrl && (
          <div className="rounded-lg border border-dicecho-primary/25 bg-dicecho-primary/10 p-3 text-xs text-slate-200">
            <div className="mb-2 font-semibold text-white">
              链接已生成并尝试复制
            </div>
            <div className="break-all text-dicecho-muted">{latestLinkUrl}</div>
            <Button
              className="mt-2"
              size="xs"
              variant="ghost"
              icon={Copy}
              onClick={() => void navigator.clipboard?.writeText(latestLinkUrl)}
            >
              复制
            </Button>
          </div>
        )}

      </div>
    )}
    <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-white font-bold">已发邀请</h2>
        {isKP && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => void refreshInvitations()}
          >
            刷新
          </Button>
        )}
      </div>
      {!isKP && (
        <p className="text-sm text-dicecho-muted">
          只有 Keeper 可以创建和管理房间邀请。
        </p>
      )}
      {isKP && outbox.length === 0 && (
        <p className="text-sm text-dicecho-muted">暂无已发邀请。</p>
      )}
      {isKP &&
        outbox.map((item) => (
          <article
            key={`${item.invitation_id}-${item.recipient_user_id || "link"}`}
            className="rounded-lg border border-dicecho-border/35 bg-dicecho-panel/55 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">
                  {item.invite_type === "link"
                    ? "邀请链接"
                    : item.recipient_nickname || "未命名好友"}
                </div>
                <div className="mt-1 text-xs text-dicecho-muted">
                  {item.invitation_status}
                  {item.recipient_status ? ` / ${item.recipient_status}` : ""}
                  {item.expires_at
                    ? ` · ${new Date(item.expires_at).toLocaleString()} 过期`
                    : ""}
                </div>
              </div>
              {item.invitation_status === "pending" && (
                <Button
                  size="xs"
                  variant="danger"
                  onClick={() => void handleRevokeInvite(item.invitation_id)}
                >
                  撤销
                </Button>
              )}
            </div>
            {item.note && (
              <p className="mt-2 text-xs text-slate-300">{item.note}</p>
            )}
          </article>
        ))}
    </div>
  </section>
);
