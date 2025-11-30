import React, { useEffect, useState } from 'react';
import { BookOpen, UserPlus, User, Activity, Check, Trash2, AlertTriangle, Copy, FileText, Swords, UserCog, X } from 'lucide-react';
import { Modal, Input, Textarea, Button, NumberStepper, cn } from './UI';
import { ModuleInfo, Character } from '../types';

// --- Module Info Modal ---
export const ModuleModal: React.FC<{ info: ModuleInfo; onChange: (i: ModuleInfo) => void; onClose: () => void }> = ({ info, onChange, onClose }) => (
  <Modal onClose={onClose} title="编辑模组" icon={BookOpen} className="max-w-2xl">
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
      <Input label="模组标题" value={info.title} onChange={e => onChange({...info, title: e.target.value})} placeholder="例如：无尽食欲..." />
      <Textarea label="背景故事 / 守秘人笔记" value={info.description} onChange={e => onChange({...info, description: e.target.value})} rows={10} placeholder="剧情大纲..." />
    </div>
    <div className="px-6 md:px-8 py-4 md:py-6 border-t border-white/10 bg-white/5 flex justify-end">
      <Button onClick={onClose} variant="primary" size="lg">完成</Button>
    </div>
  </Modal>
);

// --- Character Modal ---
export const CharacterModal: React.FC<{ 
  initialData: Character; 
  onSave: (c: Character) => void; 
  onDelete?: (id: string) => void; 
  onClose: () => void; 
  isEditing: boolean;
}> = ({ initialData, onSave, onDelete, onClose, isEditing }) => {
  const [form, setForm] = useState(initialData);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Auto calc derived stats for new chars (simplistic logic)
  useEffect(() => {
    if (!isEditing) {
        const hp = Math.floor((Number(form.con || 0) + Number(form.siz || 0)) / 10);
        const mp = Math.floor(Number(form.pow || 0) / 5); 
        // Only update if they differ to avoid loops, though strict equality check is enough
        if (hp !== form.hp || mp !== form.mp) {
            setForm(prev => ({ ...prev, hp, san: Number(prev.pow || 0), mp }));
        }
    }
  }, [form.str, form.con, form.siz, form.int, form.pow, isEditing]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <Modal onClose={onClose} title={isEditing ? '编辑档案' : '新角色录入'} icon={UserPlus} className="max-w-4xl">
       <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar flex-1">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-2 bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={14}/> 基础信息</h4>
               <div className="grid grid-cols-2 gap-4 flex-1">
                   <div className="col-span-2"><Input label="姓名" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                   <Input label="职业/种族" value={form.job} onChange={e => setForm({...form, job: e.target.value})} />
                   <Input label="年龄/性别" value={form.ageSex} onChange={e => setForm({...form, ageSex: e.target.value})} />
                   {['NPC', '怪物'].includes(initialData.role) && (
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
                          <NumberStepper value={form[stat.key] as number} onChange={(val) => setForm({...form, [stat.key]: val})} className="w-full"/>
                      </div>
                  ))}
              </div>
           </div>
         </div>
         
         <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity size={12}/> 基础属性</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {['str','con','siz','dex','app','int','pow','edu','luck'].map(attr => (
                      <div key={attr} className="flex flex-col group items-center p-2 bg-slate-950/30 rounded-xl border border-white/5">
                          <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 group-hover:text-indigo-400 transition-colors w-full text-left ml-1">{attr}</label>
                          <NumberStepper value={form[attr as keyof Character] as number} onChange={(val) => setForm({...form, [attr]: val})} min={0} max={99} className="w-full"/>
                      </div>
                  ))}
              </div>
         </div>

         <Textarea label="详细备注 / 物品 / 法术" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={5}/>
      </div>
      <div className="px-6 md:px-8 py-4 md:py-6 border-t border-white/10 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          {isEditing && onDelete ? (
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
          <div className="flex gap-4 w-full md:w-auto">
            <Button onClick={onClose} variant="secondary" className="flex-1 md:flex-none">取消</Button>
            <Button onClick={handleSave} variant="primary" icon={Check} size="lg" className="flex-1 md:flex-none">保存档案</Button>
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
            <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">{[{ label: 'HP', color: 'text-red-400', key: 'hp' }, { label: 'SAN', color: 'text-emerald-400', key: 'san' }, { label: 'MP', color: 'text-blue-400', key: 'mp' }].map(item => (
              <div key={item.key} className="space-y-2 text-center">
                <label className={cn("text-xs font-bold uppercase tracking-wider", item.color)}>{item.label}</label>
                <NumberStepper value={s[item.key as keyof typeof s]} onChange={(val) => setS({...s, [item.key]: val})} className="w-full"/>
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