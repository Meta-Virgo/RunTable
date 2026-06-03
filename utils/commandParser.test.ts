import { describe, expect, it } from "vitest";
import { parseDiceCommand } from "./commandParser";

describe("parseDiceCommand", () => {
  it("parses normal and hidden roll commands", () => {
    expect(parseDiceCommand(".r 2d6 开锁")).toEqual({
      type: "roll",
      payload: {
        expression: "2d6",
        reason: "开锁",
      },
    });

    expect(parseDiceCommand(".rh 灵感")).toEqual({
      type: "roll_hidden",
      payload: {
        expression: "1d100",
        reason: "灵感",
      },
    });
  });

  it("parses Chinese full stop commands", () => {
    expect(parseDiceCommand("。ra 力量 +10")).toEqual({
      type: "check",
      payload: {
        skill: "力量",
        modifier: "+10",
      },
    });
  });

  it("parses sanity checks and stat updates", () => {
    expect(parseDiceCommand(".sc 1/1d4 50")).toEqual({
      type: "sanity",
      payload: {
        success: "1",
        failure: "1d4",
        value: 50,
      },
    });

    expect(parseDiceCommand(".st hp-1 san+2")).toEqual({
      type: "set",
      payload: [
        { stat: "hp", type: "-", value: 1 },
        { stat: "san", type: "+", value: 2 },
      ],
    });
  });

  it("ignores regular chat messages", () => {
    expect(parseDiceCommand("我要调查门锁")).toBeNull();
  });
});
