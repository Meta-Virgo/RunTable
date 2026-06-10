import React, { useMemo } from "react";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Link,
  Lock,
  MessageSquare,
  ScrollText,
  Send,
  Shield,
  Sparkles,
  Tags,
  UserCog,
} from "lucide-react";
import type { Character, Log } from "../types";
import { Button, Input, Textarea, cn } from "./UI";
import {
  createClue,
  deleteClue,
  linkClueToEvidence,
  listVisibleClues,
  updateClue,
} from "../services/clueWall";
import {
  createRoomInvite,
  createRoomSchedule,
  getVisibleInviteSummary,
} from "../services/invitations";
import {
  createKeeperPersonaTemplate,
  createPersonaMessage,
  createSecretBatchRolls,
  type KeeperPersonaTemplate,
} from "../services/keeperToolbox";
import {
  createSessionSnapshots,
  listVisibleSnapshots,
} from "../services/sessionSnapshots";
import { buildSessionReport } from "../utils/storyReport";
import type { RoomMemberPanelItem } from "../services/roomMembers";
import { nowIso, parseTags, useRoomToolsState } from "../hooks/useRoomToolsState";

type AddLog = (
  type: Log["type"],
  content: string,
  customCharId?: string,
  recipientId?: string | null,
  meta?: Record<string, any>
) => Promise<void>;

interface RoomToolsProps {
  roomId: string;
  isKP: boolean;
  userId?: string;
  logs: Log[];
  characters: Character[];
  roomMemberItems: RoomMemberPanelItem[];
  addLog: AddLog;
}

const tabs = [
  { id: "report", label: "战报", icon: FileText },
  { id: "clues", label: "线索墙", icon: ClipboardList },
  { id: "invite", label: "邀请排期", icon: CalendarClock },
  { id: "snapshots", label: "角色快照", icon: ScrollText },
  { id: "toolbox", label: "KP工具", icon: UserCog },
] as const;

