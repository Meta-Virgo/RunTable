import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RoomTools } from "./RoomTools";

describe("RoomTools", () => {
  it("renders real room tool entry points for keepers", () => {
    const html = renderToStaticMarkup(
      <RoomTools
        roomId="room-1"
        isKP
        userId="keeper-1"
        logs={[]}
        onDeleteRoom={vi.fn()}
        onClearChat={vi.fn()}
        onConcludeGame={vi.fn()}
      />
    );

    expect(html).toContain("战报");
    expect(html).toContain("线索墙");
    expect(html).toContain("邀请排期");
    expect(html).toContain("跑团管理");
    expect(html).not.toContain("角色快照");
    expect(html).not.toContain("KP工具");
  });

  it("hides Keeper-only management from players", () => {
    const html = renderToStaticMarkup(
      <RoomTools
        roomId="room-1"
        isKP={false}
        userId="player-1"
        logs={[]}
        onDeleteRoom={vi.fn()}
        onClearChat={vi.fn()}
        onConcludeGame={vi.fn()}
      />
    );

    expect(html).toContain("线索墙");
    expect(html).not.toContain("角色快照");
    expect(html).not.toContain("跑团管理");
    expect(html).not.toContain("KP工具");
  });
});
