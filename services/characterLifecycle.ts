import type { Character, Log } from "../types";
import { buildCharacterMutationPayload } from "../utils/characterPayload";
import { mapCharacterRow } from "../utils/characterMapper";

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

export function getDuplicateCharacterName(
  name: string,
  existingNames: Set<string>
) {
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
}

export function buildCharacterVitalsPayload(
  character: Character,
  hp: number,
  san: number,
  mp: number
) {
  return {
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
  };
}

export function describeVitalsChange(
  character: Pick<Character, "hp" | "san" | "mp">,
  hp: number,
  san: number,
  mp: number
) {
  const changes = [];
  if (hp !== character.hp)
    changes.push(`HP ${hp > character.hp ? "+" : ""}${hp - character.hp}`);
  if (san !== character.san)
    changes.push(`SAN ${san > character.san ? "+" : ""}${san - character.san}`);
  if (mp !== character.mp)
    changes.push(`MP ${mp > character.mp ? "+" : ""}${mp - character.mp}`);
  return changes;
}

export function replaceCharacterInList(
  characters: Character[],
  character: Character
) {
  return characters.map((item) =>
    item.id === character.id ? character : item
  );
}

export function upsertCharacterInList(
  characters: Character[],
  character: Character
) {
  if (characters.some((item) => item.id === character.id)) {
    return replaceCharacterInList(characters, character);
  }
  return [...characters, character];
}

export function removeCharacterFromList(
  characters: Character[],
  characterId: string
) {
  return characters.filter((item) => item.id !== characterId);
}

export function applyCharacterVitals(
  characters: Character[],
  characterId: string,
  vitals: { hp: number; san: number; mp: number }
) {
  return characters.map((item) =>
    item.id === characterId ? { ...item, ...vitals } : item
  );
}

export function getActiveCharacterAfterRemoval(
  activeCharId: string,
  removedCharacterId: string
) {
  return activeCharId === removedCharacterId ? "pc" : activeCharId;
}

type AddCharacterLog = (
  type: Log["type"],
  content: string,
  customCharId?: string,
  recipientId?: string | null,
  meta?: Record<string, any>
) => Promise<void>;

export interface CharacterLifecycleActionResult {
  ok: boolean;
  message?: string;
}

export interface CharacterLifecycleContext {
  currentRoomId: string | null;
  userId?: string;
  characters: Character[];
}

export interface CharacterLifecycleRepository {
  createCharacter: (
    payload: ReturnType<typeof buildCharacterMutationPayload>
  ) => Promise<{ data?: any; error?: any | null }>;
  updateCharacter: (
    characterId: string,
    payload: ReturnType<typeof buildCharacterMutationPayload>
  ) => Promise<{ error?: any | null }>;
  fetchCharacterById: (
    characterId: string
  ) => Promise<{ data?: any; error?: any | null }>;
  deleteCharacter: (characterId: string) => Promise<{ error?: any | null }>;
  updateCharacterStats: (
    characterId: string,
    stats: Record<string, any>
  ) => Promise<{ error?: any | null }>;
}

export interface CharacterLifecycleLocalState {
  replaceCharacters: (
    updater: (previousCharacters: Character[]) => Character[]
  ) => void;
  updateActiveCharacter: (updater: (previousActiveId: string) => string) => void;
}

export interface CharacterLifecycleExecutorOptions {
  getContext: () => CharacterLifecycleContext;
  repository: CharacterLifecycleRepository;
  localState: CharacterLifecycleLocalState;
  addLog: AddCharacterLog;
}

export function createCharacterLifecycleExecutor({
  getContext,
  repository,
  localState,
  addLog,
}: CharacterLifecycleExecutorOptions) {
  const duplicateCharacter = async (
    character: Character
  ): Promise<CharacterLifecycleActionResult> => {
    const { currentRoomId, userId, characters } = getContext();
    if (!currentRoomId || !userId) return { ok: false };

    const name = getDuplicateCharacterName(
      character.name,
      new Set(characters.map((item) => item.name))
    );
    const payload = buildCharacterMutationPayload(character, {
      roomId: currentRoomId,
      userId,
      name,
      typeFallback: "monster",
    });

    const { error } = await repository.createCharacter(payload);

    if (error) {
      console.error("复制角色失败:", error);
      return { ok: false, message: "复制失败: " + error.message };
    }

    return { ok: true };
  };

  const saveRoomCharacter = async (
    character: Character,
    editingCharacter: Character | null
  ): Promise<CharacterLifecycleActionResult> => {
    const { currentRoomId, userId } = getContext();
    if (!currentRoomId || !userId) return { ok: false };

    const payload = buildCharacterMutationPayload(character, {
      roomId: currentRoomId,
      userId: editingCharacter?.user_id || userId,
      typeFallback: "investigator",
    });

    try {
      if (editingCharacter) {
        const { error } = await repository.updateCharacter(character.id, payload);
        if (error) throw error;

        const { data: latestChar, error: fetchError } =
          await repository.fetchCharacterById(character.id);

        if (latestChar && !fetchError) {
          const mappedLatest = mapCharacterRow({
            ...character,
            ...latestChar,
          });
          localState.replaceCharacters((previous) =>
            replaceCharacterInList(previous, mappedLatest)
          );
        } else {
          localState.replaceCharacters((previous) =>
            replaceCharacterInList(previous, { ...character, ...payload })
          );
        }
      } else {
        const { data, error } = await repository.createCharacter(payload);
        if (error) throw error;

        if (data) {
          const newCharacter = mapCharacterRow({ ...character, ...data });
          localState.replaceCharacters((previous) =>
            upsertCharacterInList(previous, newCharacter)
          );
        }
      }

      return { ok: true };
    } catch (error: any) {
      console.error("保存角色失败:", error);
      return { ok: false, message: "保存失败: " + error.message };
    }
  };

  const deleteRoomCharacter = async (
    characterId: string
  ): Promise<CharacterLifecycleActionResult> => {
    if (!characterId) return { ok: false };

    const { error } = await repository.deleteCharacter(characterId);

    if (error) {
      console.error("删除失败:", error);
      return { ok: false, message: "删除失败: " + error.message };
    }

    localState.replaceCharacters((previous) =>
      removeCharacterFromList(previous, characterId)
    );
    localState.updateActiveCharacter((previous) =>
      getActiveCharacterAfterRemoval(previous, characterId)
    );
    return { ok: true };
  };

  const updateCharacterVitals = async (
    characterId: string | null,
    hp: number,
    san: number,
    mp: number
  ): Promise<CharacterLifecycleActionResult> => {
    if (!characterId) return { ok: false };

    const { characters } = getContext();
    const target = characters.find((item) => item.id === characterId);
    if (!target) return { ok: false };

    const { error } = await repository.updateCharacterStats(
      target.id,
      buildCharacterVitalsPayload(target, hp, san, mp)
    );

    if (error) {
      return { ok: false, message: "状态更新失败" };
    }

    const changes = describeVitalsChange(target, hp, san, mp);

    if (changes.length > 0) {
      localState.replaceCharacters((previous) =>
        applyCharacterVitals(previous, target.id, { hp, san, mp })
      );
      await addLog(
        "status",
        `${target.name} 状态变更: ${changes.join(", ")}`,
        target.id
      );
    }

    return { ok: true };
  };

  return {
    duplicateCharacter,
    saveRoomCharacter,
    deleteRoomCharacter,
    updateCharacterVitals,
  };
}
