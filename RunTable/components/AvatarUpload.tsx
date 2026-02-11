import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabase";
import { User, Loader2, Camera } from "lucide-react";
import { cn } from "./UI";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/cropImage";

interface AvatarUploadProps {
  url?: string | null;
  onUpload: (url: string) => void;
  size?: number;
  editable?: boolean;
  className?: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  url,
  onUpload,
  size = 96, // 24 * 4 = 96px (w-24)
  editable = true,
  className,
}) => {
  const [uploading, setUploading] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];

      // Clean up previous object URL if it exists
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }

      const url = URL.createObjectURL(file);
      setImageSrc(url);
      
      // Reset input value to allow selecting the same file again if needed
      event.target.value = "";
    }
  };

  // Clean up object URL when component unmounts or imageSrc changes
  React.useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setUploading(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error("Could not crop image");
      if (croppedBlob.size === 0) throw new Error("Cropped image is empty");

      const fileExt = "jpg";
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      onUpload(data.publicUrl);
      setImageSrc(null); // Close modal
    } catch (error: any) {
      alert("Error uploading avatar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setImageSrc(null);
    setUploading(false);
  };

  const Container = editable ? "label" : "div";

  return (
    <>
      <Container
        className={cn(
          "relative group block",
          className,
          editable && "cursor-pointer"
        )}
        style={{ width: size, height: size }}
      >
        <div
          className={cn(
            "rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative w-full h-full",
            editable && "hover:border-indigo-500 transition-colors"
          )}
        >
          {url ? (
            <img
              src={url}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={size * 0.5} className="text-slate-500" />
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-white" />
            </div>
          )}

          {editable && !uploading && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
              <Camera className="text-white opacity-80" size={size * 0.3} />
            </div>
          )}
        </div>

        {editable && (
          <input
            type="file"
            accept="image/*"
            onChange={onSelectFile}
            disabled={uploading}
            className="hidden"
          />
        )}
      </Container>

      {imageSrc &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[500px]">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-lg font-semibold text-white">裁切头像</h3>
              </div>

              <div className="relative flex-1 bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-4">
                <div className="flex-1">
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : (
                      "保存"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
