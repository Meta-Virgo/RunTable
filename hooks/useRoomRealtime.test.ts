import { describe, expect, it } from "vitest";
import { isKickMessageForUser } from "./useRoomRealtime";

describe("room realtime kick messages", () => {
  it("matches kick system messages for the kicked user only", () => {
    const message = {
      type: "system",
      meta: {
        type: "kick",
        userId: "player-1",
      },
    };

    expect(isKickMessageForUser(message, "player-1")).toBe(true);
    expect(isKickMessageForUser(message, "player-2")).toBe(false);
  });

  it("ignores non-kick messages and malformed metadata", () => {
    expect(
      isKickMessageForUser(
        { type: "system", meta: { type: "join", userId: "player-1" } },
        "player-1"
      )
    ).toBe(false);
    expect(
      isKickMessageForUser({ type: "chat", meta: { userId: "player-1" } }, "player-1")
    ).toBe(false);
  });
});
