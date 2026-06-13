import { describe, expect, it } from "vitest";
import {
  buildRoomInviteUrl,
  getTotalSocialMessageBadgeCount,
  parseRoomInviteToken,
} from "./socialMessages";

describe("social message helpers", () => {
  it("builds and parses room invite links", () => {
    const url = buildRoomInviteUrl("https://runtable.example/home", "token-1");

    expect(url).toBe("https://runtable.example/home?room_invite=token-1");
    expect(parseRoomInviteToken(new URL(url).search)).toBe("token-1");
  });

  it("combines direct unread and pending invitation badges", () => {
    expect(
      getTotalSocialMessageBadgeCount({
        unread_direct_count: 2,
        pending_room_invitation_count: 3,
      })
    ).toBe(5);
    expect(getTotalSocialMessageBadgeCount(null)).toBe(0);
  });
});
