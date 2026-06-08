import { describe, expect, it, vi } from "vitest";
import type { Character } from "../types";
import type { RoomMembership } from "../services/roomAuthority";
import {
  kickRoomMemberFromSession,
  removeRoomCharacterFromSession,
} from "./roomSessionMembers";

const character = (id: string, userId?: string): Character => ({
  id,
  user_id: userId,
  name: id,
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

const membership = (
  userId: string,
  characterId: string | null,
  role: RoomMembership["role"] = "player"
): RoomMembership => ({
  room_id: "room-1",
  user_id: userId,
  character_id: characterId,
  role,
  status: "active",
});

const baseContext = {
  roomId: "room-1",
  userId: "keeper-1",
  activeCharId: "char-1",
  characters: [character("char-1", "user-1"), character("char-2")],
  roomMembers: [membership("user-1", "char-1"), membership("user-2", null)],
};

const adapters = () => ({
  kickRoomMember: vi.fn().mockResolvedValue(undefined),
  removeCharacterFromRoom: vi.fn().mockResolvedValue({ error: null }),
  addMessage: vi.fn().mockResolvedValue(undefined),
});

describe("room session member actions", () => {
  it("kicks a user-bound character and returns the local session patch", async () => {
    const testAdapters = adapters();

    const result = await removeRoomCharacterFromSession({
      characterId: "char-1",
      context: baseContext,
      adapters: testAdapters,
    });

    expect(result).toMatchObject({
      ok: true,
      nextState: {
        characters: [character("char-2")],
        roomMembers: [membership("user-2", null)],
        activeCharId: "pc",
      },
    });
    expect(testAdapters.kickRoomMember).toHaveBeenCalledWith("room-1", "user-1");
    expect(testAdapters.removeCharacterFromRoom).not.toHaveBeenCalled();
    expect(testAdapters.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "守秘人将 [char-1] 移出了房间",
        meta: { type: "kick", userId: "user-1" },
      })
    );
  });

  it("removes an unbound room character without kicking a room member", async () => {
    const testAdapters = adapters();

    const result = await removeRoomCharacterFromSession({
      characterId: "char-2",
      context: baseContext,
      adapters: testAdapters,
    });

    expect(result).toMatchObject({
      ok: true,
      nextState: {
        characters: [character("char-1", "user-1")],
        roomMembers: baseContext.roomMembers,
        activeCharId: "char-1",
      },
    });
    expect(testAdapters.removeCharacterFromRoom).toHaveBeenCalledWith("char-2");
    expect(testAdapters.kickRoomMember).not.toHaveBeenCalled();
    expect(testAdapters.addMessage).not.toHaveBeenCalled();
  });

  it("kicks an active player membership and removes its character locally", async () => {
    const testAdapters = adapters();

    const result = await kickRoomMemberFromSession({
      memberUserId: "user-1",
      context: baseContext,
      adapters: testAdapters,
    });

    expect(result).toMatchObject({
      ok: true,
      nextState: {
        characters: [character("char-2")],
        roomMembers: [membership("user-2", null)],
        activeCharId: "pc",
      },
    });
    expect(testAdapters.kickRoomMember).toHaveBeenCalledWith("room-1", "user-1");
    expect(testAdapters.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "守秘人将 [char-1] 移出了房间",
      })
    );
  });

  it("does not kick keeper memberships", async () => {
    const testAdapters = adapters();

    const result = await kickRoomMemberFromSession({
      memberUserId: "keeper-1",
      context: {
        ...baseContext,
        roomMembers: [membership("keeper-1", null, "keeper")],
      },
      adapters: testAdapters,
    });

    expect(result).toEqual({ ok: false });
    expect(testAdapters.kickRoomMember).not.toHaveBeenCalled();
  });

  it("returns a failure result when the remote kick fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const testAdapters = {
      ...adapters(),
      kickRoomMember: vi.fn().mockRejectedValue(new Error("denied")),
    };

    const result = await kickRoomMemberFromSession({
      memberUserId: "user-1",
      context: baseContext,
      adapters: testAdapters,
    });

    expect(result).toEqual({ ok: false, message: "移出失败: denied" });
    expect(testAdapters.addMessage).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
