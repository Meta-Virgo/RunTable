import type { Character, GameHistory, GameHistoryParticipant } from "../types";
import {
  buildPlayerHistoryWithLatestCharacters,
  getPlayerHistoryCharacterIds,
} from "./profileHistoryModel";

export type HomePlayerHistoryItem = GameHistoryParticipant & {
  game_history: GameHistory;
  latest_character?: Character;
};

export {
  getPlayerHistoryCharacterIds as getHomePlayerHistoryCharacterIds,
  getProfileHistoryCharacterDisplay as getHomeHistoryCharacterDisplay,
} from "./profileHistoryModel";

export {
  buildPlayerHistoryWithLatestCharacters as buildHomePlayerHistory,
} from "./profileHistoryModel";

export interface HomeProfileHistoryRepository {
  fetchKpHistory: (userId: string) => Promise<{ data?: any[] | null }>;
  fetchPlayerHistory: (userId: string) => Promise<{ data?: any[] | null }>;
  fetchCharactersByIds: (
    characterIds: string[]
  ) => Promise<{ data?: any[] | null }>;
}

export async function fetchHomeProfileHistory(input: {
  userId: string;
  repository: HomeProfileHistoryRepository;
}) {
  const { data: kpHistory } = await input.repository.fetchKpHistory(input.userId);
  const { data: playerHistory } = await input.repository.fetchPlayerHistory(
    input.userId
  );

  const characterIds = getPlayerHistoryCharacterIds(playerHistory || []);
  const { data: latestCharacters } =
    characterIds.length > 0
      ? await input.repository.fetchCharactersByIds(characterIds)
      : { data: [] };

  return {
    kpHistory: (kpHistory || []) as GameHistory[],
    playerHistory: buildPlayerHistoryWithLatestCharacters({
      participants: playerHistory || [],
      latestCharacters,
    }) as HomePlayerHistoryItem[],
  };
}
