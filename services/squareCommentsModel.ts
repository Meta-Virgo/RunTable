import type { Post, PostComment } from "../types";
import {
  applyCommentLikeState,
  applyPostCommentAdded,
  applyPostCommentDeleted,
  unknownSquareProfile,
} from "./squareFeedModel";

export type SquareCommentsByPost = Record<string, PostComment[]>;

export interface SquareCommentsContext {
  currentUser: any;
  posts: Post[];
  comments: SquareCommentsByPost;
  selectedPostId: string | null;
}

export interface SquareCommentsRepository {
  fetchPostComments: (postId: string) => Promise<{ data?: any[] | null }>;
  fetchProfilesByIds: (userIds: string[]) => Promise<{ data?: any[] | null }>;
  createComment: (payload: {
    post_id: string;
    user_id: string;
    content: string;
    quote_id?: string;
  }) => Promise<{ data?: any | null; error?: any | null }>;
  createNotification: (payload: {
    user_id: string;
    actor_id: string;
    type: string;
    post_id: string;
  }) => Promise<{ error?: any | null }>;
  fetchProfileById: (userId: string) => Promise<{ data?: any | null }>;
  likeComment: (
    commentId: string,
    userId: string
  ) => Promise<{ error?: any | null }>;
  unlikeComment: (
    commentId: string,
    userId: string
  ) => Promise<{ error?: any | null }>;
  deleteComment: (commentId: string) => Promise<{ error?: any | null }>;
}

export interface SquareCommentsLocalState {
  replaceComments: (
    updater: (previous: SquareCommentsByPost) => SquareCommentsByPost
  ) => void;
  replacePosts: (updater: (previous: Post[]) => Post[]) => void;
  setCommentLoading: (postId: string, isLoading: boolean) => void;
}

export function getSquareCommentProfileIds(rawComments: any[]) {
  const userIds = new Set<string>();

  rawComments.forEach((comment) => {
    if (comment.user_id) userIds.add(comment.user_id);
    if (comment.quote?.user_id) userIds.add(comment.quote.user_id);
  });

  return Array.from(userIds);
}

export function assembleSquareComments(input: {
  rawComments: any[];
  profileMap: Map<string, any>;
  currentUserId?: string;
}) {
  return input.rawComments.map((comment: any) => ({
    ...comment,
    profiles: input.profileMap.get(comment.user_id) || unknownSquareProfile,
    quote: comment.quote
      ? {
          ...comment.quote,
          profiles: input.profileMap.get(comment.quote.user_id) || {
            nickname: "未知用户",
          },
        }
      : null,
    like_count: comment.comment_likes?.length || 0,
    is_liked: input.currentUserId
      ? comment.comment_likes?.some(
          (like: any) => like.user_id === input.currentUserId
        )
      : false,
  })) as PostComment[];
}

export function replaceSquarePostComments(input: {
  comments: SquareCommentsByPost;
  postId: string;
  nextComments: PostComment[];
}) {
  return {
    ...input.comments,
    [input.postId]: input.nextComments,
  };
}

export function removeSquareComment(input: {
  comments: SquareCommentsByPost;
  postId: string;
  commentId: string;
}) {
  return replaceSquarePostComments({
    comments: input.comments,
    postId: input.postId,
    nextComments: (input.comments[input.postId] || []).filter(
      (comment) => comment.id !== input.commentId
    ),
  });
}

export function findSquareComment(input: {
  comments: SquareCommentsByPost;
  postId: string;
  commentId: string;
}) {
  return (input.comments[input.postId] || []).find(
    (comment) => comment.id === input.commentId
  );
}

export function canDeleteSquareComment(input: {
  currentUser: any;
  comment?: PostComment;
}) {
  return Boolean(
    input.currentUser && input.comment?.user_id === input.currentUser.id
  );
}

export function buildSquareCommentPayload(input: {
  postId: string;
  userId: string;
  content: string;
  quoteId?: string;
}) {
  return {
    post_id: input.postId,
    user_id: input.userId,
    content: input.content.trim(),
    ...(input.quoteId ? { quote_id: input.quoteId } : {}),
  };
}

export function formatCreatedSquareComment(input: {
  commentData: any;
  profileData: any | null | undefined;
}) {
  return {
    ...input.commentData,
    profiles: input.profileData || {
      nickname: "我",
      avatar_url: null,
      is_vip: false,
    },
  } as PostComment;
}

