import React from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { uploadRoomCoverImage } from "../services/imageUploads";
import { ImageCropDialog } from "./ImageCropDialog";
import { cn } from "./UI";

interface CoverImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  currentUserId: string | null;
  disabled?: boolean;
  className?: string;
}

function getClipboardImageFile(event: React.ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData.items || []);
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }

  const files = Array.from(event.clipboardData.files || []);
  return files.find((file) => file.type.startsWith("image/")) || null;
}

export const CoverImageUpload: React.FC<CoverImageUploadProps> = ({
  value,
  onChange,
  currentUserId,
  disabled = false,
  className,
}) => {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const releaseImageSrc = React.useCallback((src: string | null) => {
    if (src?.startsWith("blob:")) {
      URL.revokeObjectURL(src);
    }
  }, []);

  React.useEffect(() => {
    return () => releaseImageSrc(imageSrc);
  }, [imageSrc, releaseImageSrc]);

  const startCrop = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    releaseImageSrc(imageSrc);
    setSourceDialogOpen(false);
    setImageSrc(URL.createObjectURL(file));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      startCrop(file);
    }
    event.target.value = "";
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const file = getClipboardImageFile(event);
    if (!file) return;

    event.preventDefault();
    startCrop(file);
  };

  const closeCropDialog = () => {
    releaseImageSrc(imageSrc);
    setImageSrc(null);
  };

  const handleUpload = async (blob: Blob) => {
    try {
      setUploading(true);
      const publicUrl = await uploadRoomCoverImage(currentUserId, blob);
      onChange(publicUrl);
      closeCropDialog();
    } catch (error: any) {
      alert(error.message || "封面上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <label className="mb-1.5 ml-1 text-xs font-medium text-dicecho-muted">
        封面 URL（可选）
      </label>

      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          disabled={disabled || uploading}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com/cover.jpg"
          className="min-w-0 flex-1 rounded-lg border border-dicecho-border/50 bg-dicecho-panel/70 px-4 py-2.5 text-sm text-slate-100 shadow-sm transition-colors duration-150 placeholder:text-slate-400/60 focus:border-dicecho-primary/70 focus:outline-none disabled:opacity-30"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled || uploading}
            title="清除封面"
            aria-label="清除封面"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dicecho-border/50 bg-dicecho-panel/70 text-dicecho-muted transition-colors hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setSourceDialogOpen(true)}
          disabled={disabled || uploading}
          title="添加封面图片"
          aria-label="添加封面图片"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dicecho-border/50 bg-dicecho-panel/70 text-dicecho-muted transition-colors hover:border-dicecho-primary/60 hover:text-white disabled:opacity-40"
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ImagePlus size={16} />
          )}
        </button>
      </div>

      {value && (
        <div className="mt-3 w-40 overflow-hidden rounded-lg border border-dicecho-border/45 bg-dicecho-card/60 sm:w-48">
          <img
            src={value}
            alt="房间封面预览"
            className="aspect-[3/4] w-full object-cover"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />

      {sourceDialogOpen && (
        <CoverImageSourceDialog
          onClose={() => setSourceDialogOpen(false)}
          onPaste={handlePaste}
          onSelectLocal={() => inputRef.current?.click()}
          onDropFile={startCrop}
        />
      )}

      {imageSrc && (
        <ImageCropDialog
          imageSrc={imageSrc}
          title="裁切封面"
          aspect={3 / 4}
          outputWidth={900}
          outputHeight={1200}
          processing={uploading}
          confirmLabel="上传"
          onCancel={closeCropDialog}
          onConfirm={handleUpload}
        />
      )}
    </div>
  );
};

const CoverImageSourceDialog: React.FC<{
  onClose: () => void;
  onPaste: (event: React.ClipboardEvent) => void;
  onSelectLocal: () => void;
  onDropFile: (file: File) => void;
}> = ({
  onClose,
  onPaste,
  onSelectLocal,
  onDropFile,
}) => {
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    const file = Array.from(event.dataTransfer.files).find((candidate) =>
      candidate.type.startsWith("image/")
    );
    if (file) {
      onDropFile(file);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onPaste={onPaste}
    >
      <button
        type="button"
        aria-label="关闭封面图片来源"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-dicecho-border/55 bg-dicecho-panel shadow-lg shadow-black/25">
        <button
          type="button"
          aria-label="关闭封面图片来源"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-dicecho-muted transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <div
          className="flex min-h-[300px] flex-col items-center justify-center px-8 py-10 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <UploadCloud
            size={78}
            strokeWidth={1.5}
            className="mb-5 text-dicecho-primary/35"
          />
          <p className="text-sm text-dicecho-muted">
            点击上传或将图片拖拽到此区域
          </p>
          <button
            type="button"
            onClick={onSelectLocal}
            className="mt-6 flex h-12 w-full max-w-[304px] items-center justify-center rounded-md bg-dicecho-primary-strong px-4 text-sm font-semibold text-white transition-colors hover:bg-dicecho-primary active:bg-dicecho-primary-strong"
          >
            上传图片
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
