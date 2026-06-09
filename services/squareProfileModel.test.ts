import { describe, expect, it } from "vitest";
import type { Character, GameHistory } from "../types";
import {
  attachLatestSquareCharacters,
  buildSquareCharacterMap,
  buildSquarePlayerHistory,
  fetchSquareProfilePanelData,
  getSquareHistoryCharacterDisplay,
  getSquarePlayerHistoryCharacterIds,
  sortSquarePlayerHistory,
} from "./squareProfileModel";

const gameHistoryA = {
  id: "history-a",
  created_at: "2026-06-08T00:00:00.000Z",
  room_id: "room-a",
  room_title: "Earlier",
  room_description: null,
  start_time: null,
  end_time: null,
  kp_id: "keeper-1",
  kp_nickname: "Keeper",
} satisfies GameHistory;

const gameHistoryB = {
  ...gameHistoryA,
  id: "history-b",
  created_at: "2026-06-09T00:00:00.000Z",
  room_title: "Later",
} satisfies GameHistory;

const snapshotCharacter = {
  id: "character-1",
  name: "Snapshot Investigator",
  type: "investigator",
  role: "Investigator",
  job: "旧职业",
  age: "20",
  sex: "未知",
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

const latestCharacter = {
  ...snapshotCharacter,
  name: "Latest Investigator",
  job: "侦探",
  sex: "女",
  avatar_url: "https://image.test/latest.png",
} satisfies Character;

const participant = {
  id: "participant-1",
  game_history_id: "history-a",
  user_id: "user-1",
  user_nickname: "Player",
  character_snapshot: snapshotCharacter,
  outcome: "死亡",
  game_history: gameHistoryA,
} as const;

describe("square profile model", () => {
  it("derives unique character ids and maps latest characters", () => {
    expect(
      getSquarePlayerHistoryCharacterIds([
        participant,
        participant,
        { ...participant, character_snapshot: null },
      ])
    ).toEqual(["character-1"]);

    const characterMap = buildSquareCharacterMap([latestCharacter]);
    const withLatest = attachLatestSquareCharacters({
      participants: [participant],
      characterMap,
    });

    expect(withLatest[0].latest_character).toEqual(latestCharacter);
  });

  it("sorts player history newest first and exposes display fields", () => {
    const playerHistory = sortSquarePlayerHistory([
      {
        ...participant,
        id: "participant-a",
        game_history: gameHistoryA,
      },
      {
        ...participant,
        id: "participant-b",
        game_history: gameHistoryB,
        latest_character: latestCharacter,
      },
    ]);

    expect(playerHistory.map((item) => item.id)).toEqual([
      "participant-b",
      "participant-a",
    ]);

    expect(getSquareHistoryCharacterDisplay(playerHistory[0])).toEqual({
      name: "Latest Investigator",
      avatarUrl: "https://image.test/latest.png",
      job: "侦探",
      sex: "女",
      isDead: true,
      isLost: false,
      isCrazy: false,
    });
  });

  it("builds player history from participants and fetched latest characters", () => {
    const playerHistory = buildSquarePlayerHistory({
      participants: [
        { ...participant, game_history: gameHistoryA },
        { ...participant, id: "participant-b", game_history: gameHistoryB },
      ],
      latestCharacters: [latestCharacter],
    });

    expect(playerHistory[0]).toMatchObject({
      id: "participant-b",
      latest_character: latestCharacter,
    });
  });

  it("fetches the full square profile panel data through one repository", async () => {
    const calls: string[] = [];
    const result = await fetchSquareProfilePanelData({
      userId: "user-1",
      repository: {
        fetchProfileById: async (userId) => {
          calls.push(`profile:${userId}`);
          return { data: { id: userId, nickname: "Yves" } };
        },
        fetchKpHistory: async (userId) => {
          calls.push(`kp:${userId}`);
          return { data: [gameHistoryA] };
        },
        fetchPlayerHistory: async (userId) => {
          calls.push(`player:${userId}`);
          return { data: [participant] };
        },
        fetchCharactersByIds: async (characterIds) => {
          calls.push(`characters:${characterIds.join(",")}`);
          return { data: [latestCharacter] };
        },
      },
    });

    expect(calls).toEqual([
      "profile:user-1",
      "kp:user-1",
      "player:user-1",
      "characters:character-1",
    ]);
    expect(result).toMatchObject({
      profile: { id: "user-1", nickname: "Yves" },
      kpHistory: [gameHistoryA],
      playerHistory: [{ latest_character: latestCharacter }],
    });
  });
});
