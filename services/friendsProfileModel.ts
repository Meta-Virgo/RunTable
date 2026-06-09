import {
  fetchHomeProfileHistory,
  getHomeHistoryCharacterDisplay,
  type HomePlayerHistoryItem,
  type HomeProfileHistoryRepository,
} from "./homeProfileModel";

export type FriendsPlayerHistoryItem = HomePlayerHistoryItem;
export type FriendsProfileHistoryRepository = HomeProfileHistoryRepository;

export function getFriendsHistoryCharacterDisplay(
  item: FriendsPlayerHistoryItem
) {
  return getHomeHistoryCharacterDisplay(item);
}

export function fetchFriendsProfileHistory(input: {
  userId: string;
  repository: FriendsProfileHistoryRepository;
}) {
  return fetchHomeProfileHistory(input);
}
