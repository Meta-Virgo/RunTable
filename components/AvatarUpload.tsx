import React, { useState } from "react";
import { supabase } from "../supabase";
import { User, Loader2, Camera } from "lucide-react";
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
  size = 96, // 24 * 4 = 96px (w-24)
  editable = true,
  className,
}) => {
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        // User cancelled or no file selected
        setUploading(false);
        return;
      }

      const file = event.target.files[0];

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image size must be less than 5MB.");
      }

      const fileExt = file.name.split(".").pop() || "png"; // Default to png if no extension
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      onUpload(data.publicUrl);
    } catch (error: any) {
      alert("Error uploading avatar: " + error.message);
    } finally {
      setUploading(false);
      // Reset input value to allow selecting the same file again if needed
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const Container = editable ? "label" : "div";

  return (
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
          <img src={url} alt="Avatar" className="w-full h-full object-cover" />
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
          onChange={uploadAvatar}
          disabled={uploading}
          className="hidden"
        />
      )}
    </Container>
  );
};
