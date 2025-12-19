import React, { useEffect, useState } from 'react';
import { BookOpen, UserPlus, User, Activity, Check, Trash2, AlertTriangle, Copy, FileText, X } from 'lucide-react';
import { Modal, Input, Textarea, Button, NumberStepper, cn } from './UI';
import { ModuleInfo, Character } from '../types';

const ATTR_MAP = [
  { key: 'str', label: '力量 STR' },
  { key: 'con', label: '体质 CON' },
  { key: 'siz', label: '体型 SIZ' },
  { key: 'dex', label: '敏捷 DEX' },
  { key: 'app', label: '外貌 APP' },
  { key: 'int', label: '智力 INT' },
  { key: 'pow', label: '意志 POW' },
  { key: 'edu', label: '教育 EDU' },
  { key: 'luck', label: '幸运 LUCK' },
];

const STAT_ALIASES: Record<string, string> = {
    '力量': 'str', 'str': 'str',
    '体质': 'con', 'con': 'con',
    '体型': 'siz', 'siz': 'siz',
    '敏捷': 'dex', 'dex': 'dex',
    '外貌': 'app', 'app': 'app',
    '智力': 'int', 'int': 'int', '灵感': 'int',
    '意志': 'pow', 'pow': 'pow',
    '教育': 'edu', 'edu': 'edu',
    '幸运': 'luck', 'luck': 'luck', '运气': 'luck',
    'hp': 'hp', '体力': 'hp',
    'san': 'san', '理智': 'san', 'san值': 'san', '理智值': 'san',
    'mp': 'mp', '魔法': 'mp',
};

const SKILL_ALIASES: Record<string, string> = {
    // computer_use
    '计算机': '计算机使用', '电脑': '计算机使用',
    // library_use
    '图书馆': '图书馆使用',
    // drive_auto
    '驾驶': '汽车驾驶', '汽车': '汽车驾驶',
    // credit_rating
    '信用': '信用评级', '信誉': '信用评级',
    // navigate
    '领航': '导航',
    // natural_world
    '博物学': '自然学',
    // charm
    '取悦': '魅惑',
    // cthulhu_mythos
    '克苏鲁': '克苏鲁神话', 'cm': '克苏鲁神话',
    // locksmith
    '开锁': '锁匠', '撬锁': '锁匠',
    // op_hvy_machine
    '重型操作': '重型机械', '操作重型机械': '重型机械', '重型': '重型机械',
    // other
    '侦查': '侦察',
};

// --- Module Info Modal ---
export const ModuleModal: React.FC<{ 
  info: ModuleInfo; 
  password?: string;
  onSave: (info: ModuleInfo, password?: string) => Promise<void>; 
  onClose: () => void; 
}> = ({ info, password, onSave, onClose }) => {
  const [localInfo, setLocalInfo] = useState(info);
  const [localPassword, setLocalPassword] = useState(password || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!localInfo.title.trim()) return;
    setLoading(true);
    await onSave(localInfo, localPassword);
    setLoading(false);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="编辑房间信息" icon={BookOpen} className="max-w-2xl">
      <div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
        <Input label="房间标题" value={localInfo.title} onChange={e => setLocalInfo({...localInfo, title: e.target.value})} placeholder="例如：无尽食欲..." />
        <Input label="房间密码 (留空公开)" value={localPassword} onChange={e => setLocalPassword(e.target.value)} type="password" placeholder="留空则为公开房间" />
        <Textarea label="背景故事 / 守秘人笔记" value={localInfo.description} onChange={e => setLocalInfo({...localInfo, description: e.target.value})} rows={10} placeholder="剧情大纲..." />
      </div>
      <div className="px-6 md:px-8 py-4 md:py-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
        <Button onClick={onClose} variant="ghost">取消</Button>
        <Button onClick={handleSave} variant="primary" size="lg" disabled={loading}>{loading ? '保存中...' : '保存修改'}</Button>
      </div>
    </Modal>
  );
};

