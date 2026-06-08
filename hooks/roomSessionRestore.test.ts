import { describe, expect, it, vi } from "vitest";
import type { RoomMembership } from "../services/roomAuthority";
import { restoreRoomSessionFromUrl } from "./roomSessionRestore";

const membership = (overrides: Partial<RoomMembership> = {}): RoomMembership => ({
  room_id: "room-1",
  user_id: "user-1",
  character_id: "char-1",
  role: "player",
  status: "active",
  ...overrides,
});

const adapters = () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    data: { user: { id: "user-1" } },
  }),
  fetchCurrentRoomMembership: vi.fn().mockResolvedValue({
    data: membership(),
  }),
  joinRoomSession: vi.fn().mockResolvedValue({ ok: true }),
});

describe("room session restore", () => {
  it("does nothing when there is no room url parameter", async () => {
    const testAdapters = adapters();

    await expect(
      restoreRoomSessionFromUrl({
        roomId: null,
        adapters: testAdapters,
      })
    ).resolves.toEqual({ action: "noop" });
    expect(testAdapters.getCurrentUser).not.toHaveBeenCalled();
  });

  it("clears the restored url when no authenticated user exists", async () => {
    const testAdapters = {
      ...adapters(),
      getCurrentUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    };

    await expect(
      restoreRoomSessionFromUrl({
        roomId: "room-1",
        adapters: testAdapters,
      })
    ).resolves.toEqual({ action: "clear-url" });
    expect(testAdapters.fetchCurrentRoomMembership).not.toHaveBeenCalled();
  });

  it("clears the restored url when membership cannot restore a room", async () => {
    const testAdapters = {
      ...adapters(),
      fetchCurrentRoomMembership: vi.fn().mockResolvedValue({
        data: membership({ status: "kicked" }),
      }),
    };

    await expect(
      restoreRoomSessionFromUrl({
        roomId: "room-1",
        adapters: testAdapters,
      })
    ).resolves.toEqual({ action: "clear-url" });
    expect(testAdapters.joinRoomSession).not.toHaveBeenCalled();
  });

  it("joins the restored room with the active membership character", async () => {
    const testAdapters = adapters();

    await expect(
      restoreRoomSessionFromUrl({
        roomId: "room-1",
        adapters: testAdapters,
      })
    ).resolves.toEqual({ action: "restored", result: { ok: true } });
    expect(testAdapters.joinRoomSession).toHaveBeenCalledWith({
      roomId: "room-1",
      charId: "char-1",
      isRestoring: true,
    });
  });

  it("restores keeper memberships through the pc identity", async () => {
    const testAdapters = {
      ...adapters(),
      fetchCurrentRoomMembership: vi.fn().mockResolvedValue({
        data: membership({
          role: "keeper",
          character_id: null,
        }),
      }),
    };

    await restoreRoomSessionFromUrl({
      roomId: "room-1",
      adapters: testAdapters,
    });

    expect(testAdapters.joinRoomSession).toHaveBeenCalledWith({
      roomId: "room-1",
      charId: "pc",
      isRestoring: true,
    });
  });

  it("keeps the url when restore join was cancelled as stale", async () => {
    const testAdapters = {
      ...adapters(),
      joinRoomSession: vi.fn().mockResolvedValue({
        ok: false,
        cancelled: true,
      }),
    };

    await expect(
      restoreRoomSessionFromUrl({
        roomId: "room-1",
        adapters: testAdapters,
      })
    ).resolves.toEqual({ action: "noop" });
  });
});
