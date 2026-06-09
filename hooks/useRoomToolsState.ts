import { useEffect, useRef, useState } from "react";
import type { RoomClue } from "../services/clueWall";
import type { RoomInvite, RoomSchedule } from "../services/invitations";
import type {
  KeeperPersonaKind,
  KeeperPersonaTemplate,
} from "../services/keeperToolbox";
import {
  buildPersistedRoomToolsState,
  getRoomToolsStorageKey,
  parsePersistedRoomToolsState,
  nowIso,
  parseTags,
  toLocalDateTimeValue,
} from "../services/roomToolsModel";
import type { SessionCharacterSnapshot } from "../services/sessionSnapshots";

export { nowIso, parseTags, toLocalDateTimeValue };

export type RoomToolsTab =
  | "report"
  | "clues"
  | "invite"
  | "snapshots"
  | "toolbox";

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
  const [snapshots, setSnapshots] = useState<SessionCharacterSnapshot[]>([]);
  const [personaName, setPersonaName] = useState("");
  const [personaKind, setPersonaKind] = useState<KeeperPersonaKind>("npc");
  const [personaDescription, setPersonaDescription] = useState("");
  const [personaLine, setPersonaLine] = useState("");
  const [personas, setPersonas] = useState<KeeperPersonaTemplate[]>([]);
  const [batchReason, setBatchReason] = useState("");
  const [batchTargets, setBatchTargets] = useState("");
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
      setSnapshots(parsed.snapshots);
      setPersonas(parsed.personas);
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
      snapshots,
      personas,
    });
    localStorage.setItem(
      getRoomToolsStorageKey(roomId),
      JSON.stringify(payload)
    );
  }, [clues, invite, personas, roomId, schedule, snapshots]);

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
    snapshots,
    setSnapshots,
    personaName,
    setPersonaName,
    personaKind,
    setPersonaKind,
    personaDescription,
    setPersonaDescription,
    personaLine,
    setPersonaLine,
    personas,
    setPersonas,
    batchReason,
    setBatchReason,
    batchTargets,
    setBatchTargets,
  };
}
