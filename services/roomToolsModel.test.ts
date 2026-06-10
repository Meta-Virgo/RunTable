import { describe, expect, it } from "vitest";
import {
  buildEmptyRoomToolsState,
  buildPersistedRoomToolsState,
  getRoomToolsStorageKey,
  parsePersistedRoomToolsState,
  parseTags,
  toLocalDateTimeValue,
} from "./roomToolsModel";

describe("room tools model", () => {
  it("builds stable storage keys and empty state", () => {
    expect(getRoomToolsStorageKey("room-1")).toBe(
      "runtable-room-tools:room-1"
    );
    expect(buildEmptyRoomToolsState()).toEqual({
      clues: [],
      invite: null,
      schedule: null,
    });
  });

  it("normalizes persisted state", () => {
    expect(parsePersistedRoomToolsState(null)).toEqual(
      buildEmptyRoomToolsState()
    );
    expect(
      parsePersistedRoomToolsState(
        JSON.stringify({
          clues: [{ id: "clue-1" }],
        })
      )
    ).toMatchObject({
      clues: [{ id: "clue-1" }],
      invite: null,
      schedule: null,
    });
  });

  it("builds the persisted payload from state", () => {
    expect(
      buildPersistedRoomToolsState({
        clues: [{ id: "clue-1" }] as any,
        invite: { id: "invite-1" } as any,
        schedule: { roomId: "room-1" } as any,
      })
    ).toMatchObject({
      clues: [{ id: "clue-1" }],
      invite: { id: "invite-1" },
      schedule: { roomId: "room-1" },
    });
  });

  it("parses tags and local datetime values", () => {
    expect(parseTags("mansion, clue  danger")).toEqual([
      "mansion",
      "clue",
      "danger",
    ]);
    expect(toLocalDateTimeValue(new Date("2026-06-09T10:30:00.000Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    );
  });
});
