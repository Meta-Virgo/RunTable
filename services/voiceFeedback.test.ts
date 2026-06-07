import { describe, expect, it } from "vitest";
import { buildVoiceParticipantFeedback, getVoiceConnectionFeedback } from "./voiceFeedback";

describe("voice room participant feedback", () => {
  it("maps connection states to actionable user feedback", () => {
    expect(getVoiceConnectionFeedback("reconnecting").message).toContain("Reconnecting");
    expect(getVoiceConnectionFeedback("error", "Token expired").message).toContain("Token expired");
  });

  it("keeps voice participant state tied to active room membership", () => {
    expect(
      buildVoiceParticipantFeedback({
        members: [
          { userId: "keeper-1", displayName: "Keeper", role: "keeper", status: "active" },
          { userId: "player-1", displayName: "Alice", role: "player", status: "active" },
          { userId: "left-1", displayName: "Old", role: "player", status: "left" },
        ],
        connectedUserIds: new Set(["keeper-1"]),
      })
    ).toEqual([
      expect.objectContaining({ userId: "keeper-1", connectionState: "connected" }),
      expect.objectContaining({ userId: "player-1", connectionState: "disconnected" }),
    ]);
  });
});
