import { Dispatch, SetStateAction, useCallback } from "react";
import { Character, Log } from "../types";
import {
  createCharacter,
  deleteCharacter as deleteCharacterRecord,
  fetchCharacterById,
  updateCharacter,
  updateCharacterStats as saveCharacterStats,
} from "../services/characters";
import { buildCharacterMutationPayload } from "../utils/characterPayload";
import { mapCharacterRow } from "../utils/characterMapper";

type AddLog = (
  type: Log["type"],
  content: string,
  customCharId?: string,
  recipientId?: string | null,
  meta?: Record<string, any>
) => Promise<void>;

interface RoomCharacterActionResult {
  ok: boolean;
  message?: string;
}

interface UseRoomCharacterActionsOptions {
  currentRoomId: string | null;
  userId?: string;
  characters: Character[];
  activeCharId: string;
  setCharacters: Dispatch<SetStateAction<Character[]>>;
  setActiveCharId: Dispatch<SetStateAction<string>>;
  addLog: AddLog;
}

const greekSuffixes = [
  "β",
  "γ",
  "δ",
  "ε",
  "ζ",
  "η",
  "θ",
  "ι",
  "κ",
  "λ",
  "μ",
  "ν",
  "ξ",
  "ο",
  "π",
  "ρ",
  "σ",
  "τ",
  "υ",
  "φ",
  "χ",
  "ψ",
  "ω",
];

const getDuplicateName = (name: string, existingNames: Set<string>) => {
  const suffixRegex = new RegExp(` (${greekSuffixes.join("|")})\\d*$`);
  const match = name.match(suffixRegex);
  const baseName = match ? name.substring(0, match.index) : name;

  for (const suffix of greekSuffixes) {
    const candidate = `${baseName} ${suffix}`;
    if (!existingNames.has(candidate)) return candidate;
  }

  let counter = 2;
  while (counter <= 100) {
    const candidate = `${baseName} ${greekSuffixes[0]}${counter}`;
    if (!existingNames.has(candidate)) return candidate;
    counter++;
  }

  return `${baseName} Copy`;
};

const buildVitalsPayload = (character: Character, hp: number, san: number, mp: number) => ({
  str: character.str,
  con: character.con,
  siz: character.siz,
  dex: character.dex,
  app: character.app,
  int: character.int,
  pow: character.pow,
  edu: character.edu,
  luck: character.luck,
  hp,
  san,
  mp,
  skills: character.skills || {},
});

export function useRoomCharacterActions({
  currentRoomId,
  userId,
  characters,
  activeCharId,
  setCharacters,
  setActiveCharId,
  addLog,
}: UseRoomCharacterActionsOptions) {
  const duplicateCharacter = useCallback(
    async (character: Character): Promise<RoomCharacterActionResult> => {
      if (!currentRoomId || !userId) return { ok: false };

      const name = getDuplicateName(
        character.name,
        new Set(characters.map((item) => item.name))
      );
      const payload = buildCharacterMutationPayload(character, {
        roomId: currentRoomId,
        userId,
        name,
        typeFallback: "monster",
      });

      const { error } = await createCharacter(payload);

      if (error) {
        console.error("复制角色失败:", error);
        return { ok: false, message: "复制失败: " + error.message };
      }

      return { ok: true };
    },
    [characters, currentRoomId, userId]
  );

  const saveRoomCharacter = useCallback(
    async (
      character: Character,
      editingCharacter: Character | null
    ): Promise<RoomCharacterActionResult> => {
      if (!currentRoomId || !userId) return { ok: false };

      const payload = buildCharacterMutationPayload(character, {
        roomId: currentRoomId,
        userId: editingCharacter?.user_id || userId,
        typeFallback: "investigator",
      });

      try {
        if (editingCharacter) {
          const { error } = await updateCharacter(character.id, payload);
          if (error) throw error;

          const { data: latestChar, error: fetchError } =
            await fetchCharacterById(character.id);

          if (latestChar && !fetchError) {
            const mappedLatest = mapCharacterRow({
              ...character,
              ...latestChar,
            });
            setCharacters((prev) =>
              prev.map((item) =>
                item.id === character.id ? mappedLatest : item
              )
            );
          } else {
            setCharacters((prev) =>
              prev.map((item) =>
                item.id === character.id ? { ...character, ...payload } : item
              )
            );
          }
        } else {
          const { data, error } = await createCharacter(payload);
          if (error) throw error;

          if (data) {
            const newCharacter = mapCharacterRow({ ...character, ...data });
            setCharacters((prev) => {
              if (prev.some((item) => item.id === newCharacter.id)) return prev;
              return [...prev, newCharacter];
            });
          }
        }

        return { ok: true };
      } catch (error: any) {
        console.error("保存角色失败:", error);
        return { ok: false, message: "保存失败: " + error.message };
      }
    },
    [currentRoomId, setCharacters, userId]
  );

  const deleteRoomCharacter = useCallback(
    async (characterId: string): Promise<RoomCharacterActionResult> => {
      if (!characterId) return { ok: false };

      const { error } = await deleteCharacterRecord(characterId);

      if (error) {
        console.error("删除失败:", error);
        return { ok: false, message: "删除失败: " + error.message };
      }

      setCharacters((prev) => prev.filter((item) => item.id !== characterId));
      if (activeCharId === characterId) setActiveCharId("pc");
      return { ok: true };
    },
    [activeCharId, setActiveCharId, setCharacters]
  );

  const updateCharacterVitals = useCallback(
    async (
      characterId: string | null,
      hp: number,
      san: number,
      mp: number
    ): Promise<RoomCharacterActionResult> => {
      if (!characterId) return { ok: false };

      const target = characters.find((item) => item.id === characterId);
      if (!target) return { ok: false };

      const { error } = await saveCharacterStats(
        target.id,
        buildVitalsPayload(target, hp, san, mp)
      );

      if (error) {
        return { ok: false, message: "状态更新失败" };
      }

      const changes = [];
      if (hp !== target.hp)
        changes.push(`HP ${hp > target.hp ? "+" : ""}${hp - target.hp}`);
      if (san !== target.san)
        changes.push(`SAN ${san > target.san ? "+" : ""}${san - target.san}`);
      if (mp !== target.mp)
        changes.push(`MP ${mp > target.mp ? "+" : ""}${mp - target.mp}`);

      if (changes.length > 0) {
        setCharacters((prev) =>
          prev.map((item) =>
            item.id === target.id ? { ...item, hp, san, mp } : item
          )
        );
        await addLog("status", `${target.name} 状态变更: ${changes.join(", ")}`, target.id);
      }

      return { ok: true };
    },
    [addLog, characters, setCharacters]
  );

  return {
    duplicateCharacter,
    saveRoomCharacter,
    deleteRoomCharacter,
    updateCharacterVitals,
  };
}