// --- Character Modal ---
export const CharacterModal: React.FC<{ 
  initialData: Character; 
  onSave: (c: Character) => void; 
  onDelete?: (id: string) => void; 
  onClose: () => void; 
  isEditing: boolean;
  readOnly?: boolean;
}> = ({ initialData, onSave, onDelete, onClose, isEditing, readOnly }) => {
  const [form, setForm] = useState(initialData);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const skillInputRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isAddingSkill && skillInputRef.current && !skillInputRef.current.contains(event.target as Node)) {
            setIsAddingSkill(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddingSkill]);

  // Auto calc derived stats for new chars (simplistic logic)
  useEffect(() => {
    if (!isEditing && !readOnly) {
        const hp = Math.floor((Number(form.con || 0) + Number(form.siz || 0)) / 10);
        const mp = Math.floor(Number(form.pow || 0) / 5); 
        // Only update if they differ to avoid loops, though strict equality check is enough
        if (hp !== form.hp || mp !== form.mp) {
            setForm(prev => ({ ...prev, hp, san: Number(prev.pow || 0), mp }));
        }
    }
  }, [form.str, form.con, form.siz, form.int, form.pow, isEditing, readOnly]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  };

  const handleImport = () => {
      if (!importText.trim()) return;
      
      const regex = /([\u4e00-\u9fa5a-zA-Z]+)(\d+)/g;
      let match;
      const updates: any = {};
      const newSkills: Record<string, number> = { ...form.skills };
      
      while ((match = regex.exec(importText)) !== null) {
          const key = match[1].toLowerCase();
          const val = parseInt(match[2], 10);
          
          if (STAT_ALIASES[key]) {
              updates[STAT_ALIASES[key]] = val;
          } else {
              // Skill
              const skillName = SKILL_ALIASES[match[1]] || match[1];
              newSkills[skillName] = val; 
          }
      }
      
      setForm(prev => ({ ...prev, ...updates, skills: newSkills }));
      setShowImport(false);
      setImportText('');
  };

  const handleAddSkill = () => {
      if (newSkillName.trim()) {
          setForm(prev => ({ ...prev, skills: { ...prev.skills, [newSkillName.trim()]: 0 } }));
          setNewSkillName('');
          setIsAddingSkill(false);
      }
  };

  const removeSkill = (name: string) => {
      const newSkills = { ...form.skills };
      delete newSkills[name];
      setForm(prev => ({ ...prev, skills: newSkills }));
  };

  return (
    <Modal onClose={onClose} title={readOnly ? '查看档案' : (isEditing ? '编辑档案' : '新角色录入')} icon={readOnly ? FileText : UserPlus} className="max-w-4xl">
       <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar flex-1">
         
         {!readOnly && (
             <div className="flex justify-end">
                 <Button onClick={() => setShowImport(!showImport)} variant="secondary" size="sm" icon={BookOpen}>
                     {showImport ? "关闭导入" : "从骰娘数据导入"}
                 </Button>
             </div>
         )}
         
         {showImport && (
             <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 animate-slide-up">
                 <Textarea 
                    label="粘贴 .st 指令 (例如: .st 力量60str60...)" 
                    value={importText} 
                    onChange={e => setImportText(e.target.value)} 
                    rows={3}
                    className="font-mono text-xs"
                 />
                 <div className="flex justify-end mt-2">
                     <Button onClick={handleImport} variant="primary" size="sm">解析并应用</Button>
                 </div>
             </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-2 bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={14}/> 基础信息</h4>
               <div className="grid grid-cols-2 gap-4 flex-1">
                   <div className="col-span-2"><Input label="姓名" value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={readOnly} /></div>
                   <Input label="职业/种族" value={form.job} onChange={e => setForm({...form, job: e.target.value})} disabled={readOnly} />
                   <div className="grid grid-cols-2 gap-2">
                        <Input label="性别" value={form.sex} onChange={e => setForm({...form, sex: e.target.value})} disabled={readOnly} />
                        <Input label="年龄" value={form.age} onChange={e => setForm({...form, age: e.target.value})} disabled={readOnly} />
                   </div>
                   {['NPC', '怪物'].includes(initialData.role) && !readOnly && (
                      <div className="col-span-2 pt-2">
                          <div className="flex p-1 bg-slate-950/50 rounded-xl border border-white/5 w-full">
                              {['NPC', '怪物'].map(r => (
                                  <button key={r} type="button" onClick={() => setForm({...form, role: r})} className={cn("flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200", form.role === r ? (r === '怪物' ? "bg-rose-600 text-white shadow-lg" : "bg-cyan-600 text-white shadow-lg") : "text-slate-400 hover:text-white hover:bg-white/5")}>{r}</button>
                              ))}
                          </div>
                      </div>
                   )}
               </div>
           </div>
           <div className="md:col-span-1 bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity size={14}/> 衍生状态</h4>
              <div className="space-y-4 flex-1">
                  {[
                    { label: "HP", color: "text-red-400", key: "hp" as keyof Character }, 
                    { label: "SAN", color: "text-emerald-400", key: "san" as keyof Character }, 
                    { label: "MP", color: "text-blue-400", key: "mp" as keyof Character }
                  ].map(stat => (
                      <div key={stat.key} className="flex flex-col gap-1 p-3 bg-slate-950 rounded-xl border border-white/5">
                          <label className={cn("font-bold text-sm mb-1", stat.color)}>{stat.label}</label>
                          <NumberStepper value={form[stat.key] as number} onChange={(val) => setForm({...form, [stat.key]: val})} className="w-full" disabled={readOnly}/>
                      </div>
                  ))}
              </div>
           </div>
         </div>
         
         <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity size={12}/> 基础属性</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {ATTR_MAP.map(attr => (
                      <div key={attr.key} className="flex flex-col group items-center p-2 bg-slate-950/30 rounded-xl border border-white/5">
                          <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 group-hover:text-indigo-400 transition-colors w-full text-left ml-1">{attr.label}</label>
                          <NumberStepper value={form[attr.key as keyof Character] as number} onChange={(val) => setForm({...form, [attr.key]: val})} min={0} max={99} className="w-full" disabled={readOnly}/>
                      </div>
                  ))}
              </div>
         </div>

         <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><BookOpen size={12}/> 技能列表</h4>
                  {!readOnly && !isAddingSkill && <Button onClick={() => setIsAddingSkill(true)} variant="ghost" size="sm" icon={UserPlus}>添加技能</Button>}
              </div>

              {isAddingSkill && (
                  <div ref={skillInputRef} className="flex gap-2 mb-4 items-center bg-slate-950/50 p-2 rounded-lg border border-white/10 animate-fade-in">
                      <Input 
                          value={newSkillName} 
                          onChange={(e) => setNewSkillName(e.target.value)} 
                          placeholder="输入技能名称..." 
                          className="flex-1 min-w-0"
                          autoFocus
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddSkill();
                              if (e.key === 'Escape') setIsAddingSkill(false);
                          }}
                      />
                      <Button onClick={handleAddSkill} variant="primary" size="md" className="shrink-0 shadow-none" disabled={!newSkillName.trim()}>确定</Button>
                  </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Object.entries(form.skills || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, val]) => (
                      <div key={name} className="flex flex-col gap-1 p-2 bg-slate-950/30 rounded-lg border border-white/5 relative group">
                          <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-300 font-bold truncate" title={name}>{name}</span>
                              {!readOnly && <button onClick={() => removeSkill(name)} className="text-slate-600 hover:text-red-400 transition-colors"><X size={12}/></button>}
                          </div>
                          <NumberStepper value={val} onChange={(v) => setForm(prev => ({...prev, skills: {...prev.skills, [name]: v}}))} min={0} max={99} size="sm" disabled={readOnly}/>
                      </div>
                  ))}
                  {Object.keys(form.skills || {}).length === 0 && <div className="col-span-full text-center text-slate-600 text-xs py-4">暂无技能，请手动添加或通过 .st 导入</div>}
              </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Textarea label="背景故事" value={form.backstory} onChange={e => setForm({...form, backstory: e.target.value})} rows={5} disabled={readOnly}/>
            <Textarea label="详细备注 / 物品 / 法术" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={5} disabled={readOnly}/>
         </div>

      </div>
      <div className="px-6 md:px-8 py-4 md:py-6 border-t border-white/10 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          {!readOnly && isEditing && onDelete ? (
            <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
              {deleteConfirm ? (
                <>
                  <span className="text-xs text-red-400 font-bold animate-pulse hidden md:inline">再次点击确认删除</span>
                  <Button onClick={(e) => { e.stopPropagation(); onDelete(form.id); }} variant="dangerActive" icon={AlertTriangle} className="w-full md:w-auto">确认销毁</Button>
                  <Button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(false); }} variant="ghost" size="sm">取消</Button>
                </>
              ) : (
                <Button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true); }} variant="danger" icon={Trash2} className="w-full md:w-auto">删除档案</Button>
              )}
            </div>
          ) : <div className="hidden md:block"></div>}
          <div className="flex gap-4 w-full md:w-auto justify-end">
            {readOnly ? (
                <Button onClick={onClose} variant="secondary" className="w-full md:w-auto">关闭</Button>
            ) : (
                <>
                    <Button onClick={onClose} variant="secondary" className="flex-1 md:flex-none">取消</Button>
                    <Button onClick={handleSave} variant="primary" icon={Check} size="lg" className="flex-1 md:flex-none">保存档案</Button>
                </>
            )}
          </div>
      </div>
    </Modal>
  );
};

