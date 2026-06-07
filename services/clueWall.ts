import type { RoomMemberRole, RoomMemberStatus } from "./roomAuthority";

export type ClueVisibility = "hidden" | "revealed";
export type ClueStatus = "active" | "deleted";
export type EvidenceVisibility = "public" | "keeper";
export type EvidenceType = "message" | "image" | "report" | "character_note";

export interface ClueEvidenceLink {
  id: string;
  type: EvidenceType;
  sourceId: string;
  visibility: EvidenceVisibility;
  label: string;
}

export interface RoomClue {
  id: string;
  roomId: string;
  title: string;
  body: string;
  tags: string[];
  visibility: ClueVisibility;
  status: ClueStatus;
  keeperNote: string | null;
  evidenceLinks: ClueEvidenceLink[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClueViewer {
  role: RoomMemberRole;
  status: RoomMemberStatus;
}

export interface VisibleRoomClue extends Omit<RoomClue, "keeperNote"> {
  keeperNote: string | null;
}

export function createClue(input: {
  id: string;
  roomId: string;
  title: string;
  body: string;
  tags?: string[];
  keeperNote?: string | null;
  createdByUserId: string;
  now: string;
}): RoomClue {
  return {
    id: input.id,
    roomId: input.roomId,
    title: input.title,
    body: input.body,
    tags: input.tags || [],
    visibility: "hidden",
    status: "active",
    keeperNote: input.keeperNote || null,
    evidenceLinks: [],
    createdByUserId: input.createdByUserId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function updateClue(
  clue: RoomClue,
  updates: Partial<
    Pick<RoomClue, "title" | "body" | "tags" | "visibility" | "keeperNote">
  > & {
    now: string;
  }
): RoomClue {
  const { now, ...rest } = updates;
  return {
    ...clue,
    ...rest,
    updatedAt: now,
  };
}

export function deleteClue(clue: RoomClue, now: string): RoomClue {
  return { ...clue, status: "deleted", updatedAt: now };
}

export function linkClueToEvidence(
  clue: RoomClue,
  evidence: ClueEvidenceLink
): RoomClue {
  return {
    ...clue,
    evidenceLinks: [...clue.evidenceLinks, evidence],
  };
}

export function listVisibleClues(
  clues: RoomClue[],
  viewer: ClueViewer
): VisibleRoomClue[] {
  if (viewer.status !== "active") return [];

  const isKeeper = viewer.role === "keeper";

  return clues
    .filter((clue) => clue.status === "active")
    .filter((clue) => isKeeper || clue.visibility === "revealed")
    .map((clue) => ({
      ...clue,
      keeperNote: isKeeper ? clue.keeperNote : null,
      evidenceLinks: clue.evidenceLinks.filter(
        (link) => isKeeper || link.visibility === "public"
      ),
    }));
}
