import {
  buildRoomActionFailureMessage,
  buildRoomActionFailureResult,
  shouldWarnMissingMusicSyncSchema,
  type RoomSessionActionResult,
} from "./roomSessionModel";

type RemoteResult = Promise<{ error?: { message?: string; code?: string } | null }>;

function isMissingCoverImageColumnError(error: unknown) {
  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const text = [
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    maybeError?.code === "42703" ||
    maybeError?.code === "PGRST204" ||
    text.includes("cover_image_url")
  );
}

export async function deleteRoomSession(input: {
  roomId: string | null;
  deleteRoom: (roomId: string) => RemoteResult;
}): Promise<RoomSessionActionResult> {
  if (!input.roomId) return { ok: false };

  const { error } = await input.deleteRoom(input.roomId);
  if (error) {
    console.error("Failed to delete room:", error);
    return buildRoomActionFailureResult("删除房间失败", error);
  }

  return { ok: true };
}

export async function clearRoomSessionChat(input: {
  roomId: string | null;
  deleteRoomMessages: (roomId: string) => RemoteResult;
}): Promise<RoomSessionActionResult> {
  if (!input.roomId) return { ok: false };

  const { error } = await input.deleteRoomMessages(input.roomId);
  if (error) {
    console.error("清空聊天记录失败:", error);
    return buildRoomActionFailureResult("清空聊天记录失败", error);
  }

  return { ok: true };
}

export async function concludeRoomSession(input: {
  roomId: string | null;
  isKeeper: boolean;
  outcomes: Record<string, string>;
  concludeRoom: (roomId: string, outcomes: Record<string, string>) => RemoteResult;
}): Promise<RoomSessionActionResult> {
  if (!input.roomId || !input.isKeeper) return { ok: false };

  const { error } = await input.concludeRoom(input.roomId, input.outcomes);
  if (error) {
    console.error("Error concluding game:", error);
    return buildRoomActionFailureResult("结团失败", error);
  }

  return { ok: true };
}

export async function updateRoomSessionModuleSettings(input: {
  roomId: string | null;
  isKeeper: boolean;
  info: {
    title: string;
    description: string | null;
    coverImageUrl?: string | null;
  };
  password?: string;
  updateRoomModule: (
    roomId: string,
    updates: Record<string, any>
  ) => RemoteResult;
  setRoomPassword: (roomId: string, password: string) => Promise<void>;
}): Promise<RoomSessionActionResult> {
  if (!input.roomId || !input.isKeeper) return { ok: false };

  const roomUpdates = {
    title: input.info.title,
    description: input.info.description,
    cover_image_url: input.info.coverImageUrl || null,
  };
  let coverWarning: string | undefined;
  let { error } = await input.updateRoomModule(input.roomId, roomUpdates);

  if (error && isMissingCoverImageColumnError(error)) {
    const fallbackResult = await input.updateRoomModule(input.roomId, {
      title: roomUpdates.title,
      description: roomUpdates.description,
    });

    error = fallbackResult.error || null;
    if (!error) {
      coverWarning =
        "房间基础信息已保存，但数据库还没有 cover_image_url 字段，封面暂时无法保存。";
    }
  }

  if (error) {
    console.error("Failed to update room module:", error);
    return buildRoomActionFailureResult("淇濆瓨澶辫触", error);
  }

  if (input.password !== undefined) {
    try {
      await input.setRoomPassword(input.roomId, input.password);
    } catch (error: any) {
      console.error("Failed to update room password:", error);
      return buildRoomActionFailureResult("Password save failed", error);
    }
  }

  return { ok: true, message: coverWarning };
}

export async function updateRoomSessionMusicUrl(input: {
  roomId: string | null;
  isKeeper: boolean;
  url: string;
  updateRoomMusicUrl: (roomId: string, url: string) => RemoteResult;
}): Promise<RoomSessionActionResult> {
  if (!input.roomId || !input.isKeeper) return { ok: false };

  const { error } = await input.updateRoomMusicUrl(input.roomId, input.url);
  if (error) {
    console.error("Failed to update background music:", error);
    return {
      ok: false,
      message: buildRoomActionFailureMessage("更新背景音乐失败", error),
    };
  }

  return { ok: true };
}

export async function updateRoomSessionMusicState(input: {
  roomId: string | null;
  isKeeper: boolean;
  isPlaying: boolean;
  trackIndex: number;
  updateRoomMusicState: (
    roomId: string,
    isPlaying: boolean,
    trackIndex: number
  ) => RemoteResult;
}): Promise<RoomSessionActionResult & { missingMusicSyncSchema?: boolean }> {
  if (!input.roomId || !input.isKeeper) return { ok: false };

  const { error } = await input.updateRoomMusicState(
    input.roomId,
    input.isPlaying,
    input.trackIndex
  );

  if (error) {
    console.error("Failed to update music state:", error);

    if (shouldWarnMissingMusicSyncSchema(error)) {
      console.warn(
        "PGRST204 Error: The 'is_music_playing' column is missing in Supabase schema cache. Please reload the schema cache in Supabase Dashboard."
      );
      return { ok: false, missingMusicSyncSchema: true };
    }

    return buildRoomActionFailureResult("更新背景音乐状态失败", error);
  }

  return { ok: true };
}
