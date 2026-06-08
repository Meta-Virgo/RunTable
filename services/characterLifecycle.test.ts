import { describe, expect, it } from "vitest";
import {
  applyCharacterVitals,
  buildCharacterVitalsPayload,
  createCharacterLifecycleExecutor,
  describeVitalsChange,
  getActiveCharacterAfterRemoval,
  getDuplicateCharacterName,
  removeCharacterFromList,
  upsertCharacterInList,
} from "./characterLifecycle";
import type { Character } from "../types";

const character = {
  id: "char-1",
  name: "Lin",
  role: "调查员",
  type: "investigator",
  job: "",
  age: "",
  sex: "",
  str: 60,
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
  skills: {
    侦查: 45,
  },
} satisfies Character;

describe("character lifecycle model", () => {
  it("creates a duplicate name without stacking previous suffixes", () => {
    expect(
      getDuplicateCharacterName("Lin", new Set(["Lin", "Lin β"]))
    ).toBe("Lin γ");

    expect(
      getDuplicateCharacterName("Lin β", new Set(["Lin", "Lin β"]))
    ).toBe("Lin γ");
  });

  it("builds a vitals payload that keeps current stats and skills", () => {
    expect(buildCharacterVitalsPayload(character, 8, 47, 9)).toMatchObject({
      str: 60,
      con: 50,
      hp: 8,
      san: 47,
      mp: 9,
      skills: { 侦查: 45 },
    });
  });

  it("describes vitals changes in the status-log format", () => {
    expect(describeVitalsChange(character, 8, 52, 10)).toEqual([
      "HP -2",
      "SAN +2",
    ]);
  });

  it("upserts, removes, and applies vitals in local character lists", () => {
    const other = { ...character, id: "char-2", name: "Morgan" };
    const inserted = upsertCharacterInList([character], other);
    expect(inserted.map((item) => item.name)).toEqual(["Lin", "Morgan"]);

    const updated = upsertCharacterInList(inserted, {
      ...character,
      name: "Updated Lin",
    });
    expect(updated.map((item) => item.name)).toEqual([
      "Updated Lin",
      "Morgan",
    ]);

    const withVitals = applyCharacterVitals(updated, "char-1", {
      hp: 7,
      san: 44,
      mp: 9,
    });
    expect(withVitals[0]).toMatchObject({ hp: 7, san: 44, mp: 9 });

    expect(removeCharacterFromList(withVitals, "char-1")).toEqual([other]);
  });

  it("returns keeper pc when the active character is removed", () => {
    expect(getActiveCharacterAfterRemoval("char-1", "char-1")).toBe("pc");
    expect(getActiveCharacterAfterRemoval("char-2", "char-1")).toBe("char-2");
  });

  it("runs duplicate, save, delete, and vitals through one lifecycle interface", async () => {
    let characters: Character[] = [character];
    let activeCharId = "char-1";
    const logs: Array<{ type: string; content: string; characterId?: string }> =
      [];
    const createdPayloads: any[] = [];
    const updatedPayloads: any[] = [];
    const deletedIds: string[] = [];
    const statsUpdates: Array<{ id: string; stats: Record<string, any> }> = [];

    const executor = createCharacterLifecycleExecutor({
      getContext: () => ({
        currentRoomId: "room-1",
        userId: "user-1",
        characters,
      }),
      repository: {
        createCharacter: async (payload) => {
          createdPayloads.push(payload);
          return {
            data: {
              id: "char-created",
              name: payload.name,
              type: payload.type,
              info: payload.info,
              stats: payload.stats,
              role: payload.role,
              room_id: payload.room_id,
              user_id: payload.user_id,
            },
            error: null,
          };
        },
        updateCharacter: async (_id, payload) => {
          updatedPayloads.push(payload);
          return { error: null };
        },
        fetchCharacterById: async () => ({
          data: {
            id: "char-1",
            name: "Updated Lin",
            type: "investigator",
            role: "调查员",
            info: { job: "", age: "", sex: "", skills: {} },
            stats: { str: 60, con: 50, hp: 10, san: 50, mp: 10 },
          },
          error: null,
        }),
        deleteCharacter: async (id) => {
          deletedIds.push(id);
          return { error: null };
        },
        updateCharacterStats: async (id, stats) => {
          statsUpdates.push({ id, stats });
          return { error: null };
        },
      },
      localState: {
        replaceCharacters: (updater) => {
          characters = updater(characters);
        },
        updateActiveCharacter: (updater) => {
          activeCharId = updater(activeCharId);
        },
      },
      addLog: async (type, content, customCharId) => {
        logs.push({ type, content, characterId: customCharId });
      },
    });

    await expect(executor.duplicateCharacter(character)).resolves.toEqual({
      ok: true,
    });
    expect(createdPayloads[0]).toMatchObject({
      name: "Lin β",
      room_id: "room-1",
      user_id: "user-1",
      type: "investigator",
    });

    await expect(
      executor.saveRoomCharacter({ ...character, name: "Edited Lin" }, null)
    ).resolves.toEqual({ ok: true });
    expect(characters.some((item) => item.id === "char-created")).toBe(true);

    await expect(
      executor.saveRoomCharacter({ ...character, name: "Updated Lin" }, character)
    ).resolves.toEqual({ ok: true });
    expect(updatedPayloads).toHaveLength(1);
    expect(characters[0].name).toBe("Updated Lin");

    await expect(
      executor.updateCharacterVitals("char-1", 8, 49, 10)
    ).resolves.toEqual({ ok: true });
    expect(statsUpdates[0]).toMatchObject({
      id: "char-1",
      stats: expect.objectContaining({ hp: 8, san: 49, mp: 10 }),
    });
    expect(logs[0]).toEqual({
      type: "status",
      content: "Updated Lin 状态变更: HP -2, SAN -1",
      characterId: "char-1",
    });

    await expect(executor.deleteRoomCharacter("char-1")).resolves.toEqual({
      ok: true,
    });
    expect(deletedIds).toEqual(["char-1"]);
    expect(activeCharId).toBe("pc");
    expect(characters.some((item) => item.id === "char-1")).toBe(false);
  });
});
