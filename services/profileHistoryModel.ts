import type { Character, GameHistory, GameHistoryParticipant } from "../types";

export type PlayerHistoryWithLatestCharacter = GameHistoryParticipant & {
  game_history: GameHistory;
  latest_character?: Character;
};

export function getPlayerHistoryCharacterIds(participants: any[]) {
  return Array.from(
    new Set(
      participants
        .map((participant) => participant.character_snapshot?.id)
        .filter(Boolean)
    )
  ) as string[];
}

export function buildProfileHistoryCharacterMap(
  characters: any[] | null | undefined
) {
  return new Map<string, Character>(
    (characters || []).map((character: Character) => [character.id, character])
  );
}

export function attachLatestCharactersToPlayerHistory(input: {
  participants: any[];
  characterMap: Map<string, Character>;
}) {
  return input.participants.map((participant) => ({
    ...participant,
    latest_character: input.characterMap.get(
      participant.character_snapshot?.id as string
    ),
  })) as PlayerHistoryWithLatestCharacter[];
}

export function sortPlayerHistoryByRecency(
  participants: PlayerHistoryWithLatestCharacter[]
) {
  return [...participants].sort(
    (a, b) =>
      new Date(b.game_history.created_at).getTime() -
      new Date(a.game_history.created_at).getTime()
  );
}

export function buildPlayerHistoryWithLatestCharacters(input: {
  participants: any[];
  latestCharacters: any[] | null | undefined;
}) {
  return sortPlayerHistoryByRecency(
    attachLatestCharactersToPlayerHistory({
      participants: input.participants,
      characterMap: buildProfileHistoryCharacterMap(input.latestCharacters),
    })
  );
}

export function getProfileHistoryCharacterDisplay(
  item: PlayerHistoryWithLatestCharacter
) {
  const snapshot = item.character_snapshot;
  const latest: any = item.latest_character;
  const character: any = latest || snapshot || {};

  return {
    name: character.name || "未知角色",
    avatarUrl:
      character.info?.avatar_url ||
      character.avatar_url ||
      snapshot?.info?.avatar_url ||
      snapshot?.avatar_url ||
      null,
    job:
      character.info?.job ||
      character.job ||
      snapshot?.info?.job ||
      snapshot?.job ||
      "无职业",
    sex:
      character.info?.sex ||
      character.sex ||
      snapshot?.info?.sex ||
      snapshot?.sex ||
      "未知",
    isDead: item.outcome === "死亡",
    isLost: item.outcome === "失踪",
    isCrazy: item.outcome === "疯狂",
  };
}
