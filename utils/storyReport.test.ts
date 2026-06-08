import { describe, expect, it } from "vitest";
import type { Log } from "../types";
import { buildSessionReport } from "./storyReport";

const baseLog = (overrides: Partial<Log>): Log => ({
  id: overrides.id || "log",
  timestamp: overrides.timestamp || "12:00",
  createdAt: overrides.createdAt || "2026-06-07T12:00:00.000Z",
  charId: overrides.charId || "char-1",
  charName: overrides.charName || "Alice",
  charRole: overrides.charRole || "Investigator",
  type: overrides.type || "normal",
  content: overrides.content || "hello",
  recipientId: overrides.recipientId,
});

describe("session report generation", () => {
  it("builds public and keeper-only sections without leaking private or secret logs", () => {
    const report = buildSessionReport([
      baseLog({ id: "2", createdAt: "2026-06-07T12:02:00.000Z", type: "dice", content: JSON.stringify({ total: 41, details: [41], checkName: "Spot Hidden" }) }),
      baseLog({ id: "1", createdAt: "2026-06-07T12:01:00.000Z", content: "The door opens." }),
      baseLog({ id: "3", createdAt: "2026-06-07T12:03:00.000Z", type: "dice_secret", content: JSON.stringify({ total: 88, details: [88], checkName: "Hidden cultist" }) }),
      baseLog({ id: "4", createdAt: "2026-06-07T12:04:00.000Z", recipientId: "player-2", content: "private whisper" }),
      baseLog({ id: "5", createdAt: "2026-06-07T12:05:00.000Z", type: "image", content: "https://example.com/handout.png" }),
    ]);

    expect(report.publicTimeline.map((entry) => entry.logId)).toEqual([
      "1",
      "2",
      "5",
    ]);
    expect(report.publicMarkdown).toContain("06/07 20:01 Alice The door opens.");
    expect(report.publicMarkdown).toContain("Alice Spot Hidden检定：1D100 = 41");
    expect(report.publicMarkdown).toContain("Alice 展示图片：https://example.com/handout.png");
    expect(report.publicMarkdown).not.toContain("private whisper");
    expect(report.publicMarkdown).not.toContain("Hidden cultist");
    expect(report.keeperOnlyMarkdown).toContain("Alice 暗骰：Hidden cultist检定");
    expect(report.keeperOnlyMarkdown).toContain("Hidden cultist");
  });
});
