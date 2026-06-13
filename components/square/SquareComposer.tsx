import React from "react";
import { Badge, Loader2, Plus, Send, X } from "lucide-react";
import type { Character, CreateSquarePostModuleInput } from "../../types";
import { Button } from "../UI";
import { SquareMarkdownEditor } from "../SquareMarkdownEditor";
import { SquarePostModules } from "./SquarePostModules";

interface PendingSquareImage {
  dataUrl: string;
}

interface SquareComposerProps {
  activeChannelName?: string;
  shareableCharacters?: Character[];
  pendingModules: CreateSquarePostModuleInput[];
  addCharacterModule: (character: Character) => void;
  removeModule: (index: number) => void;
  newPostContent: string;
  setNewPostContent: (content: string) => void;
  posting: boolean;
  pendingImage: PendingSquareImage | null;
  clearPendingImage: () => void;
  processFile: (file: File) => void;
  handlePaste: (event: React.ClipboardEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  handlePost: () => void;
}

export const SquareComposer: React.FC<SquareComposerProps> = ({
  activeChannelName,
  shareableCharacters = [],
  pendingModules,
  addCharacterModule,
  removeModule,
  newPostContent,
  setNewPostContent,
  posting,
  pendingImage,
  clearPendingImage,
  processFile,
  handlePaste,
  handleDrop,
  handlePost,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedCharacterId, setSelectedCharacterId] = React.useState("");
  const selectedCharacter = shareableCharacters.find(
    (character) => character.id === selectedCharacterId
  );

  return (
    <div
      className="bg-dicecho-card/80 border border-dicecho-border/40 rounded-lg p-3 md:p-4 mb-8 focus-within:border-dicecho-primary/60 transition-colors duration-150 dicecho-card-shadow"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="min-w-0">
        {pendingImage && (
          <div className="mb-2 relative inline-block group">
            <img
              src={pendingImage.dataUrl}
              alt="Preview"
              className="max-h-48 rounded-lg border border-dicecho-border/40"
            />
            <button
              onClick={clearPendingImage}
              className="absolute -top-2 -right-2 bg-dicecho-panel rounded-full p-1 text-dicecho-muted hover:text-white border border-dicecho-border/40 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <SquareMarkdownEditor
          placeholder={`在 #${activeChannelName || "..."} 发起讨论...`}
          value={newPostContent}
          onChange={setNewPostContent}
          onPaste={handlePaste}
          showModeSwitch={false}
          renderedEditing
          textareaClassName="min-h-[80px]"
          previewVariant="preview"
        />
        <div className="mt-3 rounded-lg border border-dicecho-border/35 bg-dicecho-panel/45 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Badge size={14} className="text-dicecho-primary" />
              分享模块
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <select
                value={selectedCharacterId}
                onChange={(event) => setSelectedCharacterId(event.target.value)}
                className="min-w-0 max-w-[220px] rounded-md border border-dicecho-border/50 bg-dicecho-card/80 px-2 py-1.5 text-xs text-slate-100 focus:border-dicecho-primary/70 focus:outline-none"
              >
                <option value="">选择车卡</option>
                {shareableCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
              <Button
                size="xs"
                variant="secondary"
                icon={Plus}
                disabled={!selectedCharacter}
                onClick={() => {
                  if (!selectedCharacter) return;
                  addCharacterModule(selectedCharacter);
                  setSelectedCharacterId("");
                }}
              >
                添加车卡
              </Button>
            </div>
          </div>
          {pendingModules.length > 0 ? (
            <div className="space-y-2">
              {pendingModules.map((module, index) => (
                <div key={`${module.module_type}-${index}`} className="relative">
                  <SquarePostModules modules={[module]} compact />
                  <button
                    type="button"
                    onClick={() => removeModule(index)}
                    className="absolute right-2 top-2 rounded-full border border-dicecho-border/40 bg-dicecho-panel p-1 text-dicecho-muted hover:text-white"
                    aria-label="移除分享模块"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-dicecho-muted">
              可附加自己的公开车卡摘要。备注、背景、物品和法术不会被发布。
            </p>
          )}
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-dicecho-border/30 relative z-20">
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(event) => {
                if (event.target.files?.[0]) {
                  processFile(event.target.files[0]);
                }
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handlePost}
            disabled={
              posting ||
              (!newPostContent.trim() && !pendingImage && pendingModules.length === 0)
            }
            icon={posting ? Loader2 : Send}
          >
            {posting ? "发布中..." : "发布"}
          </Button>
        </div>
      </div>
    </div>
  );
};
