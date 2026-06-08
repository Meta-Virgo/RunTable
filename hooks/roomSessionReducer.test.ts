import { describe, expect, it, vi } from "vitest";
import type { Character, Log } from "../types";
import {
  createInitialRoomSessionState,
  createRoomSessionStateDispatchers,
  roomSessionReducer,
} from "./roomSessionReducer";

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

const log = (id: string): Log => ({
  id,
  timestamp: "10:00",
  createdAt: "2026-06-08T00:00:00.000Z",
  charId: "pc",
  charName: "Keeper",
  charRole: "Keeper",
  type: "normal",
  content: id,
});

describe("room session reducer", () => {
  it("creates the cleared room session state as the initial state", () => {
    expect(createInitialRoomSessionState()).toMatchObject({
      currentRoomId: null,
      roomType: "text",
      characters: [],
      logs: [],
      activeCharId: "pc",
      roomRole: "player",
      roomMembershipStatus: "unknown",
    });
  });

  it("replaces or patches the room session state", () => {
    const initial = createInitialRoomSessionState();
    const replacement = {
      ...initial,
      currentRoomId: "room-1",
      activeCharId: "char-1",
    };

    expect(
      roomSessionReducer(initial, { type: "replace", state: replacement })
    ).toBe(replacement);

    expect(
      roomSessionReducer(replacement, {
        type: "patch",
        patch: { hasMoreLogs: false },
      })
    ).toMatchObject({
      currentRoomId: "room-1",
      activeCharId: "char-1",
      hasMoreLogs: false,
    });
  });

  it("applies functional updates for characters, logs, and active character", () => {
    let state = createInitialRoomSessionState();

    state = roomSessionReducer(state, {
      type: "set-characters",
      update: [character("char-1")],
    });
    state = roomSessionReducer(state, {
      type: "set-characters",
      update: (previous) => [...previous, character("char-2")],
    });
    state = roomSessionReducer(state, {
      type: "set-logs",
      update: (previous) => [...previous, log("log-1")],
    });
    state = roomSessionReducer(state, {
      type: "set-active-character",
      update: () => "char-2",
    });

    expect(state.characters.map((item) => item.id)).toEqual(["char-1", "char-2"]);
    expect(state.logs.map((item) => item.id)).toEqual(["log-1"]);
    expect(state.activeCharId).toBe("char-2");
  });

  it("updates module settings without clearing an omitted room password", () => {
    const state = {
      ...createInitialRoomSessionState(),
      roomPassword: "secret",
    };

    expect(
      roomSessionReducer(state, {
        type: "apply-module-settings",
        moduleInfo: {
          title: "New",
          description: "Desc",
          notes: "",
        },
      })
    ).toMatchObject({
      moduleInfo: {
        title: "New",
        description: "Desc",
        notes: "",
      },
      roomPassword: "secret",
    });

    expect(
      roomSessionReducer(state, {
        type: "apply-module-settings",
        moduleInfo: state.moduleInfo,
        roomPassword: "",
      }).roomPassword
    ).toBe("");
  });

  it("creates dispatchers for the reducer action interface", () => {
    const dispatch = vi.fn();
    const actions = createRoomSessionStateDispatchers(dispatch);

    actions.patch({ currentRoomId: "room-1" });
    actions.selectActiveCharacter("char-1");

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "patch",
      patch: { currentRoomId: "room-1" },
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "set-active-character",
      update: "char-1",
    });
  });
});
