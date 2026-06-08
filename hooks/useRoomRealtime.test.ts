import { describe, expect, it } from "vitest";
import {
  createRealtimeLifecycleGuard,
  createRoomRealtimeAdapter,
  isKickMessageForUser,
} from "./useRoomRealtime";
import type { Character, Log, ModuleInfo } from "../types";

describe("room realtime kick messages", () => {
  it("matches kick system messages for the kicked user only", () => {
    const message = {
      type: "system",
      meta: {
        type: "kick",
        userId: "player-1",
      },
    };

    expect(isKickMessageForUser(message, "player-1")).toBe(true);
    expect(isKickMessageForUser(message, "player-2")).toBe(false);
  });

  it("ignores non-kick messages and malformed metadata", () => {
    expect(
      isKickMessageForUser(
        { type: "system", meta: { type: "join", userId: "player-1" } },
        "player-1"
      )
    ).toBe(false);
    expect(
      isKickMessageForUser({ type: "chat", meta: { userId: "player-1" } }, "player-1")
    ).toBe(false);
  });
});

describe("room realtime lifecycle guard", () => {
  it("marks stale realtime fetches as inactive after cleanup", () => {
    const lifecycle = createRealtimeLifecycleGuard();

    expect(lifecycle.isActive()).toBe(true);
    lifecycle.cancel();
    expect(lifecycle.isActive()).toBe(false);
  });
});

const baseCharacter = {
  id: "char-1",
  name: "Lin",
  role: "调查员",
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
} satisfies Character;

const baseLog = {
  id: "log-1",
  timestamp: "10:00",
  createdAt: "2026-06-08T00:00:00.000Z",
  charId: "pc",
  charName: "Keeper",
  charRole: "Keeper",
  type: "normal",
  content: "hello",
} satisfies Log;

describe("room realtime adapter", () => {
  it("appends logs without duplicating realtime echoes", () => {
    let logs: Log[] = [baseLog];
    const adapter = createRoomRealtimeAdapter({
      getCharacters: () => [],
      replaceCharacters: () => {},
      replaceLogs: (updater) => {
        logs = updater(logs);
      },
      setHasMoreLogs: () => {},
      updateModuleInfo: () => {},
      setBgMusicUrl: () => {},
      setIsMusicPlaying: () => {},
      setMusicTrackIndex: () => {},
      syncPresence: () => {},
    });

    adapter.appendLog(baseLog);
    adapter.appendLog({ ...baseLog, id: "log-2", content: "new" });

    expect(logs).toEqual([baseLog, { ...baseLog, id: "log-2", content: "new" }]);
  });

  it("merges existing character rows and inserts unseen characters", () => {
    let characters: Character[] = [baseCharacter];
    const adapter = createRoomRealtimeAdapter({
      getCharacters: () => characters,
      replaceCharacters: (updater) => {
        characters = updater(characters);
      },
      replaceLogs: () => {},
      setHasMoreLogs: () => {},
      updateModuleInfo: () => {},
      setBgMusicUrl: () => {},
      setIsMusicPlaying: () => {},
      setMusicTrackIndex: () => {},
      syncPresence: () => {},
    });

    adapter.mergeCharacter({
      id: "char-1",
      name: "Updated Lin",
      stats: { hp: 8 },
    });
    adapter.mergeCharacter({
      ...baseCharacter,
      id: "char-2",
      name: "Morgan",
    });

    expect(characters.map((character) => character.name)).toEqual([
      "Updated Lin",
      "Morgan",
    ]);
    expect(characters[0].hp).toBe(8);
  });

  it("applies room patch updates for module info and music sync", () => {
    let moduleInfo: ModuleInfo = {
      title: "Old",
      description: "Old description",
      notes: "keep",
    };
    let bgMusicUrl: string | null = null;
    let isMusicPlaying = false;
    let musicTrackIndex = 0;

    const adapter = createRoomRealtimeAdapter({
      getCharacters: () => [],
      replaceCharacters: () => {},
      replaceLogs: () => {},
      setHasMoreLogs: () => {},
      updateModuleInfo: (updater) => {
        moduleInfo = updater(moduleInfo);
      },
      setBgMusicUrl: (url) => {
        bgMusicUrl = url;
      },
      setIsMusicPlaying: (next) => {
        isMusicPlaying = next;
      },
      setMusicTrackIndex: (next) => {
        musicTrackIndex = next;
      },
      syncPresence: () => {},
    });

    adapter.applyRoomPatch({
      title: "New",
      bg_music_url: "s:1",
      is_music_playing: true,
      music_track_index: 2,
    });

    expect(moduleInfo).toEqual({
      title: "New",
      description: "Old description",
      notes: "keep",
    });
    expect(bgMusicUrl).toBe("s:1");
    expect(isMusicPlaying).toBe(true);
    expect(musicTrackIndex).toBe(2);
  });
});
