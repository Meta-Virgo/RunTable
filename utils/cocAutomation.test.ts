import { describe, expect, it } from "vitest";
import {
  buildBonusPenaltyRoll,
  buildGrowthCheck,
  buildOpposedCheck,
  buildSanChange,
} from "./cocAutomation";

describe("CoC rule automation", () => {
  it("builds growth checks, SAN changes, bonus or penalty rolls, and opposed checks", () => {
    expect(buildGrowthCheck({ skill: "Spot Hidden", currentValue: 55, roll: 83 }).improved).toBe(true);
    expect(buildSanChange({ characterName: "Alice", currentSan: 50, delta: -3 }).newSan).toBe(47);
    expect(buildBonusPenaltyRoll({ tensRolls: [7, 2], onesRoll: 4, mode: "bonus" }).total).toBe(24);
    expect(
      buildOpposedCheck({
        challenger: { name: "Alice", target: 60, roll: 32 },
        defender: { name: "Cultist", target: 50, roll: 40 },
      }).winner
    ).toBe("Alice");
  });
});
