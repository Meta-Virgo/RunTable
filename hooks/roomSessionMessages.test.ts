import { describe, expect, it, vi } from "vitest";
import type { Character, Log } from "../types";
import {
  deleteRoomSessionMessage,
  fetchOlderRoomSessionLogs,
  prepareOlderRoomLogsRequest,
  sendRoomLeaveMessage,
  sendRoomSessionLog,
} from "./roomSessionMessages";

const log = (id: string, createdAt: string): Log => ({
  id,
  timestamp: "10:00",
  createdAt,
  charId: "pc",
  charName: "Keeper",
  charRole: "Keeper",
  type: "normal",
  content: id,
});

const character = (id = "char-1"): Character => ({
  id,
  name: "Lin",
  role: "Investigator",
  type: "investigator",
  job: "",
  age: "",
  sex: "",
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 50,
  pow: 50,
  edu: 50,
  luck: 50,
  hp: 10,
  san: 50,
  mp: 10,
  notes: "",
  backstory: "",
  skills: {},
});

describe("room session messages", () => {
  it("sends normal room logs through the current character context", async () => {
    const addMessage = vi.fn().mockResolvedValue({ error: null });

    await sendRoomSessionLog({
      context: {
        roomId: "room-1",
        userId: "user-1",
        activeCharId: "char-1",
      },
      type: "normal",
      content: "hello",
      recipientId: "user-2",
      meta: { quote: { id: "m-1" } },
      addMessage,
    });

    expect(addMessage).toHaveBeenCalledWith({
      roomId: "room-1",
      userId: "user-1",
      characterId: "char-1",
      type: "normal",
      content: "hello",
      recipientId: "user-2",
      meta: { quote: { id: "m-1" } },
    });
  });

  it("does not send empty or out-of-room logs", async () => {
    const addMessage = vi.fn();

    await sendRoomSessionLog({
      context: { roomId: "room-1", userId: "user-1", activeCharId: "pc" },
      type: "normal",
      content: "  ",
      addMessage,
    });
    await sendRoomSessionLog({
      context: { roomId: null, userId: "user-1", activeCharId: "pc" },
      type: "normal",
      content: "hello",
      addMessage,
    });

    expect(addMessage).not.toHaveBeenCalled();
  });

  it("sends the leave system message with the active character identity", async () => {
    const addMessage = vi.fn().mockResolvedValue({ error: null });

    await sendRoomLeaveMessage({
      context: {
        roomId: "room-1",
        userId: "user-1",
        activeCharId: "char-1",
        isKeeper: false,
        userNickname: "Yves",
        characters: [character()],
      },
      adapters: {
        getCurrentUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
        addMessage,
      },
    });

    expect(addMessage).toHaveBeenCalledWith({
      roomId: "room-1",
      userId: "user-1",
      characterId: "char-1",
      type: "system",
      content: "Yves (Lin) 离开了房间",
    });
  });

  it("returns the deleted message id after remote deletion succeeds", async () => {
    await expect(
      deleteRoomSessionMessage({
        messageId: "msg-1",
        deleteMessage: vi.fn().mockResolvedValue({ error: null }),
      })
    ).resolves.toEqual({ ok: true, deletedMessageId: "msg-1" });
  });

  it("maps delete failures into room action failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      deleteRoomSessionMessage({
        messageId: "msg-1",
        deleteMessage: vi.fn().mockResolvedValue({
          error: { message: "denied" },
        }),
      })
    ).resolves.toEqual({ ok: false, message: "撤回消息失败: denied" });

    consoleError.mockRestore();
  });

  it("prepares older log requests from the oldest createdAt", () => {
    expect(
      prepareOlderRoomLogsRequest({
        roomId: "room-1",
        logs: [
          log("new", "2026-06-08T10:05:00.000Z"),
          log("old", "2026-06-08T10:00:00.000Z"),
        ],
        isLoadingMore: false,
        hasMoreLogs: true,
        pageSize: 50,
      })
    ).toEqual({
      shouldLoad: true,
      roomId: "room-1",
      before: "2026-06-08T10:00:00.000Z",
      pageSize: 50,
    });

    expect(
      prepareOlderRoomLogsRequest({
        roomId: "room-1",
        logs: [],
        isLoadingMore: false,
        hasMoreLogs: true,
        pageSize: 50,
      })
    ).toEqual({ shouldLoad: false });
  });

  it("fetches and maps older room logs while preserving chronological order", async () => {
    const older = log("older", "2026-06-08T09:55:00.000Z");
    const oldest = log("oldest", "2026-06-08T09:50:00.000Z");
    const fetchMessagesBefore = vi
      .fn()
      .mockResolvedValue({ data: [{ id: "older" }, { id: "oldest" }] });
    const mapMessagesToLogs = vi.fn().mockResolvedValue([oldest, older]);

    await expect(
      fetchOlderRoomSessionLogs({
        request: {
          shouldLoad: true,
          roomId: "room-1",
          before: "2026-06-08T10:00:00.000Z",
          pageSize: 2,
        },
        currentUserId: "user-1",
        fetchMessagesBefore,
        mapMessagesToLogs,
      })
    ).resolves.toEqual({
      ok: true,
      logs: [oldest, older],
      hasMoreLogs: true,
    });
    expect(mapMessagesToLogs).toHaveBeenCalledWith(
      [{ id: "oldest" }, { id: "older" }],
      "user-1"
    );
  });
});
