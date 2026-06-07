import { describe, expect, it } from "vitest";
import type { Character } from "../types";
import { createSessionSnapshots, listVisibleSnapshots } from "./sessionSnapshots";

const character = (id: string, userId: string): Character =>
  ({
    id,
    user_id: userId,
    room_id: "room-1",
    name: id,
    role: "Investigator",
    type: "investigator",
    job: "",
    age: "",
    sex: "",
    str: 50,
    con: 50,
    siz: 50,
    dex: 50,
    app: 50,
    int: 50,
    pow: 50,
    edu: 50,
    luck: 50,
    hp: 8,
    san: 44,
    mp: 9,
    notes: "session notes",
    backstory: "",
    skills: {},
    items: [{ name: "Lantern", quantity: 1 }],
  }) as Character;

describe("session character snapshots", () => {
  it("captures end-of-session state and limits player access to their own snapshots", () => {
    const snapshots = createSessionSnapshots({
      roomId: "room-1",
      sessionId: "session-1",
      endedAt: "2026-06-07T13:00:00.000Z",
      characters: [character("char-1", "player-1"), character("char-2", "player-2")],
      activeMemberUserIds: new Set(["player-1", "player-2"]),
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].snapshot.hp).toBe(8);
    expect(snapshots[0].snapshot.items?.[0].name).toBe("Lantern");
    expect(listVisibleSnapshots(snapshots, { role: "player", userId: "player-1" })).toHaveLength(1);
    expect(listVisibleSnapshots(snapshots, { role: "keeper", userId: "keeper-1" })).toHaveLength(2);
  });
});
