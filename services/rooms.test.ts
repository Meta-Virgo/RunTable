import { describe, expect, it, vi } from "vitest";
import { fetchCurrentRoomMembership, kickRoomMember } from "./rooms";
import { supabase } from "../supabase";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("rooms service", () => {
  it("fetches the current user's room membership for restore flows", async () => {
    const membership = {
      room_id: "room-1",
      user_id: "user-1",
      character_id: "char-1",
      role: "player",
      status: "active",
    };
    const maybeSingle = vi.fn(async () => ({ data: membership, error: null }));
    const eqUser = vi.fn(() => ({ maybeSingle }));
    const eqRoom = vi.fn(() => ({ eq: eqUser }));
    const select = vi.fn(() => ({ eq: eqRoom }));
    vi.mocked(supabase.from).mockReturnValue({ select } as any);

    await expect(
      fetchCurrentRoomMembership("room-1", "user-1")
    ).resolves.toEqual({ data: membership, error: null });

    expect(supabase.from).toHaveBeenCalledWith("room_members");
    expect(select).toHaveBeenCalledWith(
      "room_id, user_id, character_id, role, status"
    );
    expect(eqRoom).toHaveBeenCalledWith("room_id", "room-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("kicks a room member through the membership transition rpc", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as any);

    await expect(kickRoomMember("room-1", "player-1")).resolves.toBeUndefined();

    expect(supabase.rpc).toHaveBeenCalledWith("kick_room_member", {
      p_room_id: "room-1",
      p_user_id: "player-1",
    });
  });

  it("surfaces membership transition errors when a kick fails", async () => {
    const error = new Error("Only keepers can kick room members");
    vi.mocked(supabase.rpc).mockResolvedValue({ error } as any);

    await expect(kickRoomMember("room-1", "player-1")).rejects.toThrow(error);
  });
});
