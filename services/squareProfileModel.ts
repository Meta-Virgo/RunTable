import type { Character, GameHistory, GameHistoryParticipant } from "../types";
import {
  attachLatestCharactersToPlayerHistory,
  buildPlayerHistoryWithLatestCharacters,
  buildProfileHistoryCharacterMap,
  getProfileHistoryCharacterDisplay,
  getPlayerHistoryCharacterIds,
  sortPlayerHistoryByRecency,
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

export function getSquarePlayerHistoryCharacterIds(participants: any[]) {
  return getPlayerHistoryCharacterIds(participants);
}

export function buildSquareCharacterMap(characters: any[] | null | undefined) {
  return buildProfileHistoryCharacterMap(characters);
}

export function attachLatestSquareCharacters(input: {
  participants: any[];
  characterMap: Map<string, Character>;
}) {
  return attachLatestCharactersToPlayerHistory(input) as SquarePlayerHistoryItem[];
}

export function sortSquarePlayerHistory(
  participants: SquarePlayerHistoryItem[]
) {
  return sortPlayerHistoryByRecency(participants) as SquarePlayerHistoryItem[];
}

export function buildSquarePlayerHistory(input: {
  participants: any[];
  latestCharacters: any[] | null | undefined;
}) {
  return buildPlayerHistoryWithLatestCharacters(input) as SquarePlayerHistoryItem[];
}

export function getSquareHistoryCharacterDisplay(
  item: SquarePlayerHistoryItem
) {
  return getProfileHistoryCharacterDisplay(item);
}

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
    const characterIds = getSquarePlayerHistoryCharacterIds(playerData);
    if (characterIds.length > 0) {
      const { data } = await input.repository.fetchCharactersByIds(characterIds);
      latestCharacters = data || [];
    }
  }

  return {
    profile,
    kpHistory: (kpData || []) as GameHistory[],
    playerHistory: buildSquarePlayerHistory({
      participants: playerData || [],
      latestCharacters,
    }),
  };
}
