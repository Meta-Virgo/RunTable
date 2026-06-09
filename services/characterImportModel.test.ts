import { describe, expect, it } from "vitest";
import type { Character } from "../types";
import {
  applyCharacterImport,
  parseCharacterImportText,
} from "./characterImportModel";

const character = {
  id: "character-1",
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
  skills: { 侦察: 25 },
} satisfies Character;

describe("character import model", () => {
  it("parses stats and skill aliases from pasted .st text", () => {
    expect(
      parseCharacterImportText({
        text: ".st 力量60str55san70图书馆45侦查65",
        currentSkills: { 斗殴: 25 },
      })
    ).toEqual({
      updates: {
        str: 55,
        san: 70,
      },
      skills: {
        斗殴: 25,
        图书馆使用: 45,
        侦察: 65,
      },
    });
  });

  it("returns null for empty text", () => {
    expect(parseCharacterImportText({ text: "   " })).toBeNull();
  });

  it("applies parsed values onto a character", () => {
    expect(
      applyCharacterImport({
        character,
        text: ".st 体质65mp12计算机70",
      })
    ).toMatchObject({
      con: 65,
      mp: 12,
      skills: {
        侦察: 25,
        计算机使用: 70,
      },
    });
  });
});
