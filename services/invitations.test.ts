import { describe, expect, it } from "vitest";
import { createRoomInvite, createRoomSchedule, getVisibleInviteSummary } from "./invitations";

describe("room invitations and scheduling foundations", () => {
  it("records invite visibility decisions and schedule metadata", () => {
    const invite = createRoomInvite({
      id: "invite-1",
      roomId: "room-1",
      createdByUserId: "keeper-1",
      visibility: "friends",
      allowedRecipientUserIds: ["player-1"],
      now: "2026-06-07T12:00:00.000Z",
    });
    const schedule = createRoomSchedule({
      roomId: "room-1",
      startsAt: "2026-06-08T12:00:00.000Z",
      note: "Bring investigators",
    });

    expect(invite.decision).toContain("friends");
    expect(getVisibleInviteSummary(invite, schedule, "player-1")).toContain("2026-06-08");
    expect(getVisibleInviteSummary(invite, schedule, "stranger")).toBeNull();
  });
});
