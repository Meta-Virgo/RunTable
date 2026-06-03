import { describe, expect, it } from "vitest";
import { calculateDBAndBuild } from "./cocRules";

describe("calculateDBAndBuild", () => {
  it.each([
    [30, 30, "-2", -2],
    [40, 40, "-1", -1],
    [60, 60, "0", 0],
    [80, 80, "+1D4", 1],
    [100, 100, "+1D6", 2],
    [105, 100, "+2D6", 3],
    [145, 140, "+3D6", 4],
  ])(
    "calculates DB and build for STR %i and SIZ %i",
    (str, siz, expectedDb, expectedBuild) => {
      expect(calculateDBAndBuild(str, siz)).toEqual({
        db: expectedDb,
        build: expectedBuild,
      });
    }
  );
});
