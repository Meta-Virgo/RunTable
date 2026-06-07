import { describe, expect, it } from "vitest";
import {
  createClue,
  deleteClue,
  linkClueToEvidence,
  listVisibleClues,
  updateClue,
} from "./clueWall";

describe("clue wall visibility and lifecycle", () => {
  it("lets keepers manage clues while players only see revealed content", () => {
    const created = createClue({
      id: "clue-1",
      roomId: "room-1",
      title: "Bloody key",
      body: "Found near the stairs",
      tags: ["item"],
      keeperNote: "It belongs to the butler",
      createdByUserId: "keeper-1",
      now: "2026-06-07T12:00:00.000Z",
    });

    expect(listVisibleClues([created], { role: "player", status: "active" })).toEqual([]);

    const revealed = updateClue(created, {
      visibility: "revealed",
      tags: ["item", "mansion"],
      now: "2026-06-07T12:01:00.000Z",
    });

    expect(listVisibleClues([revealed], { role: "player", status: "active" })).toEqual([
      expect.objectContaining({
        title: "Bloody key",
        keeperNote: null,
        tags: ["item", "mansion"],
      }),
    ]);
    expect(listVisibleClues([revealed], { role: "keeper", status: "active" })[0].keeperNote).toBe(
      "It belongs to the butler"
    );
    expect(deleteClue(revealed, "2026-06-07T12:02:00.000Z").status).toBe("deleted");
  });

  it("does not leak private evidence links to players", () => {
    const clue = updateClue(
      createClue({
        id: "clue-1",
        roomId: "room-1",
        title: "Photo",
        body: "A marked photograph",
        createdByUserId: "keeper-1",
        now: "2026-06-07T12:00:00.000Z",
      }),
      { visibility: "revealed", now: "2026-06-07T12:01:00.000Z" }
    );

    const linked = linkClueToEvidence(clue, {
      id: "evidence-1",
      type: "message",
      sourceId: "msg-1",
      visibility: "keeper",
      label: "secret message",
    });

    expect(listVisibleClues([linked], { role: "player", status: "active" })[0].evidenceLinks).toEqual([]);
    expect(listVisibleClues([linked], { role: "keeper", status: "active" })[0].evidenceLinks).toHaveLength(1);
  });
});
