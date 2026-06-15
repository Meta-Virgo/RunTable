import { supabase } from "../supabase";

const publicImageBucket = "post-images";

export async function uploadRoomCoverImage(
  userId: string | null,
  imageBlob: Blob
): Promise<string> {
  if (!userId) {
    throw new Error("请先登录后再上传封面图片。");
  }

  const filePath = `${userId}/room-covers/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const { error } = await supabase.storage
    .from(publicImageBucket)
    .upload(filePath, imageBlob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(publicImageBucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}
