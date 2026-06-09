import { describe, expect, it } from "vitest";
import {
  fetchFriendsOverview,
  getExistingFriendshipNotice,
  getFriendRequestCooldown,
  normalizeAcceptedFriendships,
  normalizeIncomingFriendRequests,
  requestFriendship,
  searchFriendProfiles,
  type FriendRequestStorage,
  type FriendsRepository,
} from "./friendsModel";

const currentUserId = "user-current";
const targetUserId = "user-target";

function createStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  } satisfies FriendRequestStorage & { data: Record<string, string> };
}

function createRepository(
  overrides: Partial<FriendsRepository> = {}
): FriendsRepository {
  return {
    fetchAcceptedFriendships: async () => ({ data: [] }),
    fetchIncomingFriendRequests: async () => ({ data: [] }),
    searchProfiles: async () => ({ data: [] }),
    fetchExistingFriendship: async () => ({ data: null }),
    createFriendRequest: async () => ({ error: null }),
    acceptFriendRequest: async () => ({ error: null }),
    rejectFriendRequest: async () => ({ error: null }),
    deleteFriendship: async () => ({ error: null }),
    ...overrides,
  };
}

describe("friends model", () => {
  it("normalizes accepted friendships and incoming requests", () => {
    expect(
      normalizeAcceptedFriendships(
        [
          {
            id: "sent-by-me",
            user_id: currentUserId,
            friend_profile: { id: "friend-a" },
            user_profile: { id: currentUserId },
          },
          {
            id: "sent-by-other",
            user_id: "friend-b",
            friend_profile: { id: currentUserId },
            user_profile: { id: "friend-b" },
          },
        ],
        currentUserId
      ).map((friendship) => friendship.friend_profile?.id)
    ).toEqual(["friend-a", "friend-b"]);

    expect(
      normalizeIncomingFriendRequests([
        { id: "request-a", user_profile: { id: "sender-a" } },
      ])[0].friend_profile?.id
    ).toBe("sender-a");
  });

  it("fetches friends overview through one repository interface", async () => {
    const overview = await fetchFriendsOverview({
      currentUserId,
      repository: createRepository({
        fetchAcceptedFriendships: async () => ({
          data: [
            {
              id: "friendship-a",
              user_id: currentUserId,
              friend_profile: { id: "friend-a" },
            },
          ],
        }),
        fetchIncomingFriendRequests: async () => ({
          data: [{ id: "request-a", user_profile: { id: "sender-a" } }],
        }),
      }),
    });

    expect(overview.friends[0].friend_profile?.id).toBe("friend-a");
    expect(overview.requests[0].friend_profile?.id).toBe("sender-a");
  });

  it("trims empty profile search before calling the repository", async () => {
    let called = false;
    const results = await searchFriendProfiles({
      currentUserId,
      query: "   ",
      repository: createRepository({
        searchProfiles: async () => {
          called = true;
          return { data: [] };
        },
      }),
    });

    expect(results).toEqual([]);
    expect(called).toBe(false);
  });

  it("detects friend request cooldowns", () => {
    const storage = createStorage({
      [`last_friend_request_${targetUserId}`]: "1000",
    });

    expect(
      getFriendRequestCooldown({
        targetUserId,
        storage,
        now: 11_000,
      })?.remainingSeconds
    ).toBe(20);
  });

  it("explains existing friendship states", () => {
    expect(
      getExistingFriendshipNotice(
        {
          id: "friendship-a",
          user_id: currentUserId,
          friend_id: targetUserId,
          status: "pending",
          created_at: "",
        },
        currentUserId
      )
    ).toBe("已发送过申请");

    expect(
      getExistingFriendshipNotice(
        {
          id: "friendship-a",
          user_id: targetUserId,
          friend_id: currentUserId,
          status: "pending",
          created_at: "",
        },
        currentUserId
      )
    ).toBe("对方已经向你发送了申请，请去处理");
  });

  it("sends friend requests and remembers successful sends", async () => {
    const storage = createStorage();
    const result = await requestFriendship({
      currentUserId,
      targetUserId,
      storage,
      now: 42,
      repository: createRepository(),
    });

    expect(result).toEqual({
      status: "sent",
      message: "好友申请已发送",
    });
    expect(storage.data[`last_friend_request_${targetUserId}`]).toBe("42");
  });

  it("short-circuits rate-limited friend requests", async () => {
    let created = false;
    const result = await requestFriendship({
      currentUserId,
      targetUserId,
      storage: createStorage({
        [`last_friend_request_${targetUserId}`]: "1000",
      }),
      now: 2_000,
      repository: createRepository({
        createFriendRequest: async () => {
          created = true;
          return { error: null };
        },
      }),
    });

    expect(result.status).toBe("rate-limited");
    expect(created).toBe(false);
  });
});
