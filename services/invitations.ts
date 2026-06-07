export type InviteVisibility = "link" | "friends" | "members";

export interface RoomInvite {
  id: string;
  roomId: string;
  createdByUserId: string;
  visibility: InviteVisibility;
  allowedRecipientUserIds: string[];
  createdAt: string;
  decision: string;
}

export interface RoomSchedule {
  roomId: string;
  startsAt: string;
  note: string | null;
}

export function createRoomInvite(input: {
  id: string;
  roomId: string;
  createdByUserId: string;
  visibility: InviteVisibility;
  allowedRecipientUserIds?: string[];
  now: string;
}): RoomInvite {
  return {
    id: input.id,
    roomId: input.roomId,
    createdByUserId: input.createdByUserId,
    visibility: input.visibility,
    allowedRecipientUserIds: input.allowedRecipientUserIds || [],
    createdAt: input.now,
    decision: `Invite visibility is ${input.visibility}; recipients are limited by the stored allow-list when present.`,
  };
}

export function createRoomSchedule(input: RoomSchedule): RoomSchedule {
  return { ...input };
}

export function getVisibleInviteSummary(
  invite: RoomInvite,
  schedule: RoomSchedule | null,
  viewerUserId: string
) {
  const isAllowed =
    invite.visibility === "link" ||
    invite.createdByUserId === viewerUserId ||
    invite.allowedRecipientUserIds.includes(viewerUserId);

  if (!isAllowed) return null;

  const start = schedule ? ` Starts at ${schedule.startsAt}.` : "";
  const note = schedule?.note ? ` ${schedule.note}` : "";
  return `Room invite ${invite.id}.${start}${note}`.trim();
}
