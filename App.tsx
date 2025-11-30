import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Dashboard } from './components/Dashboard';
import { ModuleModal, CharacterModal, StatusModal, StoryModal } from './components/Modals';
import { Button } from './components/UI';
import { ModuleInfo, Character, Log, AppData } from './types';
import { Menu, Upload, Save } from 'lucide-react';

// Default Data
const DEFAULT_DATA = {
    moduleInfo: { title: '印斯茅斯之影', description: '沿海小镇的神秘案件...', notes: '' },
    characters: [
        { id: 'char_001', name: '爱丽丝', role: '调查员', job: '侦探', ageSex: '26/女', str: 50, con: 60, siz: 55, dex: 70, app: 65, int: 75, pow: 60, edu: 70, luck: 50, hp: 11, san: 60, mp: 12, notes: '物品：放大镜，左轮。' },
        { id: 'npc_001', name: '深潜者', role: '怪物', job: '下级种族', ageSex: '未知', str: 80, con: 80, siz: 80, dex: 55, app: 10, int: 50, pow: 50, edu: 0, luck: 0, hp: 16, san: 0, mp: 10, notes: '深海生物。' }
    ],
    logs: [
        { id: 1, timestamp: '20:00', charId: 'pc', charName: '守秘人', charRole: 'Keeper', type: 'normal' as const, content: '欢迎来到《印斯茅斯之影》。' },
    ]
};

const INITIAL_CHAR_STATE: Character = { 
    id: '', name: '', role: '调查员', job: '', ageSex: '', 
    str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 50, luck: 50, 
    hp: 10, san: 50, mp: 10, notes: '' 
};