export function createSquareCommentsExecutor(input: {
  getContext: () => SquareCommentsContext;
  repository: SquareCommentsRepository;
  localState: SquareCommentsLocalState;
}) {
  const fetchComments = async (postId: string) => {
    input.localState.setCommentLoading(postId, true);

    try {
      const { data: rawComments } =
        await input.repository.fetchPostComments(postId);

      if (!rawComments || rawComments.length === 0) {
        input.localState.replaceComments((previous) =>
          replaceSquarePostComments({
            comments: previous,
            postId,
            nextComments: [],
          })
        );
        return true;
      }

      const { data: profiles } = await input.repository.fetchProfilesByIds(
        getSquareCommentProfileIds(rawComments)
      );
      const profileMap = new Map(
        profiles?.map((profile: any) => [profile.id, profile]) || []
      );
      const currentUserId = input.getContext().currentUser?.id;
      const comments = assembleSquareComments({
        rawComments,
        profileMap,
        currentUserId,
      });

      input.localState.replaceComments((previous) =>
        replaceSquarePostComments({
          comments: previous,
          postId,
          nextComments: comments,
        })
      );
      return true;
    } finally {
      input.localState.setCommentLoading(postId, false);
    }
  };

  const sendComment = async (
    postId: string,
    content: string,
    quoteId?: string
  ) => {
    const finalContent = content.trim();
    const { currentUser, posts } = input.getContext();

    if (!finalContent || !currentUser) return false;

    const { data, error } = await input.repository.createComment(
      buildSquareCommentPayload({
        postId,
        userId: currentUser.id,
        content: finalContent,
        quoteId,
      })
    );

    if (error || !data) return false;

    const post = posts.find((item) => item.id === postId);
    if (post && post.user_id !== currentUser.id) {
      await input.repository.createNotification({
        user_id: post.user_id,
        actor_id: currentUser.id,
        type: "comment",
        post_id: postId,
      });
    }

    await fetchComments(postId);

    const { data: profile } = await input.repository.fetchProfileById(
      currentUser.id
    );
    const newComment = formatCreatedSquareComment({
      commentData: data,
      profileData: profile,
    });

    input.localState.replacePosts((previous) =>
      applyPostCommentAdded({
        posts: previous,
        postId,
        comment: newComment,
      })
    );

    return true;
  };

  const toggleCommentLike = async (commentId: string) => {
    const { currentUser, comments, selectedPostId } = input.getContext();
    if (!currentUser || !selectedPostId) return false;

    const comment = findSquareComment({
      comments,
      postId: selectedPostId,
      commentId,
    });
    if (!comment) return false;

    if (comment.is_liked) {
      const { error } = await input.repository.unlikeComment(
        commentId,
        currentUser.id
      );
      if (error) return false;

      input.localState.replaceComments((previous) =>
        applyCommentLikeState({
          comments: previous,
          postId: selectedPostId,
          commentId,
          liked: false,
        })
      );
      return true;
    }

    const { error } = await input.repository.likeComment(
      commentId,
      currentUser.id
    );
    if (error) return false;

    input.localState.replaceComments((previous) =>
      applyCommentLikeState({
        comments: previous,
        postId: selectedPostId,
        commentId,
        liked: true,
      })
    );

    if (comment.user_id !== currentUser.id) {
      await input.repository.createNotification({
        user_id: comment.user_id,
        actor_id: currentUser.id,
        type: "comment_like",
        post_id: selectedPostId,
      });
    }

    return true;
  };

  const deleteComment = async (commentId: string, postId: string) => {
    const { currentUser, comments } = input.getContext();
    const comment = findSquareComment({ comments, postId, commentId });
    if (!canDeleteSquareComment({ currentUser, comment })) return false;

    const { error } = await input.repository.deleteComment(commentId);
    if (error) return false;

    input.localState.replaceComments((previous) =>
      removeSquareComment({
        comments: previous,
        postId,
        commentId,
      })
    );
    input.localState.replacePosts((previous) =>
      applyPostCommentDeleted({
        posts: previous,
        postId,
      })
    );
    return true;
  };

  return {
    fetchComments,
    sendComment,
    toggleCommentLike,
    deleteComment,
  };
}
