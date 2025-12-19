import React, { useRef, useEffect, useState } from 'react';
import { BookOpen, Activity, Info, Dice5, Send, FileText, User, Swords, UserCog, Crown, Eye, EyeOff } from 'lucide-react';
import { cn, Button, NumberStepper } from './UI';
import { Log, Character } from '../types';
import { Lock, Unlock } from 'lucide-react';

interface ChatAreaProps {
  logs: Log[];
  activeChar: { name: string; role: string };
  activeCharId: string;
  characters: Character[];
  onSend: (text: string, recipientId?: string | null) => void;
  onRollDice: (count: number, type: number, isSecret: boolean, checkInfo?: { name: string, target: number }) => void;
  onShowStory: () => void;
  isKP: boolean;
  kpId: string | null;
}

const getCharIcon = (role: string, size = 18) => {
    if (role === 'Keeper') return <Crown size={size} />;
    if (role === '怪物') return <Swords size={size} />;
    if (role === 'NPC') return <UserCog size={size} />;
    return <User size={size} />;
};

const ATTRIBUTES = [
  { key: 'str', label: '力量' },
  { key: 'con', label: '体质' },
  { key: 'siz', label: '体型' },
  { key: 'dex', label: '敏捷' },
  { key: 'app', label: '外貌' },
  { key: 'int', label: '智力' },
  { key: 'pow', label: '意志' },
  { key: 'edu', label: '教育' },
  { key: 'luck', label: '幸运' },
];

