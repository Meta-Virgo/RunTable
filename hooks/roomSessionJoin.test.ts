import { describe, expect, it, vi } from "vitest";
import type { Character } from "../types";
import type { RoomMembership } from "../services/roomAuthority";
import { joinRoomSessionAction } from "./roomSessionJoin";

const room = {
  id: "room-1",
  kp_id: "keeper-1",
  title: "Room",
  description: null,
  type: "text" as const,
  bg_music_url: null,
};

const character = (id: string): Character => ({
  id,
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
  status: RoomMembership["status"] = "active"
): RoomMembership => ({
  room_id: "room-1",
  user_id: "user-1",
  character_id: "char-1",
  role: "player",
  status,
});

const adapters = () => ({
  fetchRoomById: vi.fn().mockResolvedValue({ data: room }),
  getCurrentUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
  fetchCurrentRoomMembership: vi.fn().mockResolvedValue({ data: null }),
  joinRoom: vi.fn().mockResolvedValue({ data: membership() }),
  fetchRoomCharacters: vi.fn().mockResolvedValue({ data: [{ id: "char-1" }] }),
  fetchRoomMembers: vi.fn().mockResolvedValue({ data: [membership()] }),
  mapCharacterRow: vi.fn().mockReturnValue(character("char-1")),
  fetchProfileNickname: vi.fn().mockResolvedValue("Yves"),
  addRoomSystemMessage: vi.fn().mockResolvedValue({ error: null }),
});

describe("room session join action", () => {
  it("joins a room and returns the session state needed by the hook", async () => {
    const testAdapters = adapters();

    const result = await joinRoomSessionAction({
      input: { roomId: "room-1", charId: "char-1", password: "pw" },
      adapters: testAdapters,
      isCurrent: () => true,
    });

    expect(result).toMatchObject({
      ok: true,
      room,
      authority: {
        activeCharacterId: "char-1",
        isKP: false,
        role: "player",
        membershipStatus: "active",
      },
      characters: [character("char-1")],
      roomMembers: [membership()],
    });
    expect(testAdapters.joinRoom).toHaveBeenCalledWith({
      roomId: "room-1",
      characterId: "char-1",
      password: "pw",
    });
    expect(testAdapters.addRoomSystemMessage).toHaveBeenCalledWith(
      "room-1",
      "user-1",
      "Yves (char-1) 进入了房间",
      "char-1"
    );
  });

  it("blocks a kicked membership before calling join", async () => {
    const testAdapters = {
      ...adapters(),
      fetchCurrentRoomMembership: vi
        .fn()
        .mockResolvedValue({ data: membership("kicked") }),
    };

    const result = await joinRoomSessionAction({
      input: { roomId: "room-1", charId: "char-1" },
      adapters: testAdapters,
      isCurrent: () => true,
    });

    expect(result).toEqual({
      ok: false,
      message: "你已被移出该房间，无法重新加入。",
    });
    expect(testAdapters.joinRoom).not.toHaveBeenCalled();
  });

  it("maps join failures through room join feedback", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const testAdapters = {
      ...adapters(),
      joinRoom: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Invalid room password" },
      }),
    };

    const result = await joinRoomSessionAction({
      input: { roomId: "room-1", charId: "char-1" },
      adapters: testAdapters,
      isCurrent: () => true,
    });

    expect(result).toEqual({
      ok: false,
      message: "房间密码不正确，请检查后重试。",
    });
    consoleError.mockRestore();
  });

  it("cancels a stale join without loading characters or sending enter messages", async () => {
    const testAdapters = adapters();
    let checks = 0;

    const result = await joinRoomSessionAction({
      input: { roomId: "room-1", charId: "char-1" },
      adapters: testAdapters,
      isCurrent: () => {
        checks += 1;
        return checks < 4;
      },
    });

    expect(result).toEqual({ ok: false, cancelled: true });
    expect(testAdapters.fetchRoomCharacters).not.toHaveBeenCalled();
    expect(testAdapters.addRoomSystemMessage).not.toHaveBeenCalled();
  });

  it("skips enter messages while restoring a room from url", async () => {
    const testAdapters = adapters();

    await expect(
      joinRoomSessionAction({
        input: { roomId: "room-1", charId: "char-1", isRestoring: true },
        adapters: testAdapters,
        isCurrent: () => true,
      })
    ).resolves.toMatchObject({ ok: true });
    expect(testAdapters.addRoomSystemMessage).not.toHaveBeenCalled();
  });

  it("cancels a stale join after sending the enter message before returning session state", async () => {
    const testAdapters = adapters();
    let checks = 0;

    const result = await joinRoomSessionAction({
      input: { roomId: "room-1", charId: "char-1" },
      adapters: testAdapters,
      isCurrent: () => {
        checks += 1;
        return checks < 7;
      },
    });

    expect(testAdapters.addRoomSystemMessage).toHaveBeenCalled();
    expect(result).toEqual({ ok: false, cancelled: true });
  });
});
