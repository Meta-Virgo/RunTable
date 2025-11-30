import React, { useRef, useEffect, useState } from 'react';
import { BookOpen, Activity, Info, Dice5, Trash2, Send, FileText, User, Swords, UserCog, Crown } from 'lucide-react';
import { cn, Button, NumberStepper } from './UI';
import { Log, Character } from '../types';

interface ChatAreaProps {
  logs: Log[];
  activeChar: { name: string; role: string };
  activeCharId: string;
  onSend: (text: string) => void;
  onDeleteLog: (id: number) => void;
  onRollDice: (count: number, type: number) => void;
  onShowStory: () => void;
}

const getCharIcon = (role: string, size = 18) => {
    if (role === 'Keeper') return <Crown size={size} />;
    if (role === '怪物') return <Swords size={size} />;
    if (role === 'NPC') return <UserCog size={size} />;
    return <User size={size} />;
};

export const ChatArea: React.FC<ChatAreaProps> = ({ logs, activeChar, activeCharId, onSend, onDeleteLog, onRollDice, onShowStory }) => {
  const [inputText, setInputText] = useState('');
  const [diceCount, setDiceCount] = useState(1);
  const [diceType, setDiceType] = useState(6);
  const [showDiceSelect, setShowDiceSelect] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSend(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Logs View */}
      <div className="flex-1 overflow-y-auto px-3 md:px-8 py-4 md:py-6 space-y-6 custom-scrollbar scroll-smooth">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-600 animate-slide-up">
            <div className="w-24 h-24 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-full flex items-center justify-center mb-6 ring-1 ring-slate-700/50 shadow-2xl">
              <BookOpen size={40} className="text-slate-500 opacity-50" />
            </div>
            <p className="text-lg font-medium text-slate-500">传奇故事，由此开始</p>
          </div>
        )}
        
        {logs.map((log) => {
            const isPC = log.charId === 'pc'; 
            const isSystem = log.type === 'system'; 
            const isDice = log.type === 'dice'; 
            const isStatus = log.type === 'status';

            if (isSystem || isStatus) { 
              return (
                <div key={log.id} className="flex justify-center py-2 animate-fade-in">
                  <div className={cn("text-xs px-4 py-1.5 rounded-full border flex items-center gap-2 shadow-sm backdrop-blur-sm", isStatus ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-slate-800/60 border-slate-700/50 text-slate-400")}>
                    {isStatus ? <Activity size={12} /> : <Info size={12} />}
                    <span className="font-mono">{log.content}</span>
                  </div>
                </div>
              ); 
            }

            if (isDice) {
                  let diceData = { count: '?', total: '?', details: [] as number[], type: 6 };
                  try { diceData = JSON.parse(log.content); } catch(e) { diceData.total = log.content as any; }
                  return (
                    <div key={log.id} className="flex flex-col items-center py-4 animate-slide-up">
                        <div className="relative overflow-hidden bg-slate-900 rounded-xl border-l-4 border-indigo-500 shadow-2xl p-4 min-w-[260px] max-w-sm w-full">
                            <Dice5 className="absolute -right-4 -bottom-4 text-indigo-500/10 w-32 h-32 transform rotate-12" />
                            <div className="flex justify-between items-center mb-2 relative z-10"><span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Dice Roll</span><span className="text-xs text-slate-500 font-mono">{log.timestamp}</span></div>
                            <div className="flex items-baseline gap-3 relative z-10"><span className="text-slate-400 text-sm font-medium">投掷了</span><span className="text-white text-lg font-bold">{diceData.count}D{diceData.type||6}</span><span className="text-slate-600">:</span><span className="text-4xl font-black text-indigo-400 font-mono">{diceData.total}</span></div>
                            {diceData.details && diceData.details.length > 0 && (<div className="mt-3 pt-2 border-t border-slate-800 relative z-10"><div className="flex flex-wrap gap-1 text-xs font-mono text-slate-500">{diceData.details.map((d, i) => (<span key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{d}</span>))}</div></div>)}
                        </div>
                    </div>
                );
            }

            const bubbleColor = log.charRole === 'Keeper' ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/10" : (log.charRole === '怪物' ? "bg-rose-900/80 text-rose-100 border-rose-800 shadow-rose-900/10" : (log.charRole === 'NPC' ? "bg-slate-800 text-slate-200 border-slate-700 shadow-slate-900/10" : "bg-slate-700/80 text-white border-slate-600")); 
            const alignRight = isPC; 
            const iconColor = log.charRole === '怪物' ? "text-rose-400" : (log.charRole === 'NPC' ? "text-cyan-400" : (log.charRole === 'Keeper' ? "text-indigo-400" : "text-purple-400"));
            
            return (
                <div key={log.id} className={cn("flex w-full gap-2 md:gap-3 group animate-slide-up", alignRight ? "flex-row-reverse" : "flex-row")}>
                    <div className="mt-1 shrink-0"><div className={cn("p-1.5 md:p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 shadow-lg", iconColor)}>{getCharIcon(log.charRole, 20)}</div></div>
                    <div className={cn("flex flex-col max-w-[80%] md:max-w-[75%]", alignRight ? "items-end" : "items-start")}>
                        <div className="flex items-baseline gap-2 mb-1 px-1 opacity-70"><span className="text-xs font-bold text-slate-300">{log.charName}</span><span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span></div>
                        <div className={cn("px-4 py-2 md:px-5 md:py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-md border backdrop-blur-sm relative", bubbleColor, alignRight ? "rounded-tr-none" : "rounded-tl-none")}>
                            {log.content}
                            <button onClick={() => onDeleteLog(log.id)} className={cn("absolute top-2 p-1.5 rounded-full bg-slate-950/50 text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-all opacity-0 group-hover:opacity-100", alignRight ? "-left-10" : "-right-10")}><Trash2 size={12}/></button>
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-6 pt-0 md:pt-2 bg-slate-950/50 md:bg-transparent backdrop-blur-md md:backdrop-blur-none pb-safe">
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl p-2 md:p-3 relative z-20 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50 shadow-2xl">
            <div className="absolute -top-3 left-4 bg-slate-900 text-slate-300 text-[10px] px-3 py-1 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 font-medium tracking-wide z-10">
              <span className={cn("w-2 h-2 rounded-full animate-pulse", activeCharId === 'pc' ? "bg-indigo-500" : "bg-emerald-500")}></span>
              正在扮演: <span className="text-white font-bold max-w-[100px] truncate">{activeChar.name}</span>
            </div>
            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder={`以 ${activeChar.name} 的身份发言...`} 
              className="w-full bg-transparent border-none text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-0 resize-none px-4 py-3 min-h-[3rem] max-h-24 md:max-h-32 custom-scrollbar text-sm md:text-base" 
            />
            <div className="flex justify-between items-center px-1 md:px-2 pt-2 border-t border-white/5 mt-1">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-2">
                        <NumberStepper value={diceCount} onChange={setDiceCount} min={1} max={100} className="w-28" />
                        <div className="relative">
                          <button 
                              type="button"
                              onClick={() => setShowDiceSelect(!showDiceSelect)}
                              className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 min-w-[4.5rem] shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group"
                          >
                              <span className="text-base font-bold text-white font-mono">D{diceType}</span>
                          </button>
                           {showDiceSelect && (
                             <div className="absolute bottom-12 left-0 bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-50 animate-scale-in w-48">
                                {[4,6,8,10,12,20,100].map(d => (
                                  <button key={d} onClick={() => { setDiceType(d); setShowDiceSelect(false); }} className="p-2 hover:bg-indigo-600 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors">D{d}</button>
                                ))}
                             </div>
                           )}
                        </div>
                        
                        <button onClick={() => onRollDice(diceCount, diceType)} className="p-2 md:p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors h-10 w-10 flex items-center justify-center border border-transparent hover:border-slate-700" title="投掷暗骰"><Dice5 size={20} /></button>
                    </div>
                    <button onClick={onShowStory} className="p-2 text-slate-500 hover:text-slate-300 transition-colors hover:bg-white/5 rounded-lg" title="战报预览"><FileText size={18} /></button>
                </div>
                <Button onClick={handleSend} disabled={!inputText.trim()} size="sm" icon={Send} className="rounded-lg shadow-indigo-500/20 px-4">发送</Button>
            </div>
        </div>
      </div>
    </>
  );
};
