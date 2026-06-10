import { describe, expect, it, vi } from "vitest";
import {
  clearRoomSessionChat,
  concludeRoomSession,
  deleteRoomSession,
  updateRoomSessionModuleSettings,
  updateRoomSessionMusicState,
  updateRoomSessionMusicUrl,
} from "./roomSessionActions";

describe("room session actions", () => {
  it("deletes an active room session", async () => {
    const deleteRoom = vi.fn().mockResolvedValue({ error: null });

    await expect(
      deleteRoomSession({ roomId: "room-1", deleteRoom })
    ).resolves.toEqual({ ok: true });
    expect(deleteRoom).toHaveBeenCalledWith("room-1");
  });

  it("returns a failure result when deleting a room fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      deleteRoomSession({
        roomId: "room-1",
        deleteRoom: vi.fn().mockResolvedValue({
          error: { message: "denied" },
        }),
      })
    ).resolves.toEqual({ ok: false, message: "删除房间失败: denied" });
    consoleError.mockRestore();
  });

  it("clears room chat messages", async () => {
    const deleteRoomMessages = vi.fn().mockResolvedValue({ error: null });

    await expect(
      clearRoomSessionChat({ roomId: "room-1", deleteRoomMessages })
    ).resolves.toEqual({ ok: true });
    expect(deleteRoomMessages).toHaveBeenCalledWith("room-1");
  });

  it("concludes a room only when the user is keeper", async () => {
    const concludeRoom = vi.fn().mockResolvedValue({ error: null });

    await expect(
      concludeRoomSession({
        roomId: "room-1",
        isKeeper: false,
        outcomes: {},
        concludeRoom,
      })
    ).resolves.toEqual({ ok: false });
    expect(concludeRoom).not.toHaveBeenCalled();

    await expect(
      concludeRoomSession({
        roomId: "room-1",
        isKeeper: true,
        outcomes: { char: "存活" },
        concludeRoom,
      })
    ).resolves.toEqual({ ok: true });
    expect(concludeRoom).toHaveBeenCalledWith("room-1", { char: "存活" });
  });

  it("updates room music url only for keeper sessions", async () => {
    const updateRoomMusicUrl = vi.fn().mockResolvedValue({ error: null });

    await expect(
      updateRoomSessionMusicUrl({
        roomId: "room-1",
        isKeeper: false,
        url: "song:1",
        updateRoomMusicUrl,
      })
    ).resolves.toEqual({ ok: false });
    expect(updateRoomMusicUrl).not.toHaveBeenCalled();

    await expect(
      updateRoomSessionMusicUrl({
        roomId: "room-1",
        isKeeper: true,
        url: "song:1",
        updateRoomMusicUrl,
      })
    ).resolves.toEqual({ ok: true });
    expect(updateRoomMusicUrl).toHaveBeenCalledWith("room-1", "song:1");
  });

  it("updates room module settings and optional password only for keeper sessions", async () => {
    const updateRoomModule = vi.fn().mockResolvedValue({ error: null });
    const setRoomPassword = vi.fn().mockResolvedValue(undefined);

    await expect(
      updateRoomSessionModuleSettings({
        roomId: "room-1",
        isKeeper: false,
        info: { title: "Room", description: "desc", coverImageUrl: "https://img.test/cover.jpg" },
        password: "pw",
        updateRoomModule,
        setRoomPassword,
      })
    ).resolves.toEqual({ ok: false });
    expect(updateRoomModule).not.toHaveBeenCalled();
    expect(setRoomPassword).not.toHaveBeenCalled();

    await expect(
      updateRoomSessionModuleSettings({
        roomId: "room-1",
        isKeeper: true,
        info: { title: "Room", description: "desc", coverImageUrl: "https://img.test/cover.jpg" },
        password: "pw",
        updateRoomModule,
        setRoomPassword,
      })
    ).resolves.toEqual({ ok: true });
    expect(updateRoomModule).toHaveBeenCalledWith("room-1", {
      title: "Room",
      description: "desc",
      cover_image_url: "https://img.test/cover.jpg",
    });
    expect(setRoomPassword).toHaveBeenCalledWith("room-1", "pw");
  });

  it("does not update the room password when module settings fail", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const setRoomPassword = vi.fn().mockResolvedValue(undefined);

    await expect(
      updateRoomSessionModuleSettings({
        roomId: "room-1",
        isKeeper: true,
        info: { title: "Room", description: "desc" },
        password: "pw",
        updateRoomModule: vi.fn().mockResolvedValue({
          error: { message: "denied" },
        }),
        setRoomPassword,
      })
    ).resolves.toEqual({ ok: false, message: "淇濆瓨澶辫触: denied" });
    expect(setRoomPassword).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("falls back when the room cover image column is missing", async () => {
    const updateRoomModule = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          code: "PGRST204",
          message:
            "Could not find the 'cover_image_url' column of 'rooms' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });
    const setRoomPassword = vi.fn().mockResolvedValue(undefined);

    await expect(
      updateRoomSessionModuleSettings({
        roomId: "room-1",
        isKeeper: true,
        info: {
          title: "Room",
          description: "desc",
          coverImageUrl: "https://img.test/cover.jpg",
        },
        password: "pw",
        updateRoomModule,
        setRoomPassword,
      })
    ).resolves.toMatchObject({
      ok: true,
      message: expect.stringContaining("cover_image_url"),
    });

    expect(updateRoomModule).toHaveBeenNthCalledWith(1, "room-1", {
      title: "Room",
      description: "desc",
      cover_image_url: "https://img.test/cover.jpg",
    });
    expect(updateRoomModule).toHaveBeenNthCalledWith(2, "room-1", {
      title: "Room",
      description: "desc",
    });
    expect(setRoomPassword).toHaveBeenCalledWith("room-1", "pw");
  });

  it("marks missing music sync schema warnings separately from other failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await expect(
      updateRoomSessionMusicState({
        roomId: "room-1",
        isKeeper: true,
        isPlaying: true,
        trackIndex: 2,
        updateRoomMusicState: vi.fn().mockResolvedValue({
          error: { code: "PGRST204", message: "missing column" },
        }),
      })
    ).resolves.toEqual({ ok: false, missingMusicSyncSchema: true });

    await expect(
      updateRoomSessionMusicState({
        roomId: "room-1",
        isKeeper: true,
        isPlaying: true,
        trackIndex: 2,
        updateRoomMusicState: vi.fn().mockResolvedValue({
          error: { code: "42501", message: "denied" },
        }),
      })
    ).resolves.toEqual({
      ok: false,
      message: "更新背景音乐状态失败: denied",
    });

    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });
});
