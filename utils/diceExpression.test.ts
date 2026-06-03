import { afterEach, describe, expect, it, vi } from "vitest";
import { Character } from "../types";
import { evaluateDiceExpression, resolveStatAlias } from "./diceExpression";

const testCharacter = {
  str: 60,
  dex: 45,
  hp: 10,
  stats: {
    luck: 70,
  },
  skills: {
    侦查: 55,
  },
} as unknown as Character;

describe("resolveStatAlias", () => {
  it("resolves Chinese CoC attribute names", () => {
    expect(resolveStatAlias("力量")).toBe("str");
    expect(resolveStatAlias("敏捷")).toBe("dex");
    expect(resolveStatAlias("幸运")).toBe("luck");
  });
});

describe("evaluateDiceExpression", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("evaluates dice with deterministic rolls", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5);

    expect(evaluateDiceExpression("2d6+1", testCharacter)).toEqual({
      total: 6,
      details: ["2d6[1,4]"],
    });
  });

  it("uses character stats and skills in expressions", () => {
    expect(evaluateDiceExpression("力量+侦查-幸运", testCharacter)).toEqual({
      total: 45,
      details: [],
    });
  });

  it("rejects unsafe expressions", () => {
    expect(evaluateDiceExpression("1d6;alert(1)", testCharacter)).toEqual({
      total: 0,
      details: ["表达式错误"],
    });
  });
});
