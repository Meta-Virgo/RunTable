import { useCallback, useEffect, useState } from "react";
import { Character } from "../types";
import { getCurrentUser } from "../services/auth";
import {
  createCharacter,
  deleteCharacter,
  fetchUserInvestigators,
  updateCharacter,
} from "../services/characters";
import { buildCharacterMutationPayload } from "../utils/characterPayload";
import { mapCharacterRow } from "../utils/characterMapper";

interface ActionResult {
  ok: boolean;
  message?: string;
}

export function useInvestigatorLibrary() {
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);

  const refreshMyCharacters = useCallback(async () => {
    setIsLoadingCharacters(true);
    try {
      const {
        data: { user },
      } = await getCurrentUser();
      if (!user) {
        setMyCharacters([]);
        return;
      }

      const { data, error } = await fetchUserInvestigators(user.id);

      if (data) {
        setMyCharacters(data.map(mapCharacterRow));
      }

      if (error) console.error("Error fetching characters:", error);
    } finally {
      setIsLoadingCharacters(false);
    }
  }, []);

  useEffect(() => {
    refreshMyCharacters();
  }, [refreshMyCharacters]);

  const saveInvestigator = useCallback(
    async (
      character: Character,
      editingCharacter: Character | null
    ): Promise<ActionResult> => {
      const {
        data: { user },
      } = await getCurrentUser();
      if (!user) return { ok: false };

      const payload = buildCharacterMutationPayload(character, {
        userId: user.id,
        typeFallback: "investigator",
      });

      if (editingCharacter) {
        const { error } = await updateCharacter(character.id, payload);
        if (error) return { ok: false, message: "更新失败: " + error.message };

        setMyCharacters((prev) =>
          prev.map((item) => (item.id === character.id ? character : item))
        );
        return { ok: true };
      }

      const { data, error } = await createCharacter(payload);
      if (error) return { ok: false, message: "创建失败: " + error.message };

      if (data) {
        setMyCharacters((prev) => [...prev, { ...character, id: data.id }]);
      }

      return { ok: true };
    },
    []
  );

  const deleteInvestigator = useCallback(
    async (characterId: string): Promise<ActionResult> => {
      const { error } = await deleteCharacter(characterId);

      if (error) return { ok: false, message: "删除失败: " + error.message };

      setMyCharacters((prev) =>
        prev.filter((character) => character.id !== characterId)
      );
      return { ok: true };
    },
    []
  );

  return {
    myCharacters,
    isLoadingCharacters,
    refreshMyCharacters,
    saveInvestigator,
    deleteInvestigator,
  };
}
