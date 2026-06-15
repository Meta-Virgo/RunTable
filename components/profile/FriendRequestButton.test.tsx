import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../../types";
import { FriendRequestButton } from "./FriendRequestButton";

const profile = {
  id: "user-target",
  nickname: "Tang",
  created_at: "2026-06-01T00:00:00.000Z",
} satisfies Profile;

describe("FriendRequestButton", () => {
  it("renders an add friend action for other profiles", () => {
    const html = renderToStaticMarkup(
      <FriendRequestButton
        compact
        currentUserId="user-current"
        profile={profile}
        onRequestFriend={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="申请好友"');
    expect(html).not.toContain(">申请好友<");
  });

  it("hides itself for the current user's own profile", () => {
    const html = renderToStaticMarkup(
      <FriendRequestButton
        currentUserId="user-target"
        profile={profile}
        onRequestFriend={vi.fn()}
      />
    );

    expect(html).not.toContain("申请好友");
  });

  it("shows accepted friendship state without another request action", () => {
    const html = renderToStaticMarkup(
      <FriendRequestButton
        currentUserId="user-current"
        profile={profile}
        isFriend
        onRequestFriend={vi.fn()}
      />
    );

    expect(html).toContain("已是好友");
    expect(html).not.toContain("申请好友");
  });
});
