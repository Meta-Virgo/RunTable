import { describe, expect, it } from "vitest";
import {
  applyCommentLikeState,
  applyPostCommentAdded,
  applyPostCommentDeleted,
  applyPostLikeState,
  assembleSquarePosts,
  attachSquareCommentPreviews,
  buildSquareProfileMap,
  createSquareFeedExecutor,
  formatRealtimeSquarePost,
  getCommentPreviewProfileIds,
  getPostsNeedingCommentPreviews,
  getSquareFeedProfileIds,
  prependSquarePost,
  removeSquarePost,
} from "./squareFeedModel";
import type { Post, PostComment } from "../types";

const post = {
  id: "post-1",
  channel_id: "channel-1",
  user_id: "author-1",
  content: "hello",
  created_at: "2026-06-08T00:00:00.000Z",
  updated_at: "2026-06-08T00:00:00.000Z",
  like_count: 1,
  comment_count: 1,
  is_liked: false,
  liked_by: [{ nickname: "Old" }],
} satisfies Post;

const comment = {
  id: "comment-1",
  post_id: "post-1",
  user_id: "user-1",
  content: "first",
  created_at: "2026-06-08T00:00:00.000Z",
  like_count: 0,
  is_liked: false,
} satisfies PostComment;

describe("square feed model", () => {
  it("assembles posts with author profile, counts, liked state, and liked-by users", () => {
    const profileMap = new Map<string, any>([
      ["author-1", { nickname: "Author", avatar_url: null, is_vip: true }],
      ["liker-1", { nickname: "Liker", avatar_url: null, is_vip: false }],
    ]);

    const posts = assembleSquarePosts({
      postsData: [
        {
          ...post,
          post_likes: [{ user_id: "liker-1" }],
          post_comments: [{ count: 2 }],
        },
      ],
      profileMap,
      likedPostIds: new Set(["post-1"]),
    });

    expect(posts[0]).toMatchObject({
      profiles: { nickname: "Author" },
      like_count: 1,
      comment_count: 2,
      is_liked: true,
      liked_by: [{ nickname: "Liker", avatar_url: null, is_vip: false }],
    });
  });

  it("applies post like and unlike transitions", () => {
    const liked = applyPostLikeState({
      posts: [post],
      postId: "post-1",
      currentUser: { nickname: "Me" },
      liked: true,
    });

    expect(liked[0]).toMatchObject({
      like_count: 2,
      is_liked: true,
      liked_by: [{ nickname: "Old" }, { nickname: "Me" }],
    });

    const unliked = applyPostLikeState({
      posts: liked,
      postId: "post-1",
      currentUser: { nickname: "Me" },
      liked: false,
    });

    expect(unliked[0]).toMatchObject({
      like_count: 1,
      is_liked: false,
      liked_by: [{ nickname: "Old" }],
    });
  });

  it("updates post comment preview and count when adding or deleting comments", () => {
    const added = applyPostCommentAdded({
      posts: [post],
      postId: "post-1",
      comment,
    });

    expect(added[0]).toMatchObject({
      comment_count: 2,
      latest_comments: [comment],
    });

    const deleted = applyPostCommentDeleted({
      posts: added,
      postId: "post-1",
    });

    expect(deleted[0].comment_count).toBe(1);
  });

  it("applies comment like and unlike transitions", () => {
    const liked = applyCommentLikeState({
      comments: { "post-1": [comment] },
      postId: "post-1",
      commentId: "comment-1",
      liked: true,
    });

    expect(liked["post-1"][0]).toMatchObject({
      like_count: 1,
      is_liked: true,
    });

    const unliked = applyCommentLikeState({
      comments: liked,
      postId: "post-1",
      commentId: "comment-1",
      liked: false,
    });

    expect(unliked["post-1"][0]).toMatchObject({
      like_count: 0,
      is_liked: false,
    });
  });

  it("derives feed assembly ids and maps profiles", () => {
    expect(
      getSquareFeedProfileIds([
        {
          id: "post-1",
          user_id: "author-1",
          post_likes: [{ user_id: "liker-1" }, { user_id: "author-1" }],
        },
      ])
    ).toEqual(["author-1", "liker-1"]);

    expect(
      buildSquareProfileMap([
        { id: "author-1", nickname: "Author" },
      ]).get("author-1")
    ).toEqual({ id: "author-1", nickname: "Author" });
  });

  it("attaches comment previews through profile maps", () => {
    const posts = [
      { ...post, latest_comments: undefined },
      { ...post, id: "post-2", comment_count: 0 },
    ];

    expect(getPostsNeedingCommentPreviews(posts).map((item) => item.id)).toEqual([
      "post-1",
    ]);

    expect(
      getCommentPreviewProfileIds([
        { comments: [{ user_id: "user-1" }, { user_id: "user-2" }] },
      ])
    ).toEqual(["user-1", "user-2"]);

    const withPreviews = attachSquareCommentPreviews({
      posts,
      previews: [{ postId: "post-1", comments: [comment] }],
      profileMap: new Map([["user-1", { nickname: "Commenter" }]]),
    });

    expect(withPreviews[0].latest_comments?.[0]).toMatchObject({
      id: "comment-1",
      profiles: { nickname: "Commenter" },
    });
    expect(withPreviews[1].latest_comments).toBeUndefined();
  });

  it("formats realtime posts and updates the feed list", () => {
    const realtimePost = formatRealtimeSquarePost({
      postData: {
        ...post,
        post_likes: [{ count: 3 }],
        post_comments: [{ count: 4 }],
      },
      profileData: { nickname: "Author" },
    });

    expect(realtimePost).toMatchObject({
      profiles: { nickname: "Author" },
      like_count: 3,
      comment_count: 4,
    });

    expect(prependSquarePost([post], realtimePost)).toHaveLength(1);
    expect(prependSquarePost([], realtimePost)).toEqual([realtimePost]);
    expect(removeSquarePost([post], "post-1")).toEqual([]);
  });

  it("runs feed loading, realtime, publishing, liking, and deletion through one executor", async () => {
    let posts: Post[] = [post];
    const createdPosts: any[] = [];
    const createdModules: any[] = [];
    const notifications: any[] = [];
    const liked: Array<{ postId: string; userId: string }> = [];
    const unliked: Array<{ postId: string; userId: string }> = [];
    const deleted: string[] = [];

    const executor = createSquareFeedExecutor({
      getContext: () => ({
        activeChannelId: "channel-1",
        currentUser: {
          id: "user-1",
          nickname: "Me",
        },
        posts,
      }),
      repository: {
        fetchProfilesByIds: async () => ({
          data: [
            { id: "author-1", nickname: "Author" },
            { id: "user-1", nickname: "Me" },
          ],
        }),
        fetchLikedPostIds: async () => new Set(["post-1"]),
        fetchLatestComments: async () => ({ data: [comment] }),
        fetchPostWithCounts: async () => ({
          data: {
            ...post,
            id: "post-2",
            user_id: "author-1",
            post_likes: [{ count: 0 }],
            post_comments: [{ count: 0 }],
          },
        }),
        fetchProfileById: async () => ({ data: { nickname: "Author" } }),
        uploadPostImage: async () => "https://image.test/post.png",
        createPost: async (payload) => {
          createdPosts.push(payload);
          return { data: { id: "created-post-1" }, error: null };
        },
        createPostModules: async (postId, modules) => {
          createdModules.push({ postId, modules });
          return { error: null };
        },
        createNotification: async (payload) => {
          notifications.push(payload);
          return { error: null };
        },
        likePost: async (postId, userId) => {
          liked.push({ postId, userId });
          return { error: null };
        },
        unlikePost: async (postId, userId) => {
          unliked.push({ postId, userId });
          return { error: null };
        },
        deletePost: async (postId) => {
          deleted.push(postId);
          return { error: null };
        },
      },
      localState: {
        replacePosts: (updater) => {
          posts = updater(posts);
        },
      },
    });

    const formatted = await executor.formatPosts([
      {
        ...post,
        post_likes: [{ user_id: "user-1" }],
        post_comments: [{ count: 1 }],
      },
    ]);
    expect(formatted[0]).toMatchObject({
      is_liked: true,
      profiles: { nickname: "Author" },
    });

    const withPreviews = await executor.attachCommentPreviews([
      { ...post, latest_comments: undefined },
    ]);
    expect(withPreviews[0].latest_comments?.[0]).toMatchObject({
      id: "comment-1",
      profiles: { nickname: "Me" },
    });

    await executor.prependRealtimePost("post-2");
    expect(posts[0]).toMatchObject({ id: "post-2" });

    const publishResult = await executor.publishPost("hello", {
      name: "post.png",
      type: "image/png",
    } as File);
    expect(publishResult).toEqual({ ok: true });
    expect(createdPosts[0]).toMatchObject({
      channel_id: "channel-1",
      user_id: "user-1",
      content: "hello",
      image_url: "https://image.test/post.png",
    });

    const modulePublishResult = await executor.publishPost("", undefined, [
      {
        module_type: "character_summary",
        payload: { title: "Lin" } as any,
        source_character_id: "char-1",
        source_room_id: null,
        source_message_ids: [],
      },
    ]);
    expect(modulePublishResult).toEqual({ ok: true });
    expect(createdModules[0]).toMatchObject({
      postId: "created-post-1",
      modules: [{ module_type: "character_summary" }],
    });

    posts = [{ ...post, is_liked: false }];
    await executor.togglePostLike("post-1");
    expect(liked).toEqual([{ postId: "post-1", userId: "user-1" }]);
    expect(notifications[0]).toMatchObject({
      user_id: "author-1",
      actor_id: "user-1",
      type: "like",
      post_id: "post-1",
    });
    expect(posts[0].is_liked).toBe(true);

    await executor.togglePostLike("post-1");
    expect(unliked).toEqual([{ postId: "post-1", userId: "user-1" }]);

    posts = [{ ...post, user_id: "user-1" }];
    await expect(executor.deleteFeedPost("post-1")).resolves.toBe(true);
    expect(deleted).toEqual(["post-1"]);
    expect(posts).toEqual([]);
  });
});
