import { describe, expect, it } from "vitest";
import type { Character, Log, ModuleInfo } from "../types";
import { buildContext } from "./ai";

const moduleInfo: ModuleInfo = {
  title: "黑水镇",
  description: "雨夜里的小镇。",
  notes: "井下有秘密。",
};

const character = (overrides: Partial<Character> = {}): Character => ({
  id: "char-1",
  name: "林",
  role: "调查员",
  type: "investigator",
  job: "记者",
  age: "28",
  sex: "女",
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 50,
  pow: 50,
  edu: 50,
  luck: 50,
  hp: 9,
  san: 43,
  mp: 8,
  notes: "",
  backstory: "",
  skills: {},
  isOnline: true,
  ...overrides,
});

const log = (overrides: Partial<Log> = {}): Log => ({
  id: "log-1",
  timestamp: "10:00",
  createdAt: "2026-06-24T10:00:00.000Z",
  charId: "char-1",
  charName: "林",
  charRole: "调查员",
  type: "normal",
  content: "我推开门。",
  ...overrides,
});

describe("AI context", () => {
  it("includes compact character vitals and tagged log visibility", () => {
    const { context } = buildContext(
      moduleInfo,
      [
        log(),
        log({
          id: "log-2",
          type: "dice_secret",
          content: JSON.stringify({ count: 1, type: 100, total: 87 }),
        }),
        log({ id: "log-3", recipientId: "keeper-1", content: "只告诉 KP。" }),
      ],
      [character()]
    );

    expect(context).toContain("林 (调查员, investigator) / HP 9 / SAN 43 / MP 8");
    expect(context).toContain("[公开] 林: 我推开门。");
    expect(context).toContain("[公开/暗骰] 林: [投骰] 1D100: 87");
    expect(context).toContain("[私聊] 林: 只告诉 KP。");
  });

  it("clips long log content and replaces image payloads", () => {
    const { context } = buildContext(
      moduleInfo,
      [
        log({ content: "a".repeat(700) }),
        log({ id: "image", type: "image", content: "data:image/png;base64,huge" }),
      ],
      [character()]
    );

    expect(context).toContain(`${"a".repeat(600)}...`);
    expect(context).toContain("[公开] 林: [图片]");
    expect(context).not.toContain("data:image/png;base64");
  });
});