// --- Status Edit Modal ---
export const StatusModal: React.FC<{ char: Character; onSave: (hp: number, san: number, mp: number) => void; onClose: () => void }> = ({ char, onSave, onClose }) => {
  const [s, setS] = useState({ hp: char.hp, san: char.san, mp: char.mp });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
        <div className="glass-panel rounded-3xl w-full max-w-md relative z-10 overflow-hidden animate-slide-up bg-[#0f172a]">
            <div className="p-6 border-b border-white/10 bg-slate-900/50 text-center"><h3 className="font-bold text-white text-lg">快速状态调整: {char.name}</h3><p className="text-xs text-slate-500 mt-1">直接修改数值，系统会自动记录变动</p></div>
            <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">{[{ label: 'HP', color: 'text-red-400', key: 'hp', min: -10 }, { label: 'SAN', color: 'text-emerald-400', key: 'san', min: 0 }, { label: 'MP', color: 'text-blue-400', key: 'mp', min: 0 }].map(item => (
              <div key={item.key} className="space-y-2 text-center">
                <label className={cn("text-xs font-bold uppercase tracking-wider", item.color)}>{item.label}</label>
                <NumberStepper value={s[item.key as keyof typeof s]} onChange={(val) => setS({...s, [item.key]: val})} min={item.min} className="w-full"/>
              </div>
            ))}</div>
            <div className="p-6 bg-slate-900/50 flex justify-center border-t border-white/10">
              <Button onClick={() => onSave(s.hp, s.san, s.mp)} variant="primary" className="w-full" size="lg">确认变更</Button>
            </div>
        </div>
    </div>
  );
};

// --- Story Modal ---
export const StoryModal: React.FC<{ content: string; onClose: () => void }> = ({ content, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-[#f8f9fa] rounded-3xl w-full max-w-3xl h-[85vh] flex flex-col relative z-10 shadow-2xl overflow-hidden animate-slide-up">
          <div className="px-6 md:px-8 py-5 border-b flex justify-between items-center bg-white"><h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><FileText size={20} className="text-indigo-600"/> 战报预览</h3><button onClick={onClose}><div className="text-slate-400 hover:text-slate-800 transition-colors"><Trash2 size={24} className="hidden"/> <X size={24}/></div></button></div>
          <div className="flex-1 p-6 md:p-10 overflow-y-auto font-serif text-slate-800 leading-relaxed whitespace-pre-wrap text-base md:text-lg bg-[#fdfdfd]">{content}</div>
          <div className="p-6 border-t bg-slate-50 flex justify-end"><Button onClick={() => navigator.clipboard.writeText(content)} variant="secondary" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm" icon={Copy}>复制全文</Button></div>
      </div>
  </div>
);
