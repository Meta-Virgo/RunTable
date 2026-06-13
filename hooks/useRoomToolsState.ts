import { useEffect, useRef, useState } from "react";
import type { RoomClue } from "../services/clueWall";
import type { RoomInvite, RoomSchedule } from "../services/invitations";
import {
  buildPersistedRoomToolsState,
  getRoomToolsStorageKey,
  parsePersistedRoomToolsState,
  nowIso,
  parseTags,
  toLocalDateTimeValue,
} from "../services/roomToolsModel";

export { nowIso, parseTags, toLocalDateTimeValue };

export type RoomToolsTab =
  | "report"
  | "clues"
  | "invite"
  | "share"
  | "management";

export function useRoomToolsState(roomId: string) {
  const [activeTab, setActiveTab] = useState<RoomToolsTab>("report");
  const [clues, setClues] = useState<RoomClue[]>([]);
  const [clueTitle, setClueTitle] = useState("");
  const [clueBody, setClueBody] = useState("");
  const [clueTags, setClueTags] = useState("");
  const [keeperNote, setKeeperNote] = useState("");
  const [invite, setInvite] = useState<RoomInvite | null>(null);
  const [schedule, setSchedule] = useState<RoomSchedule | null>(null);
  const [startsAt, setStartsAt] = useState(() =>
    toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [scheduleNote, setScheduleNote] = useState("");
  const hasHydrated = useRef(false);

  useEffect(() => {
    hasHydrated.current = false;
    try {
      const parsed = parsePersistedRoomToolsState(
        localStorage.getItem(getRoomToolsStorageKey(roomId))
      );
      setClues(parsed.clues);
      setInvite(parsed.invite);
      setSchedule(parsed.schedule);
    } catch (error) {
      console.warn("Failed to load room tools state", error);
    } finally {
      hasHydrated.current = true;
    }
  }, [roomId]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    const payload = buildPersistedRoomToolsState({
      clues,
      invite,
      schedule,
    });
    localStorage.setItem(
      getRoomToolsStorageKey(roomId),
      JSON.stringify(payload)
    );
  }, [clues, invite, roomId, schedule]);

  return {
    activeTab,
    setActiveTab,
    clues,
    setClues,
    clueTitle,
    setClueTitle,
    clueBody,
    setClueBody,
    clueTags,
    setClueTags,
    keeperNote,
    setKeeperNote,
    invite,
    setInvite,
    schedule,
    setSchedule,
    startsAt,
    setStartsAt,
    scheduleNote,
    setScheduleNote,
  };
}
