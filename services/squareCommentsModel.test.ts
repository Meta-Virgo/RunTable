import { describe, expect, it } from "vitest";
import type { Post, PostComment } from "../types";
import {
  assembleSquareComments,
  buildSquareCommentPayload,
  canDeleteSquareComment,
  createSquareCommentsExecutor,
  findSquareComment,
  formatCreatedSquareComment,
  getSquareCommentProfileIds,
  removeSquareComment,
  replaceSquarePostComments,
  type SquareCommentsByPost,
} from "./squareCommentsModel";

const post = {
  id: "post-1",
  channel_id: "channel-1",
  user_id: "author-1",
  content: "hello",
  created_at: "2026-06-08T00:00:00.000Z",
  updated_at: "2026-06-08T00:00:00.000Z",
  comment_count: 1,
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

describe("square comments model", () => {
  it("assembles comments with commenter, quote, like count, and liked state", () => {
    const rawComment = {
      ...comment,
      quote: {
        id: "quote-1",
        user_id: "user-2",
        content: "quoted",
      },
      comment_likes: [{ user_id: "user-3" }, { user_id: "user-1" }],
    };

    expect(getSquareCommentProfileIds([rawComment])).toEqual([
      "user-1",
      "user-2",
    ]);

    const comments = assembleSquareComments({
      rawComments: [rawComment],
      profileMap: new Map<string, any>([
        ["user-1", { nickname: "Commenter", avatar_url: null, is_vip: false }],
        ["user-2", { nickname: "Quoted" }],
      ]),
      currentUserId: "user-1",
    });

    expect(comments[0]).toMatchObject({
      profiles: { nickname: "Commenter" },
      quote: { profiles: { nickname: "Quoted" } },
      like_count: 2,
      is_liked: true,
    });
  });

  it("updates comment lists and deletion permissions", () => {
    const replaced = replaceSquarePostComments({
      comments: {},
      postId: "post-1",
      nextComments: [comment],
    });

    expect(findSquareComment({
      comments: replaced,
      postId: "post-1",
      commentId: "comment-1",
    })).toEqual(comment);

    expect(
      canDeleteSquareComment({
        currentUser: { id: "user-1" },
        comment,
      })
    ).toBe(true);
    expect(
      canDeleteSquareComment({
        currentUser: { id: "user-2" },
        comment,
      })
    ).toBe(false);

    expect(
      removeSquareComment({
        comments: replaced,
        postId: "post-1",
        commentId: "comment-1",
      })
    ).toEqual({ "post-1": [] });
  });

  it("builds create payloads and formats created comments", () => {
    expect(
      buildSquareCommentPayload({
        postId: "post-1",
        userId: "user-1",
        content: " hello ",
        quoteId: "comment-0",
      })
    ).toEqual({
      post_id: "post-1",
      user_id: "user-1",
      content: "hello",
      quote_id: "comment-0",
    });

    expect(
      formatCreatedSquareComment({
        commentData: comment,
        profileData: { nickname: "Me" },
      })
    ).toMatchObject({
      id: "comment-1",
      profiles: { nickname: "Me" },
    });
  });

  it("runs loading, sending, liking, and deletion through one executor", async () => {
    let posts: Post[] = [post];
    let comments: SquareCommentsByPost = { "post-1": [comment] };
    const loading: Array<{ postId: string; isLoading: boolean }> = [];
    const notifications: any[] = [];
    const liked: Array<{ commentId: string; userId: string }> = [];
    const unliked: Array<{ commentId: string; userId: string }> = [];
    const deleted: string[] = [];

    const executor = createSquareCommentsExecutor({
      getContext: () => ({
        currentUser: { id: "user-1", nickname: "Me" },
        posts,
        comments,
        selectedPostId: "post-1",
      }),
      repository: {
        fetchPostComments: async () => ({
          data: [
            {
              ...comment,
              comment_likes: [],
            },
          ],
        }),
        fetchProfilesByIds: async () => ({
          data: [{ id: "user-1", nickname: "Me" }],
        }),
        createComment: async () => ({
          data: {
            ...comment,
            id: "comment-2",
            content: "created",
          },
          error: null,
        }),
        createNotification: async (payload) => {
          notifications.push(payload);
          return { error: null };
        },
        fetchProfileById: async () => ({ data: { nickname: "Me" } }),
        likeComment: async (commentId, userId) => {
          liked.push({ commentId, userId });
          return { error: null };
        },
        unlikeComment: async (commentId, userId) => {
          unliked.push({ commentId, userId });
          return { error: null };
        },
        deleteComment: async (commentId) => {
          deleted.push(commentId);
          return { error: null };
        },
      },
      localState: {
        replaceComments: (updater) => {
          comments = updater(comments);
        },
        replacePosts: (updater) => {
          posts = updater(posts);
        },
        setCommentLoading: (postId, isLoading) => {
          loading.push({ postId, isLoading });
        },
      },
    });

    await executor.fetchComments("post-1");
    expect(loading).toEqual([
      { postId: "post-1", isLoading: true },
      { postId: "post-1", isLoading: false },
    ]);
    expect(comments["post-1"][0]).toMatchObject({
      profiles: { nickname: "Me" },
    });

    await expect(executor.sendComment("post-1", "hello")).resolves.toBe(true);
    expect(notifications[0]).toMatchObject({
      user_id: "author-1",
      actor_id: "user-1",
      type: "comment",
      post_id: "post-1",
    });
    expect(posts[0].comment_count).toBe(2);

    comments = {
      "post-1": [{ ...comment, user_id: "user-2", is_liked: false }],
    };
    await expect(executor.toggleCommentLike("comment-1")).resolves.toBe(true);
    expect(liked).toEqual([{ commentId: "comment-1", userId: "user-1" }]);
    expect(notifications[1]).toMatchObject({
      user_id: "user-2",
      actor_id: "user-1",
      type: "comment_like",
      post_id: "post-1",
    });
    expect(comments["post-1"][0].is_liked).toBe(true);

    await expect(executor.toggleCommentLike("comment-1")).resolves.toBe(true);
    expect(unliked).toEqual([{ commentId: "comment-1", userId: "user-1" }]);

    comments = { "post-1": [comment] };
    posts = [{ ...post, comment_count: 2 }];
    await expect(
      executor.deleteComment("comment-1", "post-1")
    ).resolves.toBe(true);
    expect(deleted).toEqual(["comment-1"]);
    expect(comments["post-1"]).toEqual([]);
    expect(posts[0].comment_count).toBe(1);
  });
});
