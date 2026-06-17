import type { Character, GameHistory, GameHistoryParticipant } from "../types";
import {
  buildPlayerHistoryWithLatestCharacters,
  getPlayerHistoryCharacterIds,
} from "./profileHistoryModel";

export type SquareProfileHistoryTab = "player" | "kp";

export type SquarePlayerHistoryItem = GameHistoryParticipant & {
  game_history: GameHistory;
  latest_character?: Character;
};

export interface SquareProfileHistory {
  kpHistory: GameHistory[];
  playerHistory: SquarePlayerHistoryItem[];
}

export {
  getPlayerHistoryCharacterIds as getSquarePlayerHistoryCharacterIds,
  buildProfileHistoryCharacterMap as buildSquareCharacterMap,
  attachLatestCharactersToPlayerHistory as attachLatestSquareCharacters,
  sortPlayerHistoryByRecency as sortSquarePlayerHistory,
  buildPlayerHistoryWithLatestCharacters as buildSquarePlayerHistory,
} from "./profileHistoryModel";

export {
  getProfileHistoryCharacterDisplay as getSquareHistoryCharacterDisplay,
} from "./profileHistoryModel";

export interface SquareProfileRepository {
  fetchProfileById: (userId: string) => Promise<{ data?: any | null }>;
  fetchKpHistory: (userId: string) => Promise<{ data?: any[] | null }>;
  fetchPlayerHistory: (userId: string) => Promise<{ data?: any[] | null }>;
  fetchCharactersByIds: (
    characterIds: string[]
  ) => Promise<{ data?: any[] | null }>;
}

export async function fetchSquareProfilePanelData(input: {
  userId: string;
  repository: SquareProfileRepository;
}) {
  const { data: profile } = await input.repository.fetchProfileById(
    input.userId
  );
  if (!profile) return null;

  const { data: kpData } = await input.repository.fetchKpHistory(input.userId);
  const { data: playerData } = await input.repository.fetchPlayerHistory(
    input.userId
  );

  let latestCharacters: any[] = [];
  if (playerData && playerData.length > 0) {
    const characterIds = getPlayerHistoryCharacterIds(playerData);
    if (characterIds.length > 0) {
      const { data } = await input.repository.fetchCharactersByIds(characterIds);
      latestCharacters = data || [];
    }
  }

  return {
    profile,
    kpHistory: (kpData || []) as GameHistory[],
    playerHistory: buildPlayerHistoryWithLatestCharacters({
      participants: playerData || [],
      latestCharacters,
    }) as SquarePlayerHistoryItem[],
  };
}
