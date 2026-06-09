import { describe, expect, it } from "vitest";
import {
  applyLobbyCatalogRoomChange,
  buildLobbyCatalogRooms,
  filterLobbyCatalogRooms,
  getLobbyCharacterRoomIds,
  type LobbyRoom,
} from "./lobbyCatalogModel";

const now = new Date("2026-06-09T00:00:00.000Z").getTime();

const room = (overrides: Partial<LobbyRoom> = {}): LobbyRoom => ({
  id: "room-1",
  title: "Haunting",
  description: "classic case",
  status: "open",
  created_at: "2026-06-08T23:00:00.000Z",
  last_active_at: "2026-06-08T23:30:00.000Z",
  kp_id: "keeper-1",
  room_number: 42,
  type: "text",
  ...overrides,
});

describe("lobby catalog model", () => {
  it("marks zombie and archived rooms and sorts active rooms first", () => {
    const active = room({ id: "active" });
    const zombie = room({
      id: "zombie",
      created_at: "2026-06-07T00:00:00.000Z",
      last_active_at: "2026-06-08T22:00:00.000Z",
    });
    const archived = room({
      id: "archived",
      last_active_at: "2026-05-30T00:00:00.000Z",
    });

    const processed = buildLobbyCatalogRooms({
      rooms: [zombie, archived, active],
      activityCounts: new Map([
        ["zombie", { room_id: "zombie", character_count: 1, message_count: 2 }],
        [
          "archived",
          { room_id: "archived", character_count: 3, message_count: 10 },
        ],
      ]),
      now,
    });

    expect(processed.map((item) => item.id)).toEqual([
      "active",
      "archived",
      "zombie",
    ]);
    expect(processed.find((item) => item.id === "zombie")?.isZombie).toBe(true);
    expect(processed.find((item) => item.id === "archived")?.isArchived).toBe(
      true
    );
  });

  it("filters by search text, ownership, creator, online keeper, and archive state", () => {
    const rooms = [
      room({ id: "open", title: "Haunting", isArchived: false }),
      room({ id: "archived", title: "Old", isArchived: true }),
      room({ id: "mine", title: "Mine", kp_id: "keeper-2", isArchived: false }),
    ];

    expect(
      filterLobbyCatalogRooms({
        rooms,
        searchQuery: "",
        roomFilter: "all",
        characterRoomIds: new Set(["mine"]),
        currentUserId: "keeper-1",
        onlineUsers: new Set(["keeper-2"]),
      }).map((item) => item.id)
    ).toEqual(["open", "mine"]);

    expect(
      filterLobbyCatalogRooms({
        rooms,
        searchQuery: "mine",
        roomFilter: "mine",
        characterRoomIds: new Set(["mine"]),
        currentUserId: "keeper-1",
        onlineUsers: new Set(["keeper-2"]),
      }).map((item) => item.id)
    ).toEqual(["mine"]);

    expect(
      filterLobbyCatalogRooms({
        rooms,
        searchQuery: "",
        roomFilter: "created",
        characterRoomIds: new Set(),
        currentUserId: "keeper-1",
        onlineUsers: new Set(["keeper-2"]),
      }).map((item) => item.id)
    ).toEqual(["open", "archived"]);

    expect(
      filterLobbyCatalogRooms({
        rooms,
        searchQuery: "",
        roomFilter: "kp_online",
        characterRoomIds: new Set(),
        currentUserId: "keeper-1",
        onlineUsers: new Set(["keeper-2"]),
      }).map((item) => item.id)
    ).toEqual(["mine"]);
  });

  it("derives owned room ids from character bindings", () => {
    expect(
      Array.from(
        getLobbyCharacterRoomIds([
          { room_id: "room-1" },
          { room_id: null },
          { room_id: "room-2" },
          { room_id: "room-1" },
        ] as any)
      ).sort()
    ).toEqual(["room-1", "room-2"]);
  });

  it("applies realtime room changes through catalog processing", () => {
    const current = [
      room({
        id: "existing",
        last_active_at: "2026-06-08T23:30:00.000Z",
      }),
    ];

    const inserted = applyLobbyCatalogRoomChange({
      rooms: current,
      eventType: "INSERT",
      newRoom: room({
        id: "newer",
        last_active_at: "2026-06-08T23:50:00.000Z",
      }),
      now,
    });

    expect(inserted.map((item) => item.id)).toEqual(["newer", "existing"]);

    const closed = applyLobbyCatalogRoomChange({
      rooms: inserted,
      eventType: "UPDATE",
      newRoom: room({ id: "newer", status: "completed" }),
      now,
    });

    expect(closed.map((item) => item.id)).toEqual(["existing"]);

    const deleted = applyLobbyCatalogRoomChange({
      rooms: closed,
      eventType: "DELETE",
      oldRoom: { id: "existing" },
      now,
    });

    expect(deleted).toEqual([]);
  });
});
