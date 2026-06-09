import { useMemo } from "react";
import { Character, Log } from "../types";
import { updateCharacterStats as saveCharacterStats } from "../services/characters";
import { createTabletopCommandExecutor } from "../services/tabletopCommandExecutor";

type AddLog = (
  type: Log["type"],
  content: string,
  customCharId?: string,
  recipientId?: string | null,
  meta?: Record<string, any>
) => Promise<void>;

interface UseTabletopCommandsOptions {
  characters: Character[];
  activeCharId: string;
  isKP: boolean;
  addLog: AddLog;
  random?: () => number;
}

export function useTabletopCommands({
  characters,
  activeCharId,
  isKP,
  addLog,
  random = Math.random,
}: UseTabletopCommandsOptions) {
  return useMemo(
    () =>
      createTabletopCommandExecutor({
        getContext: () => ({
          characters,
          activeCharId,
          isKP,
        }),
        addLog,
        saveCharacterStats,
        random,
      }),
    [activeCharId, addLog, characters, isKP, random]
  );
}
