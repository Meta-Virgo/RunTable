import { describe, expect, it, vi } from "vitest";
import { buildRoomStory, fetchAllRoomStoryMessages } from "./roomSessionStory";

describe("room session story", () => {
  it("stops fetching room story messages when the last page is short", async () => {
    const fetchMessagesPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "1" }, { id: "2" }] })
      .mockResolvedValueOnce({ data: [{ id: "3" }] });

    const messages = await fetchAllRoomStoryMessages({
      roomId: "room-1",
      batchSize: 2,
      fetchMessagesPage,
    });

    expect(messages).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(fetchMessagesPage).toHaveBeenCalledTimes(2);
    expect(fetchMessagesPage).toHaveBeenNthCalledWith(1, "room-1", 0, 2);
    expect(fetchMessagesPage).toHaveBeenNthCalledWith(2, "room-1", 1, 2);
  });

  it("builds a story report from all fetched messages", async () => {
    const fetchMessagesPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "1" }] });
    const mapMessagesToLogs = vi.fn().mockResolvedValueOnce([
      {
        id: "log-1",
        timestamp: "12:00",
        createdAt: "2026-06-08T12:00:00.000Z",
        charId: "pc",
        charName: "Keeper",
        charRole: "Keeper",
        type: "normal",
        content: "door opens",
      },
    ]);
    const buildStoryReport = vi.fn().mockReturnValue("story text");

    await expect(
      buildRoomStory({
        roomId: "room-1",
        currentUserId: "user-1",
        fetchMessagesPage,
        mapMessagesToLogs,
        buildStoryReport,
      })
    ).resolves.toEqual({ ok: true, story: "story text" });
    expect(mapMessagesToLogs).toHaveBeenCalledWith([{ id: "1" }], "user-1");
  });

  it("returns a room story failure when fetching messages fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const result = await buildRoomStory({
      roomId: "room-1",
      fetchMessagesPage: vi.fn().mockResolvedValueOnce({
        data: null,
        error: new Error("network"),
      }),
      mapMessagesToLogs: vi.fn(),
      buildStoryReport: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      message: "生成战报失败，请重试。",
    });
    consoleError.mockRestore();
  });

  it("does not fetch messages when there is no active room", async () => {
    const fetchMessagesPage = vi.fn();

    await expect(
      buildRoomStory({
        roomId: null,
        fetchMessagesPage,
        mapMessagesToLogs: vi.fn(),
        buildStoryReport: vi.fn(),
      })
    ).resolves.toEqual({ ok: false });
    expect(fetchMessagesPage).not.toHaveBeenCalled();
  });
});
