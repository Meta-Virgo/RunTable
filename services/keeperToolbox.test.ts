import { describe, expect, it } from "vitest";
import {
  createKeeperPersonaTemplate,
  createPersonaMessage,
  createSecretBatchRolls,
} from "./keeperToolbox";

describe("keeper toolbox", () => {
  it("creates reusable NPC or monster personas for room output identity", () => {
    const template = createKeeperPersonaTemplate({
      id: "npc-1",
      roomId: "room-1",
      kind: "npc",
      name: "Inspector Vale",
      description: "Tired city detective",
    });

    expect(createPersonaMessage(template, "You again?")).toEqual({
      charId: "persona:npc-1",
      charName: "Inspector Vale",
      charRole: "NPC",
      content: "You again?",
    });
  });

  it("creates batch secret rolls without public details", () => {
    const result = createSecretBatchRolls({
      reason: "Listen at doors",
      targets: ["Alice", "Bob"],
      rolls: [21, 77],
    });

    expect(result.publicSummary).toBe("Keeper made 2 secret rolls for Listen at doors.");
    expect(result.keeperResults).toEqual([
      { target: "Alice", total: 21 },
      { target: "Bob", total: 77 },
    ]);
  });
});