const App: React.FC = () => {
    // Application State
    const [view, setView] = useState('main'); 
    const [characters, setCharacters] = useState<Character[]>(DEFAULT_DATA.characters);
    const [logs, setLogs] = useState<Log[]>(DEFAULT_DATA.logs);
    const [moduleInfo, setModuleInfo] = useState<ModuleInfo>(DEFAULT_DATA.moduleInfo);
    const [activeCharId, setActiveCharId] = useState('pc');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Modal State
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [showCharModal, setShowCharModal] = useState(false);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [editingChar, setEditingChar] = useState<Character | null>(null);
    const [statusTargetId, setStatusTargetId] = useState<string | null>(null);

    // Responsive Check
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setSidebarOpen(false);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // --- Helpers ---
    const addLog = (type: Log['type'], content: string, customCharId?: string) => {
        if (!content.trim()) return;
        const targetId = customCharId || activeCharId;
        const isMainPC = targetId === 'pc';
        const char = characters.find(c => c.id === targetId);
        
        const newLog: Log = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            charId: targetId,
            charName: isMainPC ? '守秘人' : (char ? char.name : '未知'),
            charRole: isMainPC ? 'Keeper' : (char ? char.role : 'Unknown'),
            type: type, 
            content: content
        };
        setLogs(prev => [...prev, newLog]);
    };

    const deleteLog = (id: number) => {
        setLogs(prev => prev.filter(l => l.id !== id));
    };

    const rollDice = (count: number, type: number) => {
        let total = 0;
        let details: number[] = [];
        for(let i=0; i<count; i++) {
          const roll = Math.floor(Math.random() * type) + 1; 
          total += roll;
          details.push(roll);
        }
        addLog('dice', JSON.stringify({ count, type, total, details }), 'pc');
    };

    const generateStory = () => {
        if (logs.length === 0) return "暂无记录。";
        return logs.map(log => {
            if (log.type === 'dice') {
                try {
                    const d = JSON.parse(log.content);
                    return `> [系统] 投掷了 ${d.count}D${d.type||6}: ${d.total} [${d.details.join(', ')}]`;
                } catch(e) { return `> [系统] ${log.content}`; }
            }
            if (['system', 'status'].includes(log.type)) return `> [${log.charName}] ${log.content}`;
            return `**${log.charName}**: ${log.content}`;
        }).join('\n\n');
    };

    // --- CRUD ---
    const handleSaveCharacter = (char: Character) => {
        if (editingChar) {
            setCharacters(prev => prev.map(c => c.id === char.id ? char : c));
            addLog('system', `守秘人 更新了 [${char.name}] 的档案`);
        } else {
            const newChar = { ...char, id: Date.now().toString() };
            setCharacters(prev => [...prev, newChar]);
            addLog('system', `新角色录入: ${newChar.name} (${newChar.role})`);
        }
    };

    const handleDeleteCharacter = (id: string) => {
        setCharacters(prev => prev.filter(c => c.id !== id));
        if (activeCharId === id) setActiveCharId('pc');
        setShowCharModal(false);
        addLog('system', `档案已删除`);
    };

    const handleUpdateStatus = (hp: number, san: number, mp: number) => {
        if (!statusTargetId) return;
        const target = characters.find(c => c.id === statusTargetId);
        if (!target) return;

        const changes = [];
        if (hp !== target.hp) changes.push(`HP ${hp > target.hp ? '+' : ''}${hp - target.hp}`);
        if (san !== target.san) changes.push(`SAN ${san > target.san ? '+' : ''}${san - target.san}`);
        
        if (changes.length > 0) {
            setCharacters(prev => prev.map(c => c.id === target.id ? { ...c, hp, san, mp } : c));
            addLog('status', `${target.name} 状态变更: ${changes.join(', ')}`, target.id);
        }
        setShowStatusModal(false);
        setStatusTargetId(null);
    };

    // --- File I/O ---
    const handleSaveFile = () => {
        const data: AppData = { version: '4.0', timestamp: Date.now(), moduleInfo, characters, logs };
        const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url;
        a.download=`RunTable_${moduleInfo.title}_${Date.now()}.json`;
        a.click();
    };

    const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const d = JSON.parse(ev.target?.result as string) as AppData;
                if(d.moduleInfo) setModuleInfo(d.moduleInfo);
                if(d.characters) setCharacters(d.characters);
                if(d.logs) setLogs(d.logs);
                setView('main');
            } catch(err){ alert("存档损坏或格式错误"); }
        };
        reader.readAsText(file);
    };

    const activeChar = activeCharId === 'pc' 
        ? { name: '守秘人', role: 'Keeper' } 
        : (characters.find(c => c.id === activeCharId) || { name: '未知', role: 'Unknown' });

    return (
        <div className="flex h-screen text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden bg-[#020617]">
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                 <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-900/20 rounded-full blur-[100px] animate-blob"></div>
                 <div className="absolute bottom-[10%] right-[-5%] w-[30rem] h-[30rem] bg-indigo-900/10 rounded-full blur-[120px] animate-blob" style={{animationDelay: '2s'}}></div>
                 <div className="absolute top-[40%] left-[30%] w-72 h-72 bg-slate-800/20 rounded-full blur-[80px] animate-blob" style={{animationDelay: '4s'}}></div>
             </div>

             <Sidebar 
                isOpen={sidebarOpen} 
                setIsOpen={setSidebarOpen} 
                view={view} 
                setView={setView} 
                activeCharId={activeCharId} 
                setActiveCharId={setActiveCharId} 
                characters={characters}
                onOpenStatusEdit={(id) => { setStatusTargetId(id); setShowStatusModal(true); }}
                isMobile={isMobile}
             />

             <main className="flex-1 flex flex-col relative min-w-0 z-10">
                <header className="min-h-[5rem] h-auto pt-safe flex items-center justify-between px-4 md:px-8 border-b border-white/5 backdrop-blur-sm sticky top-0 z-20 bg-slate-900/80 md:bg-transparent">
                    <div className="flex items-center gap-3">
                         <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white md:hidden"><Menu size={24} /></button>
                         <div className="flex flex-col justify-center">
                             <h1 className="text-white font-bold text-lg md:text-xl tracking-tight">{moduleInfo.title || "未命名模组"}</h1>
                             <p className="text-xs text-slate-500 truncate max-w-[150px] md:max-w-md mt-1">{moduleInfo.description || "暂无描述"}</p>
                         </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="relative overflow-hidden">
                             <input type="file" accept=".json" onChange={handleLoadFile} className="absolute inset-0 opacity-0 cursor-pointer z-10"/>
                             <Button variant="ghost" size={isMobile ? "icon" : "sm"} icon={Upload} className="relative">{!isMobile && "导入"}</Button>
                        </div>
                        <Button variant="ghost" size={isMobile ? "icon" : "sm"} icon={Save} onClick={handleSaveFile}>{!isMobile && "保存"}</Button>
                    </div>
                </header>

                {view === 'main' ? (
                    <ChatArea 
                        logs={logs}
                        activeChar={activeChar}
                        activeCharId={activeCharId}
                        onSend={(text) => addLog('normal', text)}
                        onDeleteLog={deleteLog}
                        onRollDice={rollDice}
                        onShowStory={() => setShowStoryModal(true)}
                    />
                ) : (
                    <Dashboard 
                        moduleInfo={moduleInfo}
                        characters={characters}
                        onEditModule={() => setShowModuleModal(true)}
                        onAddChar={(role) => { setEditingChar(null); setShowCharModal(true); }}
                        onEditChar={(char) => { setEditingChar(char); setShowCharModal(true); }}
                    />
                )}
             </main>

             {/* Modals */}
             {showModuleModal && (
                 <ModuleModal 
                    info={moduleInfo} 
                    onChange={setModuleInfo} 
                    onClose={() => setShowModuleModal(false)} 
                 />
             )}

             {showCharModal && (
                 <CharacterModal 
                    initialData={editingChar || INITIAL_CHAR_STATE}
                    isEditing={!!editingChar}
                    onSave={handleSaveCharacter}
                    onDelete={handleDeleteCharacter}
                    onClose={() => setShowCharModal(false)}
                 />
             )}

             {showStatusModal && statusTargetId && (
                 <StatusModal 
                    char={characters.find(c => c.id === statusTargetId)!}
                    onSave={handleUpdateStatus}
                    onClose={() => { setShowStatusModal(false); setStatusTargetId(null); }}
                 />
             )}

             {showStoryModal && (
                 <StoryModal 
                    content={generateStory()} 
                    onClose={() => setShowStoryModal(false)} 
                 />
             )}
        </div>
    );
};

export default App;