export const ChatArea: React.FC<ChatAreaProps> = ({ logs, activeChar, activeCharId, characters, onSend, onRollDice, onShowStory, isKP, kpId }) => {
  const [inputText, setInputText] = useState('');
  const [diceCount, setDiceCount] = useState(1);
  const [diceType, setDiceType] = useState(6);
  const [showDiceSelect, setShowDiceSelect] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [showRecipientSelect, setShowRecipientSelect] = useState(false);
  
  const [showAttrSelect, setShowAttrSelect] = useState(false);
  const [showSkillSelect, setShowSkillSelect] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const myChar = characters.find(c => c.id === activeCharId);
  const canRollCheck = !!myChar;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [logs]);

  const getRecipientLabel = () => {
    if (!recipientId) return "所有人";
    if (kpId && recipientId === kpId) return "守秘人 (KP)";
    const char = characters.find(c => c.user_id === recipientId);
    return char ? `${char.name}` : "未知用户";
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSend(inputText, recipientId);
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
      <div className="flex-1 overflow-y-auto px-3 md:px-8 py-4 md:py-6 space-y-6 custom-scrollbar">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-600 animate-slide-up">
            <div className="w-24 h-24 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-full flex items-center justify-center mb-6 ring-1 ring-slate-700/50 shadow-2xl">
              <BookOpen size={40} className="text-slate-500 opacity-50" />
            </div>
            <p className="text-lg font-medium text-slate-500">传奇故事，由此开始</p>
          </div>
        )}
        
        {logs.map((log) => {
            const isSystem = log.type === 'system'; 
            const isDice = log.type === 'dice' || log.type === 'dice_secret'; 
            const isStatus = log.type === 'status';
            const isPrivate = !!log.recipientId;

            // Only show character name if it's NOT Keeper. If it is Keeper, show '守秘人'
            const displayName = log.charRole === 'Keeper' ? '守秘人' : log.charName;

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
                  let diceData: any = { count: '?', total: '?', details: [] as number[], type: 6 };
                  const isHidden = log.type === 'dice_secret';
                  const canSee = isKP || log.isMine;

                  if (isHidden && !canSee) {
                      return (
                        <div key={log.id} className="flex flex-col items-center py-4 animate-slide-up">
                            <div className="relative overflow-hidden bg-slate-900 rounded-xl border-l-4 border-slate-600 shadow-2xl p-4 min-w-[260px] max-w-sm w-full opacity-70">
                                <EyeOff className="absolute -right-4 -bottom-4 text-slate-500/10 w-32 h-32 transform rotate-12" />
                                <div className="flex justify-between items-center mb-2 relative z-10">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">{displayName}</span>
                                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase opacity-70">Secret Roll</span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono">{log.timestamp}</span>
                                </div>
                                <div className="flex items-center gap-3 relative z-10 py-2">
                                    <span className="text-slate-400 text-sm font-medium">进行了一次暗骰</span>
                                </div>
                            </div>
                        </div>
                      );
                  }

                  try { diceData = JSON.parse(log.content); } catch(e) { diceData.total = log.content as any; }
                  
                  let borderColor = isHidden ? "border-purple-500" : "border-indigo-500";
                  let textColor = isHidden ? "text-purple-400" : "text-indigo-400";
                  let label = isHidden ? "Secret Roll" : "Dice Roll";
                  let iconColor = isHidden ? "text-purple-500/10" : "text-indigo-500/10";

                  if (diceData.checkResult) {
                      switch (diceData.checkResult) {
                          case 'critical_success':
                              borderColor = "border-amber-400";
                              textColor = "text-amber-400";
                              iconColor = "text-amber-400/10";
                              label = "大成功";
                              break;
                          case 'success':
                              borderColor = "border-emerald-500";
                              textColor = "text-emerald-500";
                              iconColor = "text-emerald-500/10";
                              label = "成功";
                              break;
                          case 'failure':
                              borderColor = "border-slate-500";
                              textColor = "text-slate-500";
                              iconColor = "text-slate-500/10";
                              label = "失败";
                              break;
                          case 'critical_failure':
                              borderColor = "border-red-600";
                              textColor = "text-red-600";
                              iconColor = "text-red-600/10";
                              label = "大失败";
                              break;
                      }
                  }

                  return (
                    <div key={log.id} className="flex flex-col items-center py-4 animate-slide-up">
                        <div className={cn("relative overflow-hidden bg-slate-900 rounded-xl border-l-4 shadow-2xl p-4 min-w-[260px] max-w-sm w-full", borderColor)}>
                            {isHidden ? <EyeOff className={cn("absolute -right-4 -bottom-4 w-32 h-32 transform rotate-12", iconColor)} /> : <Dice5 className={cn("absolute -right-4 -bottom-4 w-32 h-32 transform rotate-12", iconColor)} />}
                            <div className="flex justify-between items-center mb-2 relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">{displayName}</span>
                                    <span className={cn("text-[10px] font-bold tracking-widest uppercase opacity-70", textColor)}>
                                        {diceData.checkName ? `${diceData.checkName} ${label}` : label}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-500 font-mono">{log.timestamp}</span>
                            </div>
                            <div className="flex items-baseline gap-3 relative z-10">
                                <span className="text-slate-400 text-sm font-medium">投掷了</span>
                                <span className="text-white text-lg font-bold">{diceData.count}D{diceData.type||6}</span>
                                <span className="text-slate-600">:</span>
                                <span className={cn("text-4xl font-black font-mono", textColor)}>{diceData.total}</span>
                                {diceData.checkTarget !== undefined && (
                                    <span className="text-xs text-slate-500 font-mono ml-1">/ {diceData.checkTarget}</span>
                                )}
                            </div>
                            {diceData.details && diceData.details.length > 0 && (<div className="mt-3 pt-2 border-t border-slate-800 relative z-10"><div className="flex flex-wrap gap-1 text-xs font-mono text-slate-500">{diceData.details.map((d: any, i: number) => (<span key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{d}</span>))}</div></div>)}
                        </div>
                    </div>
                );
            }

            const bubbleColor = isPrivate 
                ? "bg-slate-900 text-slate-300 border-indigo-500/50 shadow-indigo-500/10" // Private message style
                : (log.charRole === 'Keeper' ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/10" : (log.charRole === '怪物' ? "bg-rose-900/80 text-rose-100 border-rose-800 shadow-rose-900/10" : (log.charRole === 'NPC' ? "bg-slate-800 text-slate-200 border-slate-700 shadow-slate-900/10" : "bg-slate-700/80 text-white border-slate-600"))); 
            const alignRight = log.isMine; 
            const iconColor = log.charRole === '怪物' ? "text-rose-400" : (log.charRole === 'NPC' ? "text-cyan-400" : (log.charRole === 'Keeper' ? "text-indigo-400" : "text-purple-400"));
            
            // DisplayName is already calculated above
            
            return (
                <div key={log.id} className={cn("flex w-full gap-2 md:gap-3 group animate-slide-up", alignRight ? "flex-row-reverse" : "flex-row")}>
                    <div className="mt-1 shrink-0"><div className={cn("p-1.5 md:p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 shadow-lg", iconColor)}>{getCharIcon(log.charRole, 20)}</div></div>
                    <div className={cn("flex flex-col max-w-[80%] md:max-w-[75%]", alignRight ? "items-end" : "items-start")}>
                        <div className="flex items-baseline gap-2 mb-1 px-1 opacity-70">
                            <span className="text-xs font-bold text-slate-300">{displayName}</span>
                            {isPrivate && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 rounded border border-indigo-500/30">私信</span>}
                            <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                        </div>
                        <div className={cn("px-4 py-2 md:px-5 md:py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-md border backdrop-blur-sm relative", bubbleColor, alignRight ? "rounded-tr-none" : "rounded-tl-none")}>
                            {log.content}
                        </div>
                    </div>
                </div>
            );
        })}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-6 pt-0 md:pt-2 bg-slate-950/50 md:bg-transparent backdrop-blur-md md:backdrop-blur-none pb-safe">
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl relative z-20 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50 shadow-2xl flex flex-col">

            <div className="absolute -top-3 left-4 bg-slate-900 text-slate-300 text-[10px] px-3 py-1 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 font-medium tracking-wide z-30">
              <span className={cn("w-2 h-2 rounded-full animate-pulse", activeCharId === 'pc' ? "bg-indigo-500" : "bg-emerald-500")}></span>
              正在扮演: <span className="text-white font-bold max-w-[100px] truncate">{activeChar.name}</span>
            </div>

            {/* Dice Toolbar */}
            <div className="flex items-center gap-2 overflow-x-auto p-2 border-b border-white/5 no-scrollbar min-h-[3.5rem] pt-3">
                 <div className="flex items-center gap-2 shrink-0">
                    {canRollCheck && (
                        <>
                            <div className="relative shrink-0">
                                <button 
                                    type="button"
                                    onClick={() => { setShowAttrSelect(!showAttrSelect); setShowSkillSelect(false); setShowDiceSelect(false); }}
                                    className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-9 shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group min-w-[3.5rem]"
                                    title="属性判定"
                                >
                                    <span className="text-xs md:text-sm font-bold text-slate-300 font-mono group-hover:text-white">属性</span>
                                </button>
                                {showAttrSelect && (
                                    <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-50 animate-scale-in w-64">
                                        {ATTRIBUTES.map(attr => {
                                            const val = (myChar as any)[attr.key] || 0;
                                            return (
                                                <button 
                                                    key={attr.key} 
                                                    onClick={() => { 
                                                        onRollDice(1, 100, isSecret, { name: attr.label, target: val }); 
                                                        setShowAttrSelect(false); 
                                                    }} 
                                                    className="flex flex-col items-center p-2 hover:bg-indigo-600 rounded-lg transition-colors group/item"
                                                >
                                                    <span className="text-xs font-bold text-slate-300 group-hover/item:text-white">{attr.label}</span>
                                                    <span className="text-[10px] text-slate-500 group-hover/item:text-slate-200">{val}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="relative shrink-0">
                                <button 
                                    type="button"
                                    onClick={() => { setShowSkillSelect(!showSkillSelect); setShowAttrSelect(false); setShowDiceSelect(false); }}
                                    className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-9 shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group min-w-[3.5rem]"
                                    title="技能判定"
                                >
                                    <span className="text-xs md:text-sm font-bold text-slate-300 font-mono group-hover:text-white">技能</span>
                                </button>
                                {showSkillSelect && (
                                    <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-2 gap-1 shadow-xl z-50 animate-scale-in w-64 max-h-64 overflow-y-auto custom-scrollbar">
                                        {Object.keys(myChar?.skills || {}).length === 0 ? (
                                            <div className="col-span-2 text-center text-xs text-slate-500 py-2">暂无技能</div>
                                        ) : (
                                            Object.entries(myChar?.skills || {}).map(([name, val]) => (
                                                <button 
                                                    key={name} 
                                                    onClick={() => { 
                                                        onRollDice(1, 100, isSecret, { name: name, target: val }); 
                                                        setShowSkillSelect(false); 
                                                    }} 
                                                    className="flex justify-between items-center px-3 py-2 hover:bg-indigo-600 rounded-lg transition-colors text-left group/item"
                                                >
                                                    <span className="text-xs font-bold text-slate-300 group-hover/item:text-white truncate max-w-[80px]">{name}</span>
                                                    <span className="text-[10px] text-slate-500 group-hover/item:text-slate-200">{val}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    
                    <NumberStepper value={diceCount} onChange={setDiceCount} min={1} max={100} className="w-20 md:w-24 h-9" />

                    <div className="relative shrink-0">
                      <button 
                          type="button"
                          onClick={() => setShowDiceSelect(!showDiceSelect)}
                          className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-9 min-w-[3.5rem] md:min-w-[4.5rem] shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group"
                      >
                          <span className="text-sm font-bold text-white font-mono">D{diceType}</span>
                      </button>
                       {showDiceSelect && (
                         <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-50 animate-scale-in w-48">
                            {[4,6,8,10,12,20,100].map(d => (
                              <button key={d} onClick={() => { setDiceType(d); setShowDiceSelect(false); }} className="p-2 hover:bg-indigo-600 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors">D{d}</button>
                            ))}
                         </div>
                       )}
                    </div>
                    
                    {isKP && (
                        <button 
                            onClick={() => setIsSecret(!isSecret)} 
                            className={cn(
                                "p-2 md:p-1.5 rounded-xl transition-colors h-9 w-9 flex items-center justify-center border shrink-0",
                                isSecret ? "bg-purple-500/20 text-purple-400 border-purple-500/50" : "bg-transparent text-slate-400 border-transparent hover:bg-slate-800 hover:text-indigo-400"
                            )} 
                            title={isSecret ? "暗骰模式已开启" : "开启暗骰模式"}
                        >
                            {isSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    )}

                    <button onClick={() => onRollDice(diceCount, diceType, isSecret)} className="p-2 md:p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors h-9 w-9 flex items-center justify-center border border-transparent hover:border-slate-700 shrink-0" title="投掷"><Dice5 size={18} /></button>
                    
                    {isKP && <button onClick={onShowStory} className="p-2 text-slate-500 hover:text-slate-300 transition-colors hover:bg-white/5 rounded-lg shrink-0" title="战报预览"><FileText size={18} /></button>}
                </div>
            </div>

            {/* Chat Input Row */}
            <div className="flex items-end gap-2 p-2">
                <div className="relative shrink-0">
                    {/* Recipient Popup */}
                    {showRecipientSelect && (
                        <div className="absolute bottom-full left-0 mb-3 w-52 bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in flex flex-col p-1 ring-1 ring-white/5">
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">发送给</div>
                            <button
                                onClick={() => { setRecipientId(null); setShowRecipientSelect(false); }}
                                className={cn("px-3 py-2.5 text-left text-xs rounded-xl transition-all flex items-center gap-3 group", !recipientId ? "bg-indigo-500/10 text-indigo-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200")}
                            >
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", !recipientId ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-500 group-hover:bg-slate-700")}>
                                    <Unlock size={14} />
                                </div>
                                <span className="font-medium">所有人</span>
                                {!recipientId && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                            </button>
                            
                            <div className="h-px bg-slate-800/50 my-1 mx-2" />
                            
                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                                {isKP && characters.filter(c => c.type === 'investigator').map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setRecipientId(c.user_id || null); setShowRecipientSelect(false); }}
                                        className={cn("w-full px-3 py-2 text-left text-xs rounded-xl transition-all flex items-center gap-3 group", recipientId === c.user_id ? "bg-indigo-500/10 text-indigo-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200")}
                                    >
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", recipientId === c.user_id ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-500 group-hover:bg-slate-700")}>
                                            <User size={14} />
                                        </div>
                                        <span className="font-medium truncate flex-1">{c.name}</span>
                                        {recipientId === c.user_id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                                    </button>
                                ))}
                                
                                {!isKP && kpId && (
                                     <button
                                        onClick={() => { setRecipientId(kpId); setShowRecipientSelect(false); }}
                                        className={cn("w-full px-3 py-2 text-left text-xs rounded-xl transition-all flex items-center gap-3 group", recipientId === kpId ? "bg-indigo-500/10 text-indigo-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200")}
                                    >
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", recipientId === kpId ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-500 group-hover:bg-slate-700")}>
                                            <Crown size={14} />
                                        </div>
                                        <span className="font-medium truncate flex-1">守秘人 (KP)</span>
                                        {recipientId === kpId && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={() => setShowRecipientSelect(!showRecipientSelect)}
                        className={cn(
                            "h-10 px-3 rounded-xl border flex items-center gap-2 transition-all font-medium text-xs",
                            recipientId 
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20" 
                                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                        )}
                        title="选择发送对象"
                    >
                        {recipientId ? <Lock size={16} className="opacity-70" /> : <Unlock size={16} className="opacity-70" />}
                        <span className="max-w-[80px] truncate hidden md:block">{getRecipientLabel()}</span>
                    </button>
                </div>

                <textarea 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  placeholder={`以 ${activeChar.name} 的身份发言...`} 
                  className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-0 resize-none px-3 py-2 min-h-[2.5rem] max-h-24 md:max-h-32 custom-scrollbar text-sm md:text-base" 
                  rows={1}
                />
                
                <Button onClick={handleSend} disabled={!inputText.trim()} size="icon" icon={Send} className="rounded-xl shadow-indigo-500/20 h-10 w-10 shrink-0 mb-0" />
            </div>
        </div>
      </div>
    </>
  );
};