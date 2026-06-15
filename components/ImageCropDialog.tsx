import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Loader2 } from "lucide-react";
import getCroppedImg from "../utils/cropImage";
import { cn } from "./UI";

interface ImageCropDialogProps {
  imageSrc: string;
  title: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  processing?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}

export const ImageCropDialog: React.FC<ImageCropDialogProps> = ({
  imageSrc,
  title,
  aspect,
  outputWidth,
  outputHeight,
  processing = false,
  confirmLabel = "保存",
  onCancel,
  onConfirm,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [imageSrc]);

  const onCropComplete = useCallback(
    (
      _croppedArea: unknown,
      croppedPixels: { x: number; y: number; width: number; height: number }
    ) => {
      setCroppedAreaPixels(croppedPixels);
    },
    []
  );

  const handleConfirm = async () => {
    if (!croppedAreaPixels || processing) return;

    try {
      const blob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        0,
        { horizontal: false, vertical: false },
        {
          outputWidth,
          outputHeight,
          mimeType: "image/jpeg",
          quality: 0.88,
        }
      );

      if (!blob || blob.size === 0) {
        throw new Error("Cropped image is empty");
      }

      await onConfirm(blob);
    } catch (error: any) {
      alert(error.message || "图片处理失败");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex h-[520px] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-dicecho-border/55 bg-dicecho-panel shadow-lg shadow-black/25">
        <div className="border-b border-dicecho-border/45 bg-dicecho-card/55 p-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="flex items-center gap-4 border-t border-dicecho-border/45 bg-dicecho-card/55 p-4">
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-label="缩放"
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-dicecho-raised accent-dicecho-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="rounded-lg px-4 py-2 text-sm font-medium text-dicecho-muted transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={processing || !croppedAreaPixels}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-dicecho-primary-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dicecho-primary",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
