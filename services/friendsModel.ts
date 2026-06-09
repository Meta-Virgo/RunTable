import type { Friendship, Profile } from "../types";

export const FRIEND_REQUEST_COOLDOWN_MS = 30_000;

export interface FriendRequestStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface FriendsRepository {
  fetchAcceptedFriendships: (
    userId: string
  ) => Promise<{ data?: any[] | null }>;
  fetchIncomingFriendRequests: (
    userId: string
  ) => Promise<{ data?: any[] | null }>;
  searchProfiles: (input: {
    currentUserId: string;
    query: string;
  }) => Promise<{ data?: Profile[] | null }>;
  fetchExistingFriendship: (input: {
    currentUserId: string;
    targetUserId: string;
  }) => Promise<{ data?: Friendship | null }>;
  createFriendRequest: (input: {
    currentUserId: string;
    targetUserId: string;
  }) => Promise<{ error?: { message?: string } | null }>;
  acceptFriendRequest: (
    friendshipId: string
  ) => Promise<{ error?: { message?: string } | null }>;
  rejectFriendRequest: (
    friendshipId: string
  ) => Promise<{ error?: { message?: string } | null }>;
  deleteFriendship: (
    friendshipId: string
  ) => Promise<{ error?: { message?: string } | null }>;
}

export function normalizeAcceptedFriendships(
  friendships: any[] | null | undefined,
  currentUserId: string
) {
  return (friendships || []).map((friendship) => {
    const isMeSender = friendship.user_id === currentUserId;
    return {
      ...friendship,
      friend_profile: isMeSender
        ? friendship.friend_profile
        : friendship.user_profile,
    } as Friendship;
  });
}

export function normalizeIncomingFriendRequests(
  requests: any[] | null | undefined
) {
  return (requests || []).map(
    (request) =>
      ({
        ...request,
        friend_profile: request.friend_profile || request.user_profile,
      } as Friendship)
  );
}

export async function fetchFriendsOverview(input: {
  currentUserId: string;
  repository: FriendsRepository;
}) {
  const [friendshipsResult, requestsResult] = await Promise.all([
    input.repository.fetchAcceptedFriendships(input.currentUserId),
    input.repository.fetchIncomingFriendRequests(input.currentUserId),
  ]);

  return {
    friends: normalizeAcceptedFriendships(
      friendshipsResult.data,
      input.currentUserId
    ),
    requests: normalizeIncomingFriendRequests(requestsResult.data),
  };
}

export async function searchFriendProfiles(input: {
  currentUserId: string;
  query: string;
  repository: FriendsRepository;
}) {
  const query = input.query.trim();
  if (!query) return [];

  const { data } = await input.repository.searchProfiles({
    currentUserId: input.currentUserId,
    query,
  });
  return data || [];
}

export function getFriendRequestStorageKey(targetUserId: string) {
  return `last_friend_request_${targetUserId}`;
}

export function getFriendRequestCooldown(input: {
  targetUserId: string;
  storage: FriendRequestStorage;
  now?: number;
  cooldownMs?: number;
}) {
  const lastRequestTime = input.storage.getItem(
    getFriendRequestStorageKey(input.targetUserId)
  );
  if (!lastRequestTime) return null;

  const parsedTime = Number.parseInt(lastRequestTime, 10);
  if (Number.isNaN(parsedTime)) return null;

  const cooldownMs = input.cooldownMs ?? FRIEND_REQUEST_COOLDOWN_MS;
  const elapsed = (input.now ?? Date.now()) - parsedTime;
  if (elapsed >= cooldownMs) return null;

  return {
    remainingMs: cooldownMs - elapsed,
    remainingSeconds: Math.ceil((cooldownMs - elapsed) / 1000),
  };
}

export function rememberFriendRequestSent(input: {
  targetUserId: string;
  storage: FriendRequestStorage;
  now?: number;
}) {
  input.storage.setItem(
    getFriendRequestStorageKey(input.targetUserId),
    String(input.now ?? Date.now())
  );
}

export function getExistingFriendshipNotice(
  friendship: Friendship | null | undefined,
  currentUserId: string
) {
  if (!friendship) return null;
  if (friendship.status === "accepted") return "你们已经是好友了";
  if (friendship.user_id === currentUserId) return "已发送过申请";
  return "对方已经向你发送了申请，请去处理";
}

export async function requestFriendship(input: {
  currentUserId: string;
  targetUserId: string;
  repository: FriendsRepository;
  storage: FriendRequestStorage;
  now?: number;
}) {
  const cooldown = getFriendRequestCooldown({
    targetUserId: input.targetUserId,
    storage: input.storage,
    now: input.now,
  });
  if (cooldown) {
    return {
      status: "rate-limited" as const,
      message: `操作过于频繁，请等待 ${cooldown.remainingSeconds} 秒后再试`,
    };
  }

  const { data: existing } = await input.repository.fetchExistingFriendship({
    currentUserId: input.currentUserId,
    targetUserId: input.targetUserId,
  });
  const existingNotice = getExistingFriendshipNotice(
    existing,
    input.currentUserId
  );
  if (existingNotice) {
    return { status: "already-exists" as const, message: existingNotice };
  }

  const { error } = await input.repository.createFriendRequest({
    currentUserId: input.currentUserId,
    targetUserId: input.targetUserId,
  });
  if (error) {
    return {
      status: "error" as const,
      message: `申请发送失败: ${error.message || "未知错误"}`,
    };
  }

  rememberFriendRequestSent({
    targetUserId: input.targetUserId,
    storage: input.storage,
    now: input.now,
  });

  return { status: "sent" as const, message: "好友申请已发送" };
}
