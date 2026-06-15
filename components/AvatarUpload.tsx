import React, { useState } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { supabase } from "../supabase";
import { ImageCropDialog } from "./ImageCropDialog";
import { cn } from "./UI";

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
  size = 96,
  editable = true,
  className,
}) => {
  const [uploading, setUploading] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const releaseImageSrc = React.useCallback((src: string | null) => {
    if (src?.startsWith("blob:")) {
      URL.revokeObjectURL(src);
    }
  }, []);

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    releaseImageSrc(imageSrc);
    setImageSrc(URL.createObjectURL(file));
    event.target.value = "";
  };

  React.useEffect(() => {
    return () => releaseImageSrc(imageSrc);
  }, [imageSrc, releaseImageSrc]);

  const closeDialog = () => {
    releaseImageSrc(imageSrc);
    setImageSrc(null);
  };

  const handleUpload = async (croppedBlob: Blob) => {
    try {
      setUploading(true);

      const fileName = `${Math.random().toString(36).substring(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, croppedBlob, {
          contentType: "image/jpeg",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

      onUpload(data.publicUrl);
      closeDialog();
    } catch (error: any) {
      alert("Error uploading avatar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const Container = editable ? "label" : "div";

  return (
    <>
      <Container
        className={cn(
          "group relative block",
          className,
          editable && "cursor-pointer"
        )}
        style={{ width: size, height: size }}
      >
        <div
          className={cn(
            "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dicecho-border/55 bg-dicecho-card",
            editable && "transition-colors hover:border-dicecho-primary/70"
          )}
        >
          {url ? (
            <img src={url} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <User size={size * 0.5} className="text-dicecho-muted" />
          )}

          {uploading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
              <Loader2 className="animate-spin text-white" />
            </div>
          )}

          {editable && !uploading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
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

      {imageSrc && (
        <ImageCropDialog
          imageSrc={imageSrc}
          title="裁切头像"
          aspect={1}
          outputWidth={400}
          outputHeight={400}
          processing={uploading}
          onCancel={closeDialog}
          onConfirm={handleUpload}
        />
      )}
    </>
  );
};
