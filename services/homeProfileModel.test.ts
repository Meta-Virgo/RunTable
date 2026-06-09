import { describe, expect, it } from "vitest";
import type { Character, GameHistory } from "../types";
import {
  buildHomePlayerHistory,
  fetchHomeProfileHistory,
  getHomePlayerHistoryCharacterIds,
} from "./homeProfileModel";

const historyA = {
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

const historyB = {
  ...historyA,
  id: "history-b",
  created_at: "2026-06-09T00:00:00.000Z",
  room_title: "Later",
} satisfies GameHistory;

const character = {
  id: "char-1",
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
} satisfies Character;

const participant = {
  id: "participant-a",
  game_history_id: "history-a",
  user_id: "user-1",
  user_nickname: "Player",
  character_snapshot: character,
  outcome: "瀛樻椿",
  game_history: historyA,
};

describe("home profile model", () => {
  it("derives unique character ids and builds sorted player history", () => {
    expect(
      getHomePlayerHistoryCharacterIds([
        participant,
        participant,
        { ...participant, character_snapshot: null },
      ])
    ).toEqual(["char-1"]);

    const playerHistory = buildHomePlayerHistory({
      participants: [
        participant,
        { ...participant, id: "participant-b", game_history: historyB },
      ],
      latestCharacters: [{ ...character, name: "Latest Lin" }],
    });

    expect(playerHistory.map((item) => item.id)).toEqual([
      "participant-b",
      "participant-a",
    ]);
    expect(playerHistory[0].latest_character?.name).toBe("Latest Lin");
  });

  it("fetches home profile history through one repository", async () => {
    const calls: string[] = [];
    const result = await fetchHomeProfileHistory({
      userId: "user-1",
      repository: {
        fetchKpHistory: async (userId) => {
          calls.push(`kp:${userId}`);
          return { data: [historyA] };
        },
        fetchPlayerHistory: async (userId) => {
          calls.push(`player:${userId}`);
          return { data: [participant] };
        },
        fetchCharactersByIds: async (characterIds) => {
          calls.push(`characters:${characterIds.join(",")}`);
          return { data: [{ ...character, name: "Latest Lin" }] };
        },
      },
    });

    expect(calls).toEqual([
      "kp:user-1",
      "player:user-1",
      "characters:char-1",
    ]);
    expect(result).toMatchObject({
      kpHistory: [historyA],
      playerHistory: [{ latest_character: { name: "Latest Lin" } }],
    });
  });
});
