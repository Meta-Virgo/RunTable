import React from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "../UI";
import { SquareMarkdownEditor } from "../SquareMarkdownEditor";

interface PendingSquareImage {
  dataUrl: string;
}

interface SquareComposerProps {
  activeChannelName?: string;
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

  return (
    <div
      className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 md:p-4 mb-8 focus-within:border-indigo-500 focus-within:bg-slate-800/50 transition-colors"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="min-w-0">
        {pendingImage && (
          <div className="mb-2 relative inline-block group">
            <img
              src={pendingImage.dataUrl}
              alt="Preview"
              className="max-h-48 rounded-lg border border-white/10"
            />
            <button
              onClick={clearPendingImage}
              className="absolute -top-2 -right-2 bg-slate-900 rounded-full p-1 text-slate-400 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
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
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 relative z-20">
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
            disabled={posting || (!newPostContent.trim() && !pendingImage)}
            icon={posting ? Loader2 : Send}
          >
            {posting ? "发布中..." : "发布"}
          </Button>
        </div>
      </div>
    </div>
  );
};

