import { describe, expect, it } from "vitest";
import {
  buildRoomMemberPanelItems,
  removeRoomMemberByUserId,
} from "./roomMembers";
import type { Character } from "../types";
import type { RoomMembership } from "./roomAuthority";

const baseCharacter = {
  id: "char-1",
  name: "Lin",
  role: "调查员",
  type: "investigator",
  job: "",
  age: "",
  sex: "",
  str: 0,
  con: 0,
  siz: 0,
  dex: 0,
  app: 0,
  int: 0,
  pow: 0,
  edu: 0,
  luck: 0,
  hp: 10,
  san: 50,
  mp: 10,
  notes: "",
  backstory: "",
  skills: {},
} satisfies Character;

describe("room member panel model", () => {
  it("lists active members with roles, selected characters, and online state", () => {
    const memberships: RoomMembership[] = [
      {
        room_id: "room-1",
        user_id: "keeper-1",
        character_id: null,
        role: "keeper",
        status: "active",
      },
      {
        room_id: "room-1",
        user_id: "player-1",
        character_id: "char-1",
        role: "player",
        status: "active",
      },
      {
        room_id: "room-1",
        user_id: "player-2",
        character_id: "char-2",
        role: "player",
        status: "kicked",
      },
    ];

    const items = buildRoomMemberPanelItems({
      memberships,
      characters: [{ ...baseCharacter, user_id: "player-1" }],
      onlineUsers: new Set(["keeper-1"]),
    });

    expect(items).toEqual([
      {
        userId: "keeper-1",
        role: "keeper",
        status: "active",
        isOnline: true,
        canKick: false,
        kickUserId: null,
        displayName: "Keeper",
        roleLabel: "Keeper",
        characterId: null,
        characterName: null,
      },
      {
        userId: "player-1",
        role: "player",
        status: "active",
        isOnline: false,
        canKick: true,
        kickUserId: "player-1",
        displayName: "Lin",
        roleLabel: "Player",
        characterId: "char-1",
        characterName: "Lin",
      },
    ]);
  });

  it("removes only the kicked user's membership from the local member list", () => {
    const memberships: RoomMembership[] = [
      {
        room_id: "room-1",
        user_id: "keeper-1",
        character_id: null,
        role: "keeper",
        status: "active",
      },
      {
        room_id: "room-1",
        user_id: "player-1",
        character_id: "char-1",
        role: "player",
        status: "active",
      },
      {
        room_id: "room-1",
        user_id: "player-2",
        character_id: "char-2",
        role: "player",
        status: "active",
      },
    ];

    expect(removeRoomMemberByUserId(memberships, "player-1")).toEqual([
      memberships[0],
      memberships[2],
    ]);
  });

  it("keeps a kick target for active players who have not selected a character", () => {
    const items = buildRoomMemberPanelItems({
      memberships: [
        {
          room_id: "room-1",
          user_id: "player-without-character",
          character_id: null,
          role: "player",
          status: "active",
        },
      ],
      characters: [],
      onlineUsers: new Set(),
    });

    expect(items).toEqual([
      expect.objectContaining({
        userId: "player-without-character",
        characterId: null,
        canKick: true,
        kickUserId: "player-without-character",
      }),
    ]);
  });

  it("labels observers distinctly from players when no character is selected", () => {
    const items = buildRoomMemberPanelItems({
      memberships: [
        {
          room_id: "room-1",
          user_id: "observer-1",
          character_id: null,
          role: "observer",
          status: "active",
        },
      ],
      characters: [],
      onlineUsers: new Set(),
    });

    expect(items).toEqual([
      expect.objectContaining({
        userId: "observer-1",
        role: "observer",
        displayName: "Observer",
        roleLabel: "Observer",
      }),
    ]);
  });
});
