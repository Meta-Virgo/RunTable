import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../../types";
import { SquareProfileModal } from "./SquareProfileModal";

vi.mock("../UI", async () => {
  const actual = await vi.importActual<typeof import("../UI")>("../UI");
  return {
    ...actual,
    Modal: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

const profile = {
  id: "user-target",
  nickname: "tangzhuohan",
  user_code: 10606,
  bio: null,
  created_at: "2026-06-01T00:00:00.000Z",
  level: 7,
} satisfies Profile;

describe("SquareProfileModal", () => {
  it("shows an add friend action for other users", () => {
    const html = renderToStaticMarkup(
      <SquareProfileModal
        isOpen
        profile={profile}
        currentUserId="user-current"
        historyTab="player"
        setHistoryTab={vi.fn()}
        historyLoading={false}
        kpHistory={[]}
        playerHistory={[]}
        onRequestFriend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("tangzhuohan");
    expect(html).toContain("UID: 10606");
    expect(html).toContain("申请好友");
  });

  it("does not show add friend action on own profile", () => {
    const html = renderToStaticMarkup(
      <SquareProfileModal
        isOpen
        profile={profile}
        currentUserId="user-target"
        historyTab="player"
        setHistoryTab={vi.fn()}
        historyLoading={false}
        kpHistory={[]}
        playerHistory={[]}
        onRequestFriend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).not.toContain("申请好友");
  });
});
