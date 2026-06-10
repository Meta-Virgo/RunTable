import { describe, expect, it } from "vitest";
import {
  applyLobbyCatalogRoomChange,
  buildLobbyCatalogRooms,
  filterLobbyCatalogRooms,
  getLobbyCharacterRoomIds,
  sortLobbyCatalogRooms,
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
  it("marks zombie and archived rooms and sorts active rooms first by default", () => {
    const active = room({ id: "active", room_number: 20 });
    const zombie = room({
      id: "zombie",
      room_number: 1,
      created_at: "2026-06-07T00:00:00.000Z",
      last_active_at: "2026-06-08T22:00:00.000Z",
    });
    const archived = room({
      id: "archived",
      room_number: 10,
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
      memberUserIds: new Map([
        ["active", ["keeper-1", "player-1"]],
        ["zombie", ["keeper-1"]],
      ]),
      now,
    });

    expect(processed.map((item) => item.id)).toEqual([
      "active",
      "archived",
      "zombie",
    ]);
    expect(processed.find((item) => item.id === "zombie")?.isZombie).toBe(true);
    expect(processed.find((item) => item.id === "zombie")?.characterCount).toBe(
      1
    );
    expect(processed.find((item) => item.id === "zombie")?.messageCount).toBe(2);
    expect(processed.find((item) => item.id === "active")?.activeMemberCount).toBe(
      2
    );
    expect(processed.find((item) => item.id === "active")?.activeMemberIds).toEqual(
      ["keeper-1", "player-1"]
    );
    expect(processed.find((item) => item.id === "archived")?.isArchived).toBe(
      true
    );
  });

  it("can sort visible rooms by room number", () => {
    const rooms = [
      room({ id: "active", room_number: 20, isZombie: false }),
      room({ id: "archived", room_number: 10, isZombie: false }),
      room({ id: "zombie", room_number: 1, isZombie: true }),
    ];

    expect(
      sortLobbyCatalogRooms(rooms, "room_number").map((item) => item.id)
    ).toEqual(["archived", "active", "zombie"]);
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
        room_number: 20,
        last_active_at: "2026-06-08T23:30:00.000Z",
      }),
    ];

    const inserted = applyLobbyCatalogRoomChange({
      rooms: current,
      eventType: "INSERT",
      newRoom: room({
        id: "newer",
        room_number: 10,
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
