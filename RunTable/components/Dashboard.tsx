import React, { useState } from "react";
import {
  Edit2,
  UserPlus,
  Users,
  Swords,
  User,
  UserCog,
  Heart,
  Zap,
  Brain,
  AlertTriangle,
  Check,
  Copy,
} from "lucide-react";
import { Button, StatBadge, cn } from "./UI";
import { ModuleInfo, Character } from "../types";
import { useElasticScroll } from "../hooks/useElasticScroll";

interface DashboardProps {
  moduleInfo: ModuleInfo;
  characters: Character[];
  onEditModule: () => void;
  onAddChar: (role: string) => void;
  onEditChar: (char: Character) => void;
  onDuplicateChar: (char: Character) => void;
  onDeleteRoom: () => void;
  onClearChat: () => void;
  onConcludeGame: () => void;
  isKP: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  moduleInfo,
  characters,
  onEditModule,
  onAddChar,
  onEditChar,
  onDuplicateChar,
  onDeleteRoom,
  onClearChat,
  onConcludeGame,
  isKP,
}) => {
  const [resetConfirm, setResetConfirm] = useState(false);
  const [clearChatConfirm, setClearChatConfirm] = useState(false);
  const pcCharacters = characters.filter((c) => c.role === "调查员");
  const npcCharacters = characters.filter((c) =>
    ["NPC", "怪物"].includes(c.role)
  );

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(scrollRef, contentRef);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar animate-fade-in overscroll-y-none"
    >
      <div ref={contentRef} className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Module Info - KP Only */}
        {isKP && (
          <section>
            <div
              onClick={onEditModule}
              className="group glass-panel bg-slate-800/40 rounded-2xl p-6 md:p-8 relative overflow-hidden transition-all cursor-pointer hover:bg-slate-800/60"
            >
              <div className="absolute top-0 right-0 p-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                <Edit2 size={20} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 group-hover:text-indigo-300 transition-colors">
                {moduleInfo.title || "未命名模组"}
              </h2>
              <p className="text-slate-400 leading-relaxed max-w-3xl text-sm md:text-base line-clamp-3 md:line-clamp-none">
                {moduleInfo.description || "点击编辑模组信息..."}
              </p>
            </div>
          </section>
        )}

        {/* Investigators */}
        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-purple-400" /> <span>调查员档案</span>
              <span className="text-sm font-normal text-slate-500 self-end mb-1 ml-2">
                {pcCharacters.length} 人
              </span>
            </h2>
          </div>
          {pcCharacters.length === 0 ? (
            <div className="p-8 md:p-12 rounded-2xl flex flex-col items-center justify-center text-slate-500 border border-white/5 border-dashed">
              <User size={48} className="mb-4 opacity-20" />
              <p>暂无调查员</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {pcCharacters.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onEditChar(inv)}
                  className="glass-panel bg-slate-800/30 hover:bg-slate-800/50 p-5 md:p-6 rounded-2xl relative overflow-hidden group cursor-pointer transition-all"
                >
                  <div className="flex items-start gap-4 mb-4 md:mb-6">
                    <div
                      className={cn(
                        "rounded-xl shrink-0 flex items-center justify-center",
                        inv.avatar_url
                          ? "w-12 h-12 md:w-14 md:h-14 border border-white/10 overflow-hidden bg-slate-900"
                          : "p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      )}
                    >
                      {inv.avatar_url ? (
                        <img
                          src={inv.avatar_url}
                          alt={inv.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={24} className="md:w-8 md:h-8" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-lg truncate group-hover:text-purple-400 transition-colors">
                        {inv.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {inv.job || "无业"} ·{" "}
                        {inv.age || inv.sex ? `${inv.age} ${inv.sex}` : "未知"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4 md:mb-6">
                    <StatBadge
                      label="HP (耐久)"
                      value={inv.hp}
                      max={Math.floor((Number(inv.con) + Number(inv.siz)) / 10)}
                      color="red"
                      icon={Heart}
                    />
                    <StatBadge
                      label="SAN (理智)"
                      value={inv.san}
                      max={99}
                      color="emerald"
                      icon={Brain}
                    />
                    <StatBadge
                      label="MP (魔法)"
                      value={inv.mp}
                      max={20}
                      color="blue"
                      icon={Zap}
                    />
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-3 bg-slate-950/30 p-3 rounded-xl border border-white/5 min-h-[3.5rem] leading-relaxed whitespace-pre-wrap">
                    {inv.backstory || "暂无背景故事..."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* NPCs / Monsters - KP Only */}
        {isKP && (
          <section>
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                <Swords className="text-rose-400" /> <span>NPC & 怪物</span>
                <span className="text-sm font-normal text-slate-500 self-end mb-1 ml-2">
                  {npcCharacters.length} 个
                </span>
              </h2>
              <Button
                onClick={() => onAddChar("NPC")}
                icon={UserPlus}
                size="sm"
                variant="secondary"
              >
                录入
              </Button>
            </div>
            {npcCharacters.length === 0 ? (
              <div className="p-8 md:p-12 rounded-2xl flex flex-col items-center justify-center text-slate-500 border border-white/5 border-dashed">
                <Swords size={48} className="mb-4 opacity-20" />
                <p>暂无 NPC 或怪物</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {npcCharacters.map((npc) => {
                  const isMonster = npc.role === "怪物";
                  return (
                    <div
                      key={npc.id}
                      onClick={() => onEditChar(npc)}
                      className="glass-panel bg-slate-800/30 p-5 md:p-6 rounded-2xl relative overflow-hidden group transition-all cursor-pointer hover:bg-slate-800/50"
                    >
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateChar(npc);
                          }}
                          className="p-1.5 bg-slate-900/80 text-slate-400 hover:text-white rounded-lg hover:bg-indigo-600 transition-colors border border-white/10"
                          title="复制角色"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="flex items-start gap-4 mb-4 md:mb-6">
                        <div
                          className={cn(
                            "p-3 rounded-xl border",
                            isMonster
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                          )}
                        >
                          {isMonster ? (
                            <Swords size={24} className="md:w-8 md:h-8" />
                          ) : (
                            <UserCog size={24} className="md:w-8 md:h-8" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-lg truncate flex items-center gap-2">
                            {npc.name}
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded border",
                                isMonster
                                  ? "border-rose-800 text-rose-400 bg-rose-950"
                                  : "border-cyan-800 text-cyan-400 bg-cyan-950"
                              )}
                            >
                              {npc.role}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {npc.job || "未知实体"}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <StatBadge
                          label="HP"
                          value={npc.hp}
                          max={50}
                          color="red"
                          icon={Heart}
                        />
                        <StatBadge
                          label="MP"
                          value={npc.mp}
                          max={20}
                          color="blue"
                          icon={Zap}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-950/40 rounded px-2 py-1 flex justify-between items-center border border-white/5">
                          <span className="text-[10px] text-slate-500 font-bold">
                            STR
                          </span>
                          <span className="text-sm font-mono text-slate-300">
                            {npc.str}
                          </span>
                        </div>
                        <div className="bg-slate-950/40 rounded px-2 py-1 flex justify-between items-center border border-white/5">
                          <span className="text-[10px] text-slate-500 font-bold">
                            DEX
                          </span>
                          <span className="text-sm font-mono text-slate-300">
                            {npc.dex}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-3 bg-slate-950/30 p-3 rounded-xl border border-white/5 min-h-[3.5rem] leading-relaxed whitespace-pre-wrap">
                        {npc.backstory || "..."}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Game Management - KP Only */}
        {isKP && (
          <section className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                <Zap className="text-amber-400" /> 跑团管理
              </h2>
            </div>

            <div className="glass-panel bg-amber-500/10 border-amber-500/20 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">完结跑团</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  当跑团结束时使用此功能。系统将生成跑团履历，记录所有玩家的最终状态，并将房间标记为“已完成”。
                </p>
              </div>
              <Button
                onClick={onConcludeGame}
                variant="primarySoft"
                size="lg"
                icon={Check}
              >
                结团结算
              </Button>
            </div>

            <div className="glass-panel bg-red-900/10 border-red-500/20 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
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

            <div className="glass-panel bg-red-900/10 border-red-500/20 p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">删除房间</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  这将永久删除该房间及其所有数据。此操作不可恢复。
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {resetConfirm ? (
                  <>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        onClick={() => {
                          onDeleteRoom();
                          setResetConfirm(false);
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
                      onClick={() => setResetConfirm(false)}
                      variant="ghost"
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setResetConfirm(true)}
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