export const RoomTools: React.FC<RoomToolsProps> = ({
  roomId,
  isKP,
  userId,
  logs,
  characters,
  roomMemberItems,
  addLog,
}) => {
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
    invite,
    setInvite,
    schedule,
    setSchedule,
    startsAt,
    setStartsAt,
    scheduleNote,
    setScheduleNote,
    snapshots,
    setSnapshots,
    personaName,
    setPersonaName,
    personaKind,
    setPersonaKind,
    personaDescription,
    setPersonaDescription,
    personaLine,
    setPersonaLine,
    personas,
    setPersonas,
    batchReason,
    setBatchReason,
    batchTargets,
    setBatchTargets,
  } = useRoomToolsState(roomId);

  const report = useMemo(() => buildSessionReport(logs), [logs]);
  const viewerRole = isKP ? "keeper" : "player";
  const visibleClues = listVisibleClues(clues, {
    role: viewerRole,
    status: "active",
  });
  const visibleSnapshots = listVisibleSnapshots(snapshots, {
    role: viewerRole,
    userId: userId || "",
  });
  const inviteSummary =
    invite && userId ? getVisibleInviteSummary(invite, schedule, userId) : null;
  const latestPublicLog = [...logs]
    .reverse()
    .find((log: Log) => !log.recipientId && log.type !== "dice_secret");

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

  const handleCreateInvite = () => {
    const inviteModel = createRoomInvite({
      id: `invite-${Date.now()}`,
      roomId,
      createdByUserId: userId || "unknown",
      visibility: "link",
      now: nowIso(),
    });
    setInvite(inviteModel);
    setSchedule(
      createRoomSchedule({
        roomId,
        startsAt: new Date(startsAt).toISOString(),
        note: scheduleNote.trim() || null,
      })
    );
  };

  const handleCaptureSnapshots = () => {
    const activeUserIds = new Set(
      roomMemberItems.map((member) => member.userId)
    );
    characters.forEach((character) => {
      if (character.user_id) activeUserIds.add(character.user_id);
    });
    setSnapshots(
      createSessionSnapshots({
        roomId,
        sessionId: `session-${Date.now()}`,
        endedAt: nowIso(),
        characters: characters.filter((character) => character.type === "investigator"),
        activeMemberUserIds: activeUserIds,
      })
    );
  };

  const handleCreatePersona = () => {
    if (!personaName.trim()) return;
    setPersonas((prev) => [
      createKeeperPersonaTemplate({
        id: `persona-${Date.now()}`,
        roomId,
        kind: personaKind,
        name: personaName.trim(),
        description: personaDescription.trim(),
      }),
      ...prev,
    ]);
    setPersonaName("");
    setPersonaDescription("");
  };

  const handlePersonaSpeak = async (template: KeeperPersonaTemplate) => {
    if (!personaLine.trim()) return;
    const message = createPersonaMessage(template, personaLine.trim());
    await addLog(
      "normal",
      `[${message.charRole}: ${message.charName}] ${message.content}`,
      "pc"
    );
    setPersonaLine("");
  };

  const handleBatchSecretRoll = async () => {
    const targets = batchTargets
      .split(/\r?\n|,/)
      .map((target) => target.trim())
      .filter(Boolean);
    if (!batchReason.trim() || targets.length === 0) return;
    const rolls = targets.map(() => Math.floor(Math.random() * 100) + 1);
    const result = createSecretBatchRolls({
      reason: batchReason.trim(),
      targets,
      rolls,
    });
    await addLog("system", result.publicSummary, "pc");
    await addLog(
      "dice_secret",
      JSON.stringify({
        count: targets.length,
        type: 100,
        total: rolls.reduce((sum, roll) => sum + roll, 0),
        details: rolls,
        checkName: batchReason.trim(),
        batch: result.keeperResults,
      }),
      "pc"
    );
    setBatchReason("");
    setBatchTargets("");
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap gap-2">
          {tabs
            .filter((tab) => tab.id !== "toolbox" || isKP)
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
                  公开战报
                </h2>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300 leading-6 max-h-[55vh] overflow-y-auto custom-scrollbar">
                  {report.publicMarkdown}
                </pre>
              </div>
              {isKP && (
                <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <Shield size={18} className="text-amber-300" />
                    Keeper 私密段落
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
                  新线索
                </h2>
                <Input label="标题" value={clueTitle} onChange={(e) => setClueTitle(e.target.value)} />
                <Textarea label="内容" rows={4} value={clueBody} onChange={(e) => setClueBody(e.target.value)} />
                <Input label="标签" value={clueTags} onChange={(e) => setClueTags(e.target.value)} placeholder="person item mansion" />
                <Textarea label="Keeper note" rows={3} value={keeperNote} onChange={(e) => setKeeperNote(e.target.value)} />
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
          <section className="grid lg:grid-cols-[360px_1fr] gap-4">
            {isKP && (
              <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
                <h2 className="text-white font-bold flex items-center gap-2">
                  <CalendarClock size={18} className="text-dicecho-primary" />
                  开团时间
                </h2>
                <Input
                  label="开始时间"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
                <Textarea
                  label="备注"
                  rows={4}
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                />
                <Button icon={Send} onClick={handleCreateInvite}>
                  保存邀请
                </Button>
              </div>
            )}
            <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
              <h2 className="text-white font-bold">当前邀请</h2>
              <p className="mt-3 text-sm text-slate-300">
                {inviteSummary || "暂无可见邀请"}
              </p>
              {invite && (
                <div className="mt-4 text-xs text-dicecho-muted space-y-1">
                  <div>Invite ID: {invite.id}</div>
                  <div>Visibility: {invite.visibility}</div>
                  {schedule && <div>Starts at: {schedule.startsAt}</div>}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "snapshots" && (
          <section className="space-y-4">
            {isKP && (
              <Button icon={ScrollText} onClick={handleCaptureSnapshots}>
                捕获当前角色快照
              </Button>
            )}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleSnapshots.length === 0 && (
                <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/55 p-6 text-dicecho-muted">
                  暂无快照
                </div>
              )}
              {visibleSnapshots.map((snapshot) => (
                <article
                  key={snapshot.id}
                  className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm"
                >
                  <h3 className="font-bold text-white">{snapshot.snapshot.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {snapshot.capturedAt}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div className="rounded-lg bg-red-500/10 p-2 text-red-200">
                      HP {snapshot.snapshot.hp}
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-200">
                      SAN {snapshot.snapshot.san}
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-200">
                      MP {snapshot.snapshot.mp}
                    </div>
                  </div>
                  {snapshot.snapshot.notes && (
                    <p className="mt-3 text-sm text-slate-300">
                      {snapshot.snapshot.notes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "toolbox" && isKP && (
          <section className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
              <h2 className="text-white font-bold flex items-center gap-2">
                <UserCog size={18} className="text-dicecho-primary" />
                NPC / Monster 身份
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={personaKind === "npc" ? "active" : "secondary"}
                  onClick={() => setPersonaKind("npc")}
                >
                  NPC
                </Button>
                <Button
                  size="sm"
                  variant={personaKind === "monster" ? "active" : "secondary"}
                  onClick={() => setPersonaKind("monster")}
                >
                  Monster
                </Button>
              </div>
              <Input label="名称" value={personaName} onChange={(e) => setPersonaName(e.target.value)} />
              <Textarea label="描述" rows={3} value={personaDescription} onChange={(e) => setPersonaDescription(e.target.value)} />
              <Button onClick={handleCreatePersona} disabled={!personaName.trim()}>
                保存身份
              </Button>
              <Textarea label="发言" rows={3} value={personaLine} onChange={(e) => setPersonaLine(e.target.value)} />
              <div className="space-y-2">
                {personas.map((persona) => (
                  <div key={persona.id} className="flex items-center justify-between gap-3 rounded-lg border border-dicecho-border/35 bg-dicecho-panel/55 p-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {persona.name}
                      </div>
                      <div className="text-xs text-dicecho-muted truncate">
                        {persona.kind} {persona.description}
                      </div>
                    </div>
                    <Button size="xs" icon={MessageSquare} onClick={() => handlePersonaSpeak(persona)}>
                      发言
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm space-y-3">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Shield size={18} className="text-amber-300" />
                批量暗骰
              </h2>
              <Input label="原因" value={batchReason} onChange={(e) => setBatchReason(e.target.value)} />
              <Textarea
                label="目标"
                rows={6}
                value={batchTargets}
                onChange={(e) => setBatchTargets(e.target.value)}
                placeholder="Alice&#10;Bob"
              />
              <Button icon={Shield} onClick={handleBatchSecretRoll}>
                执行暗骰
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
