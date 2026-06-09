import type { Character, GameHistory, GameHistoryParticipant } from "../types";
import {
  buildPlayerHistoryWithLatestCharacters,
  buildProfileHistoryCharacterMap,
  getProfileHistoryCharacterDisplay,
  getPlayerHistoryCharacterIds,
} from "./profileHistoryModel";

export type HomePlayerHistoryItem = GameHistoryParticipant & {
  game_history: GameHistory;
  latest_character?: Character;
};

export function getHomePlayerHistoryCharacterIds(participants: any[]) {
  return getPlayerHistoryCharacterIds(participants);
}

export function buildHomeCharacterMap(characters: any[] | null | undefined) {
  return buildProfileHistoryCharacterMap(characters);
}

export function buildHomePlayerHistory(input: {
  participants: any[];
  latestCharacters: any[] | null | undefined;
}): HomePlayerHistoryItem[] {
  return buildPlayerHistoryWithLatestCharacters(input);
}

export function getHomeHistoryCharacterDisplay(item: HomePlayerHistoryItem) {
  return getProfileHistoryCharacterDisplay(item);
}

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

  const characterIds = getHomePlayerHistoryCharacterIds(playerHistory || []);
  const { data: latestCharacters } =
    characterIds.length > 0
      ? await input.repository.fetchCharactersByIds(characterIds)
      : { data: [] };

  return {
    kpHistory: (kpHistory || []) as GameHistory[],
    playerHistory: buildHomePlayerHistory({
      participants: playerHistory || [],
      latestCharacters,
    }),
  };
}
