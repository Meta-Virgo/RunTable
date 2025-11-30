import React from 'react';
import { Edit2, UserPlus, Users, Swords, User, UserCog, Heart, Zap, Brain } from 'lucide-react';
import { Button, StatBadge, cn } from './UI';
import { ModuleInfo, Character } from '../types';

interface DashboardProps {
  moduleInfo: ModuleInfo;
  characters: Character[];
  onEditModule: () => void;
  onAddChar: (role: string) => void;
  onEditChar: (char: Character) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ moduleInfo, characters, onEditModule, onAddChar, onEditChar }) => {
  const pcCharacters = characters.filter(c => c.role === '调查员');
  const npcCharacters = characters.filter(c => ['NPC', '怪物'].includes(c.role));

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar animate-fade-in">
        <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-12">
           {/* Module Info */}
           <section>
                <div onClick={onEditModule} className="group glass-panel bg-slate-800/40 rounded-2xl p-6 md:p-8 cursor-pointer relative overflow-hidden transition-all hover:bg-slate-800/60">
                   <div className="absolute top-0 right-0 p-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity text-slate-400"><Edit2 size={20} /></div>
                   <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 group-hover:text-indigo-300 transition-colors">{moduleInfo.title || "未命名模组"}</h2>
                   <p className="text-slate-400 leading-relaxed max-w-3xl text-sm md:text-base line-clamp-3 md:line-clamp-none">{moduleInfo.description || "点击编辑模组信息..."}</p>
               </div>
           </section>

           {/* Investigators */}
           <section>
               <div className="flex justify-between items-end mb-4 md:mb-6 border-b border-white/5 pb-4">
                 <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3"><Users className="text-purple-400"/> <span>调查员档案</span><span className="text-sm font-normal text-slate-500 self-end mb-1 ml-2">{pcCharacters.length} 人</span></h2>
                 <Button onClick={() => onAddChar('调查员')} icon={UserPlus} size="sm" variant="secondary">录入</Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                 {pcCharacters.map(inv => (
                   <div key={inv.id} onClick={() => onEditChar(inv)} className="glass-panel bg-slate-800/30 hover:bg-slate-800/50 p-5 md:p-6 rounded-2xl relative overflow-hidden group cursor-pointer transition-all">
                     <div className="flex items-start gap-4 mb-4 md:mb-6">
                       <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20"><User size={24} className="md:w-8 md:h-8" /></div>
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-white text-lg truncate group-hover:text-purple-400 transition-colors">{inv.name}</div>
                         <div className="text-xs text-slate-400 mt-1">{inv.job || "无业"} · {inv.ageSex || "未知"}</div>
                       </div>
                     </div>
                     <div className="space-y-3 mb-4 md:mb-6">
                       <StatBadge label="HP (耐久)" value={inv.hp} max={Math.floor((Number(inv.con)+Number(inv.siz))/10)} color="red" icon={Heart}/>
                       <StatBadge label="SAN (理智)" value={inv.san} max={99} color="emerald" icon={Brain}/>
                       <StatBadge label="MP (魔法)" value={inv.mp} max={20} color="blue" icon={Zap}/>
                     </div>
                     <div className="text-xs text-slate-500 line-clamp-2 bg-slate-950/30 p-3 rounded-xl border border-white/5 min-h-[3.5rem]">{inv.notes || "暂无备注..."}</div>
                   </div>
                 ))}
               </div>
           </section>

           {/* NPCs / Monsters */}
           <section>
               <div className="flex justify-between items-end mb-4 md:mb-6 border-b border-white/5 pb-4">
                 <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3"><Swords className="text-rose-400"/> <span>NPC & 怪物</span><span className="text-sm font-normal text-slate-500 self-end mb-1 ml-2">{npcCharacters.length} 个</span></h2>
                 <Button onClick={() => onAddChar('NPC')} icon={UserPlus} size="sm" variant="secondary">录入</Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                 {npcCharacters.map(npc => { 
                   const isMonster = npc.role === '怪物'; 
                   return (
                     <div key={npc.id} onClick={() => onEditChar(npc)} className={cn("glass-panel bg-slate-800/30 hover:bg-slate-800/50 p-5 md:p-6 rounded-2xl relative overflow-hidden group cursor-pointer border-t-2 transition-all", isMonster ? "border-t-rose-500/50" : "border-t-cyan-500/50")}>
                       <div className="flex items-start gap-4 mb-4 md:mb-6">
                         <div className={cn("p-3 rounded-xl border", isMonster ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20")}>
                           {isMonster ? <Swords size={24} className="md:w-8 md:h-8"/> : <UserCog size={24} className="md:w-8 md:h-8"/>}
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="font-bold text-white text-lg truncate flex items-center gap-2">
                             {npc.name}
                             <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", isMonster ? "border-rose-800 text-rose-400 bg-rose-950" : "border-cyan-800 text-cyan-400 bg-cyan-950")}>{npc.role}</span>
                           </div>
                           <div className="text-xs text-slate-400 mt-1">{npc.job || "未知实体"}</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 mb-4">
                         <StatBadge label="HP" value={npc.hp} max={50} color="red" icon={Heart}/>
                         <StatBadge label="MP" value={npc.mp} max={20} color="blue" icon={Zap}/>
                       </div>
                       <div className="grid grid-cols-2 gap-4 mb-4">
                         <div className="bg-slate-950/40 rounded px-2 py-1 flex justify-between items-center border border-white/5"><span className="text-[10px] text-slate-500 font-bold">STR</span><span className="text-sm font-mono text-slate-300">{npc.str}</span></div>
                         <div className="bg-slate-950/40 rounded px-2 py-1 flex justify-between items-center border border-white/5"><span className="text-[10px] text-slate-500 font-bold">DEX</span><span className="text-sm font-mono text-slate-300">{npc.dex}</span></div>
                       </div>
                       <div className="text-xs text-slate-500 line-clamp-2 bg-slate-950/30 p-3 rounded-xl border border-white/5 min-h-[3.5rem]">{npc.notes || "..."}</div>
                     </div>
                   ); 
                 })}
               </div>
           </section>
        </div>
    </div>
  );
};
