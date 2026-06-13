import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Square } from "./Square";

vi.mock("../hooks/useElasticScroll", () => ({
  useElasticScroll: vi.fn(),
}));

vi.mock("../hooks/useSquareNotifications", () => ({
  useSquareNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  }),
}));

vi.mock("../hooks/useSquareFeed", () => ({
  useSquareFeed: () => ({
    activeChannelId: "channel-1",
    setActiveChannelId: vi.fn(),
    channels: [
      {
        id: "channel-1",
        name: "general",
        category: "common",
        created_at: "2026-06-08T00:00:00.000Z",
      },
    ],
    posts: [
      {
        id: "post-1",
        channel_id: "channel-1",
        user_id: "user-2",
        content: "# Markdown title\n\n- Keeper note",
        created_at: "2026-06-08T00:00:00.000Z",
        updated_at: "2026-06-08T00:00:00.000Z",
        profiles: {
          nickname: "Yolo",
          avatar_url: "",
          is_vip: false,
        },
        like_count: 0,
        comment_count: 0,
        is_liked: false,
        liked_by: [],
      },
    ],
    setPosts: vi.fn(),
    loadingChannels: false,
    loadingPosts: false,
    currentUser: {
      id: "user-1",
      nickname: "Yves",
      avatar_url: "",
      is_vip: false,
    },
    publishPost: vi.fn(),
    togglePostLike: vi.fn(),
    deleteFeedPost: vi.fn(),
    shareableCharacters: [],
    pendingModules: [],
    addCharacterModule: vi.fn(),
    removeModule: vi.fn(),
  }),
}));

vi.mock("../services/squareCommentsRepository", () => ({
  createComment: vi.fn(),
  createNotification: vi.fn(),
  deleteComment: vi.fn(),
  fetchPostComments: vi.fn(),
  fetchProfileById: vi.fn(),
  fetchProfilesByIds: vi.fn(),
  likeComment: vi.fn(),
  unlikeComment: vi.fn(),
}));

vi.mock("../services/squareProfileRepository", () => ({
  fetchCharactersByIds: vi.fn(),
  fetchKpHistory: vi.fn(),
  fetchPlayerHistory: vi.fn(),
  fetchProfileById: vi.fn(),
}));

describe("Square Markdown integration", () => {
  it("keeps the Square composer live-previewed without a manual Preview tab", () => {
    const html = renderToStaticMarkup(<Square />);

    expect(html).not.toContain("Preview</button>");
    expect(html).toContain('aria-label="Bold"');
    expect(html).toContain('contenteditable="true"');
    expect(html).toContain("<h1");
    expect(html).toContain("Markdown title");
    expect(html).not.toContain("# Markdown title");
  });
});
