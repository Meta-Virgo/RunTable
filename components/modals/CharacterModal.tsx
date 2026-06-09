import React, { useEffect, useState } from "react";
import {
  BookOpen,
  UserPlus,
  User,
  Activity,
  Check,
  Trash2,
  AlertTriangle,
  FileText,
  X,
  LogOut,
  Zap,
  Package,
  Plus,
  Minus,
  Edit,
} from "lucide-react";
import { Modal, Input, Textarea, Button, NumberStepper, cn } from "../UI";
import { AvatarUpload } from "../AvatarUpload";
import { AttributeRadar } from "../AttributeRadar";
import { Character, InventoryItem } from "../../types";
import { calculateDBAndBuild } from "../../utils/cocRules";
import {
  CHARACTER_IMPORT_ATTRIBUTES,
  applyCharacterImport,
} from "../../services/characterImportModel";

const ItemListEditor: React.FC<{
  title: string;
  icon: React.ElementType;
  items: InventoryItem[];
  onChange: (items: InventoryItem[]) => void;
  disabled?: boolean;
}> = ({ title, icon: Icon, items, onChange, disabled }) => {
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!newItemName.trim()) return;

    if (editingIndex !== null) {
      const newItems = [...items];
      newItems[editingIndex] = {
        name: newItemName.trim(),
        quantity: newItemQty,
        description: newItemDesc.trim(),
      };
      onChange(newItems);
    } else {
      onChange([
        ...items,
        {
          name: newItemName.trim(),
          quantity: newItemQty,
          description: newItemDesc.trim(),
        },
      ]);
    }

    setNewItemName("");
    setNewItemDesc("");
    setNewItemQty(1);
    setEditingIndex(null);
    setIsAdding(false);
  };

  const handleEdit = (index: number) => {
    const item = items[index];
    setNewItemName(item.name);
    setNewItemQty(item.quantity);
    setNewItemDesc(item.description || "");
    setEditingIndex(index);
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const handleUpdateQty = (index: number, delta: number) => {
    const newItems = [...items];
    const newQty = Math.max(0, newItems[index].quantity + delta);
    if (newQty === 0) {
      // Optional: Ask for confirmation or just remove?
      // Let's just remove if 0
      newItems.splice(index, 1);
    } else {
      newItems[index].quantity = newQty;
    }
    onChange(newItems);
  };

  return (
    <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Icon size={12} /> {title}
        </h4>
        {!disabled && !isAdding && (
          <Button
            onClick={() => {
              setNewItemName("");
              setNewItemQty(1);
              setNewItemDesc("");
              setEditingIndex(null);
              setIsAdding(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            variant="ghost"
            size="sm"
            icon={UserPlus}
          >
            添加
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="flex flex-col gap-2 mb-4 bg-slate-950/50 p-2 rounded-lg border border-white/10 animate-fade-in">
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="名称..."
              className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // If there's a description input, maybe move focus?
                  // But for now let's just submit if description is empty or user wants to.
                  // Actually, better to let them tab to description.
                }
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setEditingIndex(null);
                }
              }}
            />
            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
              <span className="text-xs text-slate-500">
                {title === "法术 / 能力" ? "MP" : "x"}
              </span>
              <input
                type="number"
                value={newItemQty}
                onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                className="w-12 bg-transparent text-sm text-white focus:outline-none text-right"
                min={1}
              />
            </div>
          </div>
          <textarea
            value={newItemDesc}
            onChange={(e) => setNewItemDesc(e.target.value)}
            placeholder="详细描述 (可选)..."
            className="w-full bg-transparent text-xs text-slate-400 focus:outline-none border-t border-white/5 pt-2 resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAdd();
              }
              if (e.key === "Escape") {
                setIsAdding(false);
                setEditingIndex(null);
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setIsAdding(false);
                setEditingIndex(null);
              }}
              variant="ghost"
              size="sm"
              className="shrink-0 shadow-none h-7 py-0"
            >
              取消
            </Button>
            <Button
              onClick={handleAdd}
              variant="primary"
              size="sm"
              className="shrink-0 shadow-none h-7 py-0"
              disabled={!newItemName.trim()}
            >
              {editingIndex !== null ? "保存" : "确定"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar min-h-[100px] max-h-[200px]">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col p-2 bg-slate-950/30 rounded-lg border border-white/5 group hover:bg-slate-950/50 transition-colors cursor-pointer"
            onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-sm text-slate-300 font-medium truncate flex-1 mr-2"
              >
                {item.name}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-900 rounded-md px-1.5 py-0.5 border border-white/5">
                  <span className="text-xs text-slate-500">
                    {title === "法术 / 能力" ? "MP" : "x"}
                  </span>
                  <span className="text-sm font-mono text-indigo-300">
                    {item.quantity}
                  </span>
                </div>
                {!disabled && (
                  <div
                    className="flex gap-1 opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {title === "法术 / 能力" ? (
                      <>
                        <button
                          onClick={() => handleEdit(idx)}
                          className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => handleRemove(idx)}
                          className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {expandedIndex === idx && (
              <div className="mt-2 text-xs text-slate-400 border-t border-white/5 pt-2 whitespace-pre-wrap animate-fade-in break-all">
                {item.description || "暂无描述"}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && !isAdding && (
          <div className="text-center text-slate-600 text-xs py-8">
            暂无条目
          </div>
        )}
      </div>
    </div>
  );
};

// --- Character Modal ---
export const CharacterModal: React.FC<{
  initialData: Character;
  onSave: (c: Character) => void;
  onDelete?: (id: string) => void;
  onRemove?: (id: string) => void;
  onClose: () => void;
  isEditing: boolean;
  readOnly?: boolean;
}> = ({
  initialData,
  onSave,
  onDelete,
  onRemove,
  onClose,
  isEditing,
  readOnly,
}) => {
  const [form, setForm] = useState(initialData);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const skillInputRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isAddingSkill &&
        skillInputRef.current &&
        !skillInputRef.current.contains(event.target as Node)
      ) {
        setIsAddingSkill(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddingSkill]);

  // Auto calc derived stats for new chars (simplistic logic)
  useEffect(() => {
    if (!isEditing && !readOnly) {
      const hp = Math.floor(
        (Number(form.con || 0) + Number(form.siz || 0)) / 10
      );
      const mp = Math.floor(Number(form.pow || 0) / 5);
      // Only update if they differ to avoid loops, though strict equality check is enough
      if (hp !== form.hp || mp !== form.mp) {
        setForm((prev) => ({ ...prev, hp, san: Number(prev.pow || 0), mp }));
      }
    }
  }, [form.str, form.con, form.siz, form.int, form.pow, isEditing, readOnly]);

  // Auto calc DB & Build
  useEffect(() => {
    const { db, build } = calculateDBAndBuild(
      Number(form.str || 0),
      Number(form.siz || 0)
    );
    if (db !== form.db || build !== form.build) {
      setForm((prev) => ({ ...prev, db, build }));
    }
  }, [form.str, form.siz]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    setForm((prev) => applyCharacterImport({ character: prev, text: importText }));
    setShowImport(false);
    setImportText("");
  };

  const handleAddSkill = () => {
    if (newSkillName.trim()) {
      setForm((prev) => ({
        ...prev,
        skills: { ...prev.skills, [newSkillName.trim()]: 0 },
      }));
      setNewSkillName("");
      setIsAddingSkill(false);
    }
  };

  const removeSkill = (name: string) => {
    const newSkills = { ...form.skills };
    delete newSkills[name];
    setForm((prev) => ({ ...prev, skills: newSkills }));
  };

  return (
    <Modal
      onClose={onClose}
      title={readOnly ? "查看档案" : isEditing ? "编辑档案" : "新角色录入"}
      icon={readOnly ? FileText : UserPlus}
      className="max-w-4xl"
    >
      <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar flex-1">
        {!readOnly && (
          <div className="flex justify-end">
            <Button
              onClick={() => setShowImport(!showImport)}
              variant="secondary"
              size="sm"
              icon={BookOpen}
            >
              {showImport ? "关闭导入" : "从骰娘数据导入"}
            </Button>
          </div>
        )}

        {showImport && (
          <div className="bg-slate-900/50 p-4 rounded-xl border border-white/10 animate-slide-up">
            <Textarea
              label="粘贴 .st 指令 (例如: .st 力量60str60...)"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
            <div className="flex justify-end mt-2">
              <Button onClick={handleImport} variant="primary" size="sm">
                解析并应用
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mt-2">
                <User size={14} /> 基础信息
              </h4>
              <AvatarUpload
                url={form.avatar_url}
                onUpload={(url) => setForm({ ...form, avatar_url: url })}
                editable={!readOnly}
                size={64}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="col-span-2">
                <Input
                  label="姓名"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <Input
                label="职业/种族"
                value={form.job}
                onChange={(e) => setForm({ ...form, job: e.target.value })}
                disabled={readOnly}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="性别"
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value })}
                  disabled={readOnly}
                />
                <Input
                  label="年龄"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              {["NPC", "怪物"].includes(initialData.role) && !readOnly && (
                <div className="col-span-2 pt-2">
                  <div className="flex p-1 bg-slate-950/50 rounded-xl border border-white/5 w-full">
                    {["NPC", "怪物"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm({ ...form, role: r })}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                          form.role === r
                            ? r === "怪物"
                              ? "bg-rose-600 text-white shadow-lg"
                              : "bg-cyan-600 text-white shadow-lg"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <AttributeRadar
              character={form}
              className="mt-6 border-t border-white/5 pt-6"
            />
          </div>
          <div className="md:col-span-1 bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col h-full">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={14} /> 衍生状态
            </h4>
            <div className="space-y-4 flex-1">
              {[
                {
                  label: "HP",
                  color: "text-red-400",
                  key: "hp" as keyof Character,
                },
                {
                  label: "SAN",
                  color: "text-emerald-400",
                  key: "san" as keyof Character,
                },
                {
                  label: "MP",
                  color: "text-blue-400",
                  key: "mp" as keyof Character,
                },
              ].map((stat) => (
                <div
                  key={stat.key}
                  className="flex flex-col gap-1 p-3 bg-slate-950 rounded-xl border border-white/5"
                >
                  <label className={cn("font-bold text-sm mb-1", stat.color)}>
                    {stat.label}
                  </label>
                  <NumberStepper
                    value={form[stat.key] as number}
                    onChange={(val) => setForm({ ...form, [stat.key]: val })}
                    className="w-full"
                    disabled={readOnly}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded-xl border border-white/5 text-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    DB
                  </label>
                  <div className="text-base font-mono font-bold text-white">
                    {form.db || "0"}
                  </div>
                </div>
                <div className="flex flex-col gap-1 p-2 bg-slate-950 rounded-xl border border-white/5 text-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Build
                  </label>
                  <div className="text-base font-mono font-bold text-white">
                    {form.build || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={12} /> 基础属性
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {CHARACTER_IMPORT_ATTRIBUTES.map((attr) => (
              <div
                key={attr.key}
                className="flex flex-col group items-center p-2 bg-slate-950/30 rounded-xl border border-white/5"
              >
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 group-hover:text-indigo-400 transition-colors w-full text-left ml-1">
                  {attr.label}
                </label>
                <NumberStepper
                  value={form[attr.key as keyof Character] as number}
                  onChange={(val) => setForm({ ...form, [attr.key]: val })}
                  min={0}
                  max={999}
                  className="w-full"
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={12} /> 技能列表
            </h4>
            {!readOnly && !isAddingSkill && (
              <Button
                onClick={() => setIsAddingSkill(true)}
                variant="ghost"
                size="sm"
                icon={UserPlus}
              >
                添加技能
              </Button>
            )}
          </div>

          {isAddingSkill && (
            <div
              ref={skillInputRef}
              className="flex gap-2 mb-4 items-center bg-slate-950/50 p-2 rounded-lg border border-white/10 animate-fade-in"
            >
              <Input
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                placeholder="输入技能名称..."
                className="flex-1 min-w-0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSkill();
                  if (e.key === "Escape") setIsAddingSkill(false);
                }}
              />
              <Button
                onClick={handleAddSkill}
                variant="primary"
                size="md"
                className="shrink-0 shadow-none"
                disabled={!newSkillName.trim()}
              >
                确定
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(form.skills || {})
              .sort(([, a], [, b]) => b - a)
              .map(([name, val]) => (
                <div
                  key={name}
                  className="flex flex-col gap-1 p-2 bg-slate-950/30 rounded-lg border border-white/5 relative group"
                >
                  <div className="flex justify-between items-center">
                    <span
                      className="text-xs text-slate-300 font-bold truncate"
                    >
                      {name}
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => removeSkill(name)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <NumberStepper
                    value={val}
                    onChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        skills: { ...prev.skills, [name]: v },
                      }))
                    }
                    min={0}
                    max={999}
                    size="sm"
                    disabled={readOnly}
                  />
                </div>
              ))}
            {Object.keys(form.skills || {}).length === 0 && (
              <div className="col-span-full text-center text-slate-600 text-xs py-4">
                暂无技能，请手动添加或通过 .st 导入
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Textarea
            label="背景故事"
            value={form.backstory}
            onChange={(e) => setForm({ ...form, backstory: e.target.value })}
            rows={5}
            disabled={readOnly}
          />
          <Textarea
            label="详细备注"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={5}
            disabled={readOnly}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-72">
          <ItemListEditor
            title="物品清单"
            icon={Package}
            items={form.items || []}
            onChange={(items) => setForm({ ...form, items })}
            disabled={readOnly}
          />
          <ItemListEditor
            title="法术 / 能力"
            icon={Zap}
            items={form.spells || []}
            onChange={(spells) => setForm({ ...form, spells })}
            disabled={readOnly}
          />
        </div>
      </div>
      <div className="px-6 md:px-8 py-4 md:py-6 border-t border-white/10 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        {!readOnly && isEditing && (
          <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
            {(form.type === "investigator" || form.role === "调查员") &&
            onRemove ? (
              removeConfirm ? (
                <>
                  <span className="text-xs text-red-400 font-bold animate-pulse hidden md:inline">
                    再次点击确认移出
                  </span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(form.id);
                    }}
                    variant="dangerActive"
                    icon={LogOut}
                    className="w-full md:w-auto"
                  >
                    确认移出
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemoveConfirm(false);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemoveConfirm(true);
                  }}
                  variant="danger"
                  icon={LogOut}
                  className="w-full md:w-auto"
                >
                  移出房间
                </Button>
              )
            ) : onDelete ? (
              deleteConfirm ? (
                <>
                  <span className="text-xs text-red-400 font-bold animate-pulse hidden md:inline">
                    再次点击确认删除
                  </span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(form.id);
                    }}
                    variant="dangerActive"
                    icon={AlertTriangle}
                    className="w-full md:w-auto"
                  >
                    确认销毁
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(false);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(true);
                  }}
                  variant="danger"
                  icon={Trash2}
                  className="w-full md:w-auto"
                >
                  删除档案
                </Button>
              )
            ) : null}
          </div>
        )}
        <div className="flex gap-4 w-full md:w-auto justify-end">
          {readOnly ? (
            <Button
              onClick={onClose}
              variant="secondary"
              className="w-full md:w-auto"
            >
              关闭
            </Button>
          ) : (
            <>
              <Button
                onClick={onClose}
                variant="secondary"
                className="flex-1 md:flex-none"
                disabled={isSaving}
              >
                取消
              </Button>
              <Button
                onClick={handleSave}
                variant="primary"
                icon={isSaving ? Activity : Check}
                size="lg"
                className="flex-1 md:flex-none"
                disabled={isSaving}
              >
                {isSaving ? "保存中..." : "保存档案"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};


