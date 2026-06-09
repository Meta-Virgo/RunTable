import { describe, expect, it } from "vitest";
import type { Character, GameHistory } from "../types";
import {
  attachLatestCharactersToPlayerHistory,
  buildPlayerHistoryWithLatestCharacters,
  buildProfileHistoryCharacterMap,
  getPlayerHistoryCharacterIds,
  sortPlayerHistoryByRecency,
} from "./profileHistoryModel";

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
  name: "Latest Lin",
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
  character_snapshot: { ...character, name: "Snapshot Lin" },
  outcome: "存活",
  game_history: historyA,
};

describe("profile history model", () => {
  it("derives unique latest character ids", () => {
    expect(
      getPlayerHistoryCharacterIds([
        participant,
        participant,
        { ...participant, character_snapshot: null },
      ])
    ).toEqual(["char-1"]);
  });

  it("attaches latest characters and sorts player history by recency", () => {
    const characterMap = buildProfileHistoryCharacterMap([character]);
    const withLatest = attachLatestCharactersToPlayerHistory({
      participants: [
        participant,
        { ...participant, id: "participant-b", game_history: historyB },
      ],
      characterMap,
    });

    expect(withLatest[0].latest_character).toEqual(character);
    expect(sortPlayerHistoryByRecency(withLatest).map((item) => item.id)).toEqual(
      ["participant-b", "participant-a"]
    );
  });

  it("builds player history through one interface", () => {
    const history = buildPlayerHistoryWithLatestCharacters({
      participants: [
        participant,
        { ...participant, id: "participant-b", game_history: historyB },
      ],
      latestCharacters: [character],
    });

    expect(history).toMatchObject([
      { id: "participant-b", latest_character: { name: "Latest Lin" } },
      { id: "participant-a", latest_character: { name: "Latest Lin" } },
    ]);
  });
});
