import React from "react";
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
  isKP: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  moduleInfo,
  characters,
  onEditModule,
  onAddChar,
  onEditChar,
  onDuplicateChar,
  isKP,
}) => {
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
              className="group rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-6 md:p-8 relative overflow-hidden transition-colors cursor-pointer hover:bg-dicecho-raised/70 shadow-sm"
            >
              <div className="absolute top-0 right-0 p-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                <Edit2 size={20} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 group-hover:text-dicecho-primary transition-colors">
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
              <Users className="text-dicecho-primary" /> <span>调查员档案</span>
              <span className="text-sm font-normal text-slate-500 self-end mb-1 ml-2">
                {pcCharacters.length} 人
              </span>
            </h2>
          </div>
          {pcCharacters.length === 0 ? (
            <div className="p-8 md:p-12 rounded-lg flex flex-col items-center justify-center text-dicecho-muted border border-dicecho-border/45 border-dashed bg-dicecho-card/35">
              <User size={48} className="mb-4 opacity-20" />
              <p>暂无调查员</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {pcCharacters.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onEditChar(inv)}
                  className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 hover:bg-dicecho-raised/70 p-5 md:p-6 relative overflow-hidden group cursor-pointer transition-colors shadow-sm"
                >
                  <div className="flex items-start gap-4 mb-4 md:mb-6">
                    <div
                      className={cn(
                        "rounded-xl shrink-0 flex items-center justify-center",
                        inv.avatar_url
                          ? "w-12 h-12 md:w-14 md:h-14 border border-dicecho-border/45 overflow-hidden bg-dicecho-panel"
                          : "p-3 bg-dicecho-primary/15 text-dicecho-primary border border-dicecho-primary/25"
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
                      <div className="font-bold text-white text-lg truncate group-hover:text-dicecho-primary transition-colors">
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
                  <div className="text-xs text-dicecho-muted line-clamp-3 bg-dicecho-panel/55 p-3 rounded-lg border border-dicecho-border/35 min-h-[3.5rem] leading-relaxed whitespace-pre-wrap">
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
              <div className="p-8 md:p-12 rounded-lg flex flex-col items-center justify-center text-dicecho-muted border border-dicecho-border/45 border-dashed bg-dicecho-card/35">
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
                      className="rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-5 md:p-6 relative overflow-hidden group transition-colors cursor-pointer hover:bg-dicecho-raised/70 shadow-sm"
                    >
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateChar(npc);
                          }}
                          className="p-1.5 bg-dicecho-panel/80 text-dicecho-muted hover:text-white rounded-lg hover:bg-dicecho-primary-strong transition-colors border border-dicecho-border/40"
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
                        <div className="bg-dicecho-panel/55 rounded px-2 py-1 flex justify-between items-center border border-dicecho-border/35">
                          <span className="text-[10px] text-dicecho-muted font-bold">
                            STR
                          </span>
                          <span className="text-sm font-mono text-slate-300">
                            {npc.str}
                          </span>
                        </div>
                        <div className="bg-dicecho-panel/55 rounded px-2 py-1 flex justify-between items-center border border-dicecho-border/35">
                          <span className="text-[10px] text-dicecho-muted font-bold">
                            DEX
                          </span>
                          <span className="text-sm font-mono text-slate-300">
                            {npc.dex}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-dicecho-muted line-clamp-3 bg-dicecho-panel/55 p-3 rounded-lg border border-dicecho-border/35 min-h-[3.5rem] leading-relaxed whitespace-pre-wrap">
                        {npc.backstory || "..."}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
