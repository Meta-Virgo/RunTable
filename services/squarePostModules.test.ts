import { describe, expect, it } from "vitest";
import type { Character, Log, SquarePostModule } from "../types";
import {
  buildCharacterSummaryPayload,
  createCharacterSummaryModule,
  createRoomLogExcerptModule,
  getSquareModuleSearchText,
  normalizeSquarePostModules,
} from "./squarePostModules";

const character = {
  id: "char-1",
  user_id: "user-1",
  room_id: "room-1",
  name: "Lin",
  role: "调查员",
  type: "investigator",
  theme_color: "#94a3b8",
  avatar_url: "https://example.test/avatar.png",
  job: "侦探",
  age: "32",
  sex: "女",
  str: 50,
  con: 55,
  siz: 60,
  dex: 65,
  app: 70,
  int: 75,
  pow: 80,
  edu: 85,
  luck: 45,
  hp: 12,
  san: 60,
  mp: 16,
  notes: "keeper-facing note",
  backstory: "private backstory",
  info: { secret: true },
  stats: { raw: true },
  skills: {
    Spot: 70,
    Listen: 50,
    Library: 80,
    Dodge: 45,
    Stealth: 60,
    Charm: 55,
    Fight: 65,
    Drive: 25,
    FirstAid: 40,
  },
  items: [{ name: "knife", quantity: 1 }],
  spells: [{ name: "spell", quantity: 1 }],
} satisfies Character;

const log = (overrides: Partial<Log>): Log => ({
  id: overrides.id || "log-1",
  timestamp: "12:00",
  createdAt: overrides.createdAt || "2026-06-08T12:00:00.000Z",
  charId: "char-1",
  charName: overrides.charName || "Lin",
  charRole: overrides.charRole || "调查员",
  type: overrides.type || "normal",
  content: overrides.content || "The door opens.",
  recipientId: overrides.recipientId,
  ...overrides,
});

describe("square post modules", () => {
  it("builds public character summaries without sensitive fields", () => {
    const payload = buildCharacterSummaryPayload(character);

    expect(payload).toMatchObject({
      name: "Lin",
      job: "侦探",
      stats: { str: 50, san: 60 },
    });
    expect(payload.top_skills).toEqual([
      { name: "Library", value: 80 },
      { name: "Spot", value: 70 },
      { name: "Fight", value: 65 },
      { name: "Stealth", value: 60 },
      { name: "Charm", value: 55 },
      { name: "Listen", value: 50 },
      { name: "Dodge", value: 45 },
      { name: "FirstAid", value: 40 },
    ]);
    expect(JSON.stringify(payload)).not.toContain("keeper-facing note");
    expect(JSON.stringify(payload)).not.toContain("private backstory");
    expect(JSON.stringify(payload)).not.toContain("knife");
    expect(JSON.stringify(payload)).not.toContain("raw");
  });

  it("creates character modules with source ids but snapshot payloads", () => {
    expect(createCharacterSummaryModule(character)).toMatchObject({
      module_type: "character_summary",
      source_character_id: "char-1",
      source_room_id: null,
      payload: { name: "Lin" },
    });
  });

  it("builds room excerpts from public logs only", () => {
    const module = createRoomLogExcerptModule({
      roomId: "room-1",
      roomTitle: "The House",
      logs: [
        log({ id: "2", createdAt: "2026-06-08T12:02:00.000Z" }),
        log({ id: "1", createdAt: "2026-06-08T12:01:00.000Z" }),
        log({ id: "3", type: "dice_secret", content: "secret roll" }),
        log({ id: "4", recipientId: "user-2", content: "private whisper" }),
      ],
    });

    expect(module).toMatchObject({
      module_type: "room_log_excerpt",
      source_room_id: "room-1",
      source_message_ids: ["1", "2"],
      payload: {
        title: "The House",
        entries: [{ id: "1" }, { id: "2" }],
      },
    });
    expect(JSON.stringify(module)).not.toContain("secret roll");
    expect(JSON.stringify(module)).not.toContain("private whisper");
  });

  it("normalizes module order and builds search text", () => {
    const modules = normalizeSquarePostModules({
      square_post_modules: [
        { module_type: "room_log_excerpt", display_order: 2 } as SquarePostModule,
        { module_type: "character_summary", display_order: 1 } as SquarePostModule,
      ],
    });

    expect(modules.map((module) => module.module_type)).toEqual([
      "character_summary",
      "room_log_excerpt",
    ]);
    expect(
      getSquareModuleSearchText(createCharacterSummaryModule(character))
    ).toContain("Library");
  });
});

