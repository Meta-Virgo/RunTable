import { Dispatch, SetStateAction, useMemo } from "react";
import { Character, Log } from "../types";
import {
  createCharacter,
  deleteCharacter as deleteCharacterRecord,
  fetchCharacterById,
  updateCharacter,
  updateCharacterStats as saveCharacterStats,
} from "../services/characters";
import {
  createCharacterLifecycleExecutor,
  type CharacterLifecycleActionResult,
} from "../services/characterLifecycle";

type AddLog = (
  type: Log["type"],
  content: string,
  customCharId?: string,
  recipientId?: string | null,
  meta?: Record<string, any>
) => Promise<void>;

type RoomCharacterActionResult = CharacterLifecycleActionResult;

interface UseRoomCharacterActionsOptions {
  currentRoomId: string | null;
  userId?: string;
  characters: Character[];
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setActiveCharId: Dispatch<SetStateAction<string>>;
  addLog: AddLog;
}

export function useRoomCharacterActions({
  currentRoomId,
  userId,
  characters,
  setCharacters,
  setActiveCharId,
  addLog,
}: UseRoomCharacterActionsOptions): {
  duplicateCharacter: (
    character: Character
  ) => Promise<RoomCharacterActionResult>;
  saveRoomCharacter: (
    character: Character,
    editingCharacter: Character | null
  ) => Promise<RoomCharacterActionResult>;
  deleteRoomCharacter: (
    characterId: string
  ) => Promise<RoomCharacterActionResult>;
  updateCharacterVitals: (
    characterId: string | null,
    hp: number,
    san: number,
    mp: number
  ) => Promise<RoomCharacterActionResult>;
} {
  return useMemo(
    () =>
      createCharacterLifecycleExecutor({
        getContext: () => ({
          currentRoomId,
          userId,
          characters,
        }),
        repository: {
          createCharacter,
          updateCharacter,
          fetchCharacterById,
          deleteCharacter: deleteCharacterRecord,
          updateCharacterStats: saveCharacterStats,
        },
        localState: {
          replaceCharacters: setCharacters,
          updateActiveCharacter: setActiveCharId,
        },
        addLog,
      }),
    [
      addLog,
      characters,
      currentRoomId,
      setActiveCharId,
      setCharacters,
      userId,
    ]
  );
}
