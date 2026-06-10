import type { RoomClue } from "./clueWall";
import type { RoomInvite, RoomSchedule } from "./invitations";

export interface PersistedRoomToolsState {
  clues: RoomClue[];
  invite: RoomInvite | null;
  schedule: RoomSchedule | null;
}

export function getRoomToolsStorageKey(roomId: string) {
  return `runtable-room-tools:${roomId}`;
}

export function buildEmptyRoomToolsState(): PersistedRoomToolsState {
  return {
    clues: [],
    invite: null,
    schedule: null,
  };
}

export function parsePersistedRoomToolsState(raw: string | null) {
  if (!raw) return buildEmptyRoomToolsState();

  const parsed = JSON.parse(raw) as Partial<PersistedRoomToolsState>;
  return {
    clues: parsed.clues || [],
    invite: parsed.invite || null,
    schedule: parsed.schedule || null,
  };
}

export function buildPersistedRoomToolsState(
  state: PersistedRoomToolsState
): PersistedRoomToolsState {
  return {
    clues: state.clues,
    invite: state.invite,
    schedule: state.schedule,
  };
}

export const nowIso = () => new Date().toISOString();

export const toLocalDateTimeValue = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const parseTags = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
