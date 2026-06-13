import React, { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardList,
  Copy,
  FileText,
  Link,
  Share2,
  Lock,
  Send,
  Settings,
  Shield,
  Sparkles,
  Tags,
} from "lucide-react";
import type { Channel, Friendship, Log, RoomInvitationOutboxItem } from "../types";
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
import {
  createPost,
  createPostModules,
  fetchChannels,
} from "../services/squareFeedRepository";
import {
  createRoomLogExcerptModule,
  isPublicRoomLog,
} from "../services/squarePostModules";
import { fetchAcceptedFriendships } from "../services/friendsRepository";
import { buildSessionReport } from "../utils/storyReport";
import { nowIso, parseTags, useRoomToolsState } from "../hooks/useRoomToolsState";

interface RoomToolsProps {
  roomId: string;
  roomTitle?: string | null;
  isKP: boolean;
  userId?: string;
  logs: Log[];
  onDeleteRoom: () => void;
  onClearChat: () => void;
  onConcludeGame: () => void;
}

const tabs = [
  { id: "report", label: "战报", icon: FileText },
  { id: "clues", label: "线索墙", icon: ClipboardList },
  { id: "invite", label: "邀请排期", icon: CalendarClock },
  { id: "share", label: "广场分享", icon: Share2 },
  { id: "management", label: "跑团管理", icon: Settings },
] as const;

