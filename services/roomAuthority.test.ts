import { describe, expect, it } from "vitest";
import {
  deriveRoomAuthority,
  getRestoredRoomEntry,
} from "./roomAuthority";

describe("room authority", () => {
  it("trusts an active keeper membership over room-owner inference", () => {
    const authority = deriveRoomAuthority({
      userId: "user-1",
      requestedCharacterId: "pc",
      room: {
        id: "room-1",
        kp_id: "legacy-kp",
      },
      membership: {
        room_id: "room-1",
        user_id: "user-1",
        character_id: null,
        role: "keeper",
        status: "active",
      },
    });

    expect(authority).toMatchObject({
      role: "keeper",
      membershipStatus: "active",
      isKP: true,
      canManageRoom: true,
      activeCharacterId: "pc",
    });
  });

  it("uses an active player membership character as the active room character", () => {
    const authority = deriveRoomAuthority({
      userId: "user-2",
      requestedCharacterId: "requested-char",
      room: {
        id: "room-1",
        kp_id: "keeper-1",
      },
      membership: {
        room_id: "room-1",
        user_id: "user-2",
        character_id: "member-char",
        role: "player",
        status: "active",
      },
    });

    expect(authority).toMatchObject({
      role: "player",
      membershipStatus: "active",
      isKP: false,
      canManageRoom: false,
      activeCharacterId: "member-char",
    });
  });

  it("restores keepers as pc and players as their membership character", () => {
    expect(
      getRestoredRoomEntry({
        room_id: "room-1",
        user_id: "keeper-1",
        character_id: null,
        role: "keeper",
        status: "active",
      })
    ).toEqual({ roomId: "room-1", characterId: "pc" });

    expect(
      getRestoredRoomEntry({
        room_id: "room-1",
        user_id: "player-1",
        character_id: "char-1",
        role: "player",
        status: "active",
      })
    ).toEqual({ roomId: "room-1", characterId: "char-1" });
  });

  it("does not restore inactive memberships or players without characters", () => {
    expect(
      getRestoredRoomEntry({
        room_id: "room-1",
        user_id: "player-1",
        character_id: "char-1",
        role: "player",
        status: "kicked",
      })
    ).toBeNull();

    expect(
      getRestoredRoomEntry({
        room_id: "room-1",
        user_id: "player-1",
        character_id: null,
        role: "player",
        status: "active",
      })
    ).toBeNull();
  });

  it("does not grant active room authority from inactive memberships", () => {
    const authority = deriveRoomAuthority({
      userId: "player-1",
      requestedCharacterId: "requested-char",
      room: {
        id: "room-1",
        kp_id: "keeper-1",
      },
      membership: {
        room_id: "room-1",
        user_id: "player-1",
        character_id: "member-char",
        role: "player",
        status: "kicked",
      },
    });

    expect(authority).toMatchObject({
      role: "player",
      membershipStatus: "kicked",
      isKP: false,
      canManageRoom: false,
      activeCharacterId: "pc",
    });
  });
});
