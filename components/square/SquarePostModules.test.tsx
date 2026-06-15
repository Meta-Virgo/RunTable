import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SquarePostModule } from "../../types";
import { SquarePostModules } from "./SquarePostModules";

describe("Square post modules", () => {
  it("renders character summary and room excerpt cards", () => {
    const modules: SquarePostModule[] = [
      {
        module_type: "character_summary",
        payload: {
          title: "Lin",
          name: "Lin",
          role: "调查员",
          type: "investigator",
          job: "侦探",
          age: "32",
          sex: "女",
          stats: {
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
          },
          top_skills: [{ name: "侦查", value: 70 }],
          skills: [
            { name: "侦查", value: 70 },
            { name: "图书馆使用", value: 80 },
          ],
          backstory: "来自密斯卡托尼克大学。",
          notes: "随身带着旧怀表。",
          items: [{ name: "手电筒", quantity: 1, description: "备用电池" }],
          spells: [{ name: "守护术", quantity: 1 }],
        },
      },
      {
        module_type: "room_log_excerpt",
        payload: {
          title: "古宅门口",
          room_title: "The House",
          entries: [
            {
              id: "log-1",
              at: "2026-06-08T12:00:00.000Z",
              actor: "Lin",
              role: "调查员",
              type: "normal",
              text: "门缓缓打开。",
            },
          ],
        },
      },
    ];

    const html = renderToStaticMarkup(<SquarePostModules modules={modules} />);

    expect(html).toContain("车卡分享");
    expect(html).toContain("只读快照");
    expect(html).toContain("查看档案");
    expect(html).toContain("Lin");
    expect(html).toContain("侦查");
    expect(html).toContain("图书馆使用");
    expect(html).toContain("来自密斯卡托尼克大学");
    expect(html).not.toContain("旧怀表");
    expect(html).not.toContain("手电筒");
    expect(html).not.toContain("守护术");
    expect(html).toContain("跑团片段");
    expect(html).toContain("古宅门口");
    expect(html).toContain("门缓缓打开");
  });
});
