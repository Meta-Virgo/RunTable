import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { Modal, Input, Textarea, Button } from "../UI";
import { ModuleInfo } from "../../types";

export const ModuleModal: React.FC<{
  info: ModuleInfo;
  password?: string;
  onSave: (info: ModuleInfo, password?: string) => Promise<void>;
  onClose: () => void;
}> = ({ info, password, onSave, onClose }) => {
  const [localInfo, setLocalInfo] = useState(info);
  const [localPassword, setLocalPassword] = useState(password || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!localInfo.title.trim()) return;
    setLoading(true);
    await onSave(localInfo, localPassword);
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title="编辑房间信息"
      icon={BookOpen}
      className="max-w-2xl"
    >
      <div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
        <Input
          label="房间标题"
          value={localInfo.title}
          onChange={(e) =>
            setLocalInfo({ ...localInfo, title: e.target.value })
          }
          placeholder="例如：无尽食欲..."
        />
        <Input
          label="房间密码 (留空公开)"
          value={localPassword}
          onChange={(e) => setLocalPassword(e.target.value)}
          type="password"
          placeholder="留空则为公开房间"
        />
        <Textarea
          label="背景故事 / 守秘人笔记"
          value={localInfo.description}
          onChange={(e) =>
            setLocalInfo({ ...localInfo, description: e.target.value })
          }
          rows={10}
          placeholder="剧情大纲..."
        />
      </div>
      <div className="px-6 md:px-8 py-4 md:py-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
        <Button onClick={onClose} variant="ghost">
          取消
        </Button>
        <Button
          onClick={handleSave}
          variant="primary"
          size="lg"
          disabled={loading}
        >
          {loading ? "保存中..." : "保存修改"}
        </Button>
      </div>
    </Modal>
  );
};