export const RoomTools: React.FC<RoomToolsProps> = ({
  roomId,
  roomTitle,
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

  const report = useMemo(() => buildSessionReport(logs), [logs]);
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
  const [squareChannels, setSquareChannels] = React.useState<Channel[]>([]);
  const [shareChannelId, setShareChannelId] = React.useState("");
  const [shareContent, setShareContent] = React.useState("");
  const [shareTitle, setShareTitle] = React.useState("");
  const [selectedLogIds, setSelectedLogIds] = React.useState<string[]>([]);
  const [shareBusy, setShareBusy] = React.useState(false);

  const publicShareLogs = React.useMemo(
    () =>
      logs
        .filter(isPublicRoomLog)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [logs]
  );

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

  React.useEffect(() => {
    fetchChannels().then(({ data }) => {
      const channels = (data || []) as Channel[];
      setSquareChannels(channels);
      const preferred =
        channels.find((channel) => channel.name.includes("战报")) ||
        channels.find((channel) => channel.name.includes("鎴樻姤")) ||
        channels[0];
      if (preferred) setShareChannelId((previous) => previous || preferred.id);
    });
  }, []);

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

  const toggleSelectedLog = (logId: string) => {
    setSelectedLogIds((previous) =>
      previous.includes(logId)
        ? previous.filter((id) => id !== logId)
        : [...previous, logId]
    );
  };

  const handleShareExcerpt = async () => {
    if (!userId || !shareChannelId) return;
    const selectedLogs = publicShareLogs.filter((log) =>
      selectedLogIds.includes(log.id)
    );
    const module = createRoomLogExcerptModule({
      roomId,
      roomTitle,
      logs: selectedLogs,
      title: shareTitle,
    });
    if (!module) {
      alert("请选择至少一条公开日志");
      return;
    }

    setShareBusy(true);
    const postResult = await createPost({
      channel_id: shareChannelId,
      user_id: userId,
      content: shareContent.trim() || `分享跑团片段：${roomTitle || "未命名房间"}`,
    });

    if (postResult.error || !postResult.data?.id) {
      setShareBusy(false);
      alert("发布失败: " + (postResult.error?.message || "未返回帖子 ID"));
      return;
    }

    const moduleResult = await createPostModules(postResult.data.id, [module]);
    setShareBusy(false);

    if (moduleResult.error) {
      alert("发布模块失败: " + moduleResult.error.message);
      return;
    }

    setShareContent("");
    setShareTitle("");
    setSelectedLogIds([]);
    alert("已分享到广场");
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

        {activeTab === "report" && (
          <section className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <FileText size={18} className="text-dicecho-primary" />
                  鍏紑鎴樻姤
                </h2>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300 leading-6 max-h-[55vh] overflow-y-auto custom-scrollbar">
                  {report.publicMarkdown}
                </pre>
              </div>
              {isKP && (
                <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <Shield size={18} className="text-amber-300" />
                    Keeper 绉佸瘑娈佃惤
                  </h2>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300 leading-6 max-h-[55vh] overflow-y-auto custom-scrollbar">
                    {report.keeperOnlyMarkdown}
                  </pre>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "clues" && (
          <section className="grid lg:grid-cols-[360px_1fr] gap-4">
            {isKP && (
              <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <ClipboardList size={18} className="text-dicecho-primary" />
                  鏂扮嚎绱?                </h2>
                <Input label="鏍囬" value={clueTitle} onChange={(e) => setClueTitle(e.target.value)} />
                <Textarea label="鍐呭" rows={4} value={clueBody} onChange={(e) => setClueBody(e.target.value)} />
                <Input label="鏍囩" value={clueTags} onChange={(e) => setClueTags(e.target.value)} placeholder="person item mansion" />
                <Textarea label="Keeper note" rows={3} value={keeperNote} onChange={(e) => setKeeperNote(e.target.value)} />
                <Button icon={Sparkles} onClick={handleCreateClue} disabled={!clueTitle.trim()}>
                  鍒涘缓闅愯棌绾跨储
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {visibleClues.length === 0 && (
                <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/55 p-6 text-dicecho-muted">
                  鏆傛棤绾跨储
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
                      {clue.visibility}
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
                        {clue.visibility === "hidden" ? "鎻ず" : "闅愯棌"}
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
                        鍏宠仈鏈€鏂版棩蹇?                      </Button>
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
                        鍒犻櫎
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

        {activeTab === "share" && (
          <RoomSquareSharePanel
            channels={squareChannels}
            shareChannelId={shareChannelId}
            setShareChannelId={setShareChannelId}
            shareContent={shareContent}
            setShareContent={setShareContent}
            shareTitle={shareTitle}
            setShareTitle={setShareTitle}
            publicLogs={publicShareLogs}
            selectedLogIds={selectedLogIds}
            toggleSelectedLog={toggleSelectedLog}
            shareBusy={shareBusy}
            onShareExcerpt={handleShareExcerpt}
          />
        )}

        {activeTab === "management" && isKP && (
          <section className="space-y-4">
            <div className="rounded-lg border border-dicecho-accent/30 bg-dicecho-accent/12 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">瀹岀粨璺戝洟</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  褰撹窇鍥㈢粨鏉熸椂浣跨敤姝ゅ姛鑳姐€傜郴缁熷皢鐢熸垚璺戝洟灞ュ巻锛岃褰曟墍鏈夌帺瀹剁殑鏈€缁堢姸鎬侊紝骞跺皢鎴块棿鏍囪涓衡€滃凡瀹屾垚鈥濄€?                </p>
              </div>
              <Button
                onClick={onConcludeGame}
                variant="ghost"
                size="lg"
                icon={Check}
                className="border border-dicecho-accent/70 bg-dicecho-accent/15 text-[#bff1d5] hover:bg-dicecho-accent/25 hover:text-white hover:border-dicecho-accent"
              >
                缁撳洟缁撶畻
              </Button>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">
                  娓呯┖鑱婂ぉ璁板綍
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  鍒犻櫎褰撳墠鎴块棿鐨勬墍鏈夎亰澶╄褰曪紙鍖呮嫭楠板瓙鍜屽浘鐗囷級銆傛鎿嶄綔涓嶅彲鎭㈠銆?                </p>
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
                        纭娓呯┖
                      </Button>
                      <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider animate-pulse">
                        姝ゆ搷浣滀笉鍙挙閿€
                      </span>
                    </div>
                    <Button
                      onClick={() => setClearChatConfirm(false)}
                      variant="ghost"
                    >
                      鍙栨秷
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setClearChatConfirm(true)}
                    variant="danger"
                    icon={AlertTriangle}
                    size="lg"
                  >
                    娓呯┖璁板綍
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-900/10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">鍒犻櫎鎴块棿</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  杩欏皢姘镐箙鍒犻櫎璇ユ埧闂村強鍏舵墍鏈夋暟鎹€傛鎿嶄綔涓嶅彲鎭㈠銆?                </p>
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
                        纭鍒犻櫎
                      </Button>
                      <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider animate-pulse">
                        姝ゆ搷浣滀笉鍙挙閿€
                      </span>
                    </div>
                    <Button
                      onClick={() => setDeleteConfirm(false)}
                      variant="ghost"
                    >
                      鍙栨秷
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setDeleteConfirm(true)}
                    variant="danger"
                    icon={AlertTriangle}
                    size="lg"
                  >
                    鍒犻櫎鎴块棿
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

const RoomSquareSharePanel: React.FC<{
  channels: Channel[];
  shareChannelId: string;
  setShareChannelId: (value: string) => void;
  shareContent: string;
  setShareContent: (value: string) => void;
  shareTitle: string;
  setShareTitle: (value: string) => void;
  publicLogs: Log[];
  selectedLogIds: string[];
  toggleSelectedLog: (logId: string) => void;
  shareBusy: boolean;
  onShareExcerpt: () => Promise<void>;
}> = ({
  channels,
  shareChannelId,
  setShareChannelId,
  shareContent,
  setShareContent,
  shareTitle,
  setShareTitle,
  publicLogs,
  selectedLogIds,
  toggleSelectedLog,
  shareBusy,
  onShareExcerpt,
}) => (
  <section className="grid lg:grid-cols-[360px_1fr] gap-4">
    <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
      <h2 className="text-white font-bold flex items-center gap-2">
        <Share2 size={18} className="text-dicecho-primary" />
        分享跑团片段
      </h2>
      <label className="text-xs text-dicecho-muted mb-1.5 font-medium ml-1">
        目标频道
      </label>
      <select
        value={shareChannelId}
        onChange={(event) => setShareChannelId(event.target.value)}
        className="w-full bg-dicecho-panel/70 border border-dicecho-border/50 text-slate-100 rounded-lg px-4 py-2.5 focus:outline-none focus:border-dicecho-primary/70 transition-colors text-sm"
      >
        <option value="">选择频道</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>
      <Input
        label="片段标题"
        value={shareTitle}
        onChange={(event) => setShareTitle(event.target.value)}
        placeholder="例如：古宅门口的一次侦查"
      />
      <Textarea
        label="帖子正文"
        rows={4}
        value={shareContent}
        onChange={(event) => setShareContent(event.target.value)}
        placeholder="补充这段跑团发生了什么..."
      />
      <Button
        icon={Send}
        onClick={() => void onShareExcerpt()}
        disabled={!shareChannelId || selectedLogIds.length === 0 || shareBusy}
      >
        {shareBusy ? "发布中..." : "分享到广场"}
      </Button>
      <p className="text-xs text-dicecho-muted leading-5">
        只会发布公开聊天、公开骰点、公开系统日志和公开图片；私聊与暗骰不会进入片段。
      </p>
    </div>

    <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-white font-bold">选择公开日志</h2>
        <span className="text-xs text-dicecho-muted">
          已选 {selectedLogIds.length}
        </span>
      </div>
      {publicLogs.length === 0 ? (
        <p className="text-sm text-dicecho-muted">暂无可分享的公开日志。</p>
      ) : (
        <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {publicLogs.map((log) => {
            const checked = selectedLogIds.includes(log.id);
            return (
              <label
                key={log.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  checked
                    ? "border-dicecho-primary/50 bg-dicecho-primary/10"
                    : "border-dicecho-border/35 bg-dicecho-panel/45 hover:border-dicecho-primary/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelectedLog(log.id)}
                  className="mt-1 accent-dicecho-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-dicecho-muted">
                    <span>{log.timestamp}</span>
                    <span className="font-semibold text-slate-300">
                      {log.charName}
                    </span>
                    <span>{log.charRole}</span>
                    <span>{log.type}</span>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-slate-200">
                    {log.type === "image" ? "展示图片" : log.content}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  </section>
);
