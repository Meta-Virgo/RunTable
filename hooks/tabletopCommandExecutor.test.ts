import { describe, expect, it } from "vitest";
import { createTabletopCommandExecutor } from "../services/tabletopCommandExecutor";
import type { Character, Log } from "../types";

const investigator = {
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
  stats: {
    str: 60,
    hp: 10,
    san: 50,
    mp: 10,
  },
} satisfies Character;

const createExecutorHarness = (
  context: {
    characters?: Character[];
    activeCharId?: string;
    isKP?: boolean;
  } = {}
) => {
  const logs: Array<{
    type: Log["type"];
    content: string;
    customCharId?: string;
    recipientId?: string | null;
    meta?: Record<string, any>;
  }> = [];
  const savedStats: Array<{ characterId: string; stats: Record<string, any> }> =
    [];
  const scheduled: Array<() => void> = [];

  const executor = createTabletopCommandExecutor({
    getContext: () => ({
      characters: context.characters || [investigator],
      activeCharId: context.activeCharId || "char-1",
      isKP: context.isKP || false,
    }),
    addLog: async (type, content, customCharId, recipientId, meta) => {
      logs.push({ type, content, customCharId, recipientId, meta });
    },
    saveCharacterStats: async (characterId, stats) => {
      savedStats.push({ characterId, stats });
      return { error: null };
    },
    random: () => 0.09,
    schedule: (callback) => {
      scheduled.push(callback);
    },
  });

  return {
    executor,
    logs,
    savedStats,
    runScheduled: async () => {
      for (const callback of scheduled) {
        callback();
      }
      await Promise.resolve();
    },
  };
};

describe("tabletop command executor", () => {
  it("sends regular chat through the log adapter", async () => {
    const { executor, logs } = createExecutorHarness();

    await executor.handleSend("我要调查门锁", "keeper-1", "normal", {
      id: "log-1",
      content: "旧消息",
      charName: "Keeper",
    });

    expect(logs).toEqual([
      {
        type: "normal",
        content: "我要调查门锁",
        customCharId: undefined,
        recipientId: "keeper-1",
        meta: {
          quote: {
            id: "log-1",
            content: "旧消息",
            charName: "Keeper",
          },
        },
      },
    ]);
  });

  it("blocks hidden rolls for non-keeper users", async () => {
    const { executor, logs } = createExecutorHarness({ isKP: false });

    await executor.handleSend(".rh 灵感");

    expect(logs).toEqual([
      expect.objectContaining({
        type: "system",
        content: "只有守秘人可以使用暗骰 (.rh)",
      }),
    ]);
  });

  it("executes skill checks against character skills and modifiers", async () => {
    const { executor, logs } = createExecutorHarness();

    await executor.handleSend(".ra 侦查 +10");

    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("dice");
    expect(logs[0].customCharId).toBe("char-1");
    expect(JSON.parse(logs[0].content)).toMatchObject({
      count: 1,
      type: 100,
      total: 10,
      details: [10],
      checkName: "侦查 +10",
      checkTarget: 55,
      checkResult: "success",
    });
  });

  it("persists stat updates and logs the resulting change", async () => {
    const { executor, logs, savedStats } = createExecutorHarness();

    await executor.handleSend(".st hp-2 san+1");

    expect(savedStats).toEqual([
      {
        characterId: "char-1",
        stats: expect.objectContaining({
          hp: 8,
          san: 51,
        }),
      },
    ]);
    expect(logs).toEqual([
      expect.objectContaining({
        type: "system",
        content: "[Lin] 属性变更: HP 10 -> 8, SAN 50 -> 51",
      }),
    ]);
  });

  it("schedules sanity follow-up logs and stat loss updates", async () => {
    const { executor, logs, savedStats, runScheduled } = createExecutorHarness();

    await executor.handleSend(".sc 1/1d4 50");
    expect(logs[0]).toEqual(
      expect.objectContaining({
        type: "dice",
        customCharId: "char-1",
      })
    );

    await runScheduled();

    expect(logs[1]).toEqual(
      expect.objectContaining({
        type: "system",
        content: "[Lin] SC成功! 减少 1 点理智，当前 SAN: 49",
      })
    );
    expect(savedStats).toEqual([
      {
        characterId: "char-1",
        stats: expect.objectContaining({
          san: 49,
        }),
      },
    ]);
  });
});
