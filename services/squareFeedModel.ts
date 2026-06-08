import type { Post, PostComment } from "../types";

export const unknownSquareProfile = {
  nickname: "未知用户",
  avatar_url: null,
  is_vip: false,
};

export function assembleSquarePosts(input: {
  postsData: any[];
  profileMap: Map<string, any>;
  likedPostIds: Set<string>;
}) {
  return input.postsData.map((post: any) => ({
    ...post,
    profiles: input.profileMap.get(post.user_id) || unknownSquareProfile,
    like_count: post.post_likes?.length || 0,
    comment_count: post.post_comments?.[0]?.count || 0,
    is_liked: input.likedPostIds.has(post.id),
    liked_by:
      post.post_likes
        ?.map((like: any) => input.profileMap.get(like.user_id))
        .filter(Boolean) || [],
  })) as Post[];
}

export function getSquareFeedProfileIds(postsData: any[]) {
  const authorIds = postsData.map((post) => post.user_id);
  const likerIds = postsData.flatMap((post) =>
    post.post_likes ? post.post_likes.map((like: any) => like.user_id) : []
  );
  return Array.from(new Set([...authorIds, ...likerIds])).filter(Boolean);
}

export function buildSquareProfileMap(profilesData: any[] | null | undefined) {
  return new Map(
    profilesData?.map((profile: any) => [profile.id, profile]) || []
  );
}

export function getPostsNeedingCommentPreviews(posts: Post[]) {
  return posts.filter(
    (post) =>
      (post.comment_count || 0) > 0 && post.latest_comments === undefined
  );
}

export function getCommentPreviewProfileIds(
  results: Array<{ comments: any[] }>
) {
  const userIds = new Set<string>();

  results.forEach((result) => {
    result.comments.forEach((comment: any) => userIds.add(comment.user_id));
  });

  return Array.from(userIds);
}

export function attachSquareCommentPreviews(input: {
  posts: Post[];
  previews: Array<{ postId: string; comments: any[] }>;
  profileMap: Map<string, any>;
}) {
  return input.posts.map((post) => {
    const result = input.previews.find((item) => item.postId === post.id);
    if (!result) return post;

    return {
      ...post,
      latest_comments: result.comments.map((comment: any) => ({
        ...comment,
        profiles: input.profileMap.get(comment.user_id) || unknownSquareProfile,
      })),
    };
  });
}

export function formatRealtimeSquarePost(input: {
  postData: any;
  profileData: any | null | undefined;
}) {
  return {
    ...input.postData,
    profiles: input.profileData || unknownSquareProfile,
    like_count: input.postData.post_likes?.[0]?.count || 0,
    comment_count: input.postData.post_comments?.[0]?.count || 0,
  } as Post;
}

export function prependSquarePost(posts: Post[], post: Post) {
  if (posts.some((item) => item.id === post.id)) return posts;
  return [post, ...posts];
}

export function removeSquarePost(posts: Post[], postId: string) {
  return posts.filter((item) => item.id !== postId);
}

export function applyPostLikeState(input: {
  posts: Post[];
  postId: string;
  currentUser: { nickname?: string | null };
  liked: boolean;
}) {
  return input.posts.map((post) => {
    if (post.id !== input.postId) return post;

    if (input.liked) {
      return {
        ...post,
        like_count: (post.like_count || 0) + 1,
        is_liked: true,
        liked_by: [
          ...(post.liked_by || []),
          { nickname: input.currentUser.nickname || "我" },
        ],
      };
    }

    return {
      ...post,
      like_count: Math.max(0, (post.like_count || 0) - 1),
      is_liked: false,
      liked_by: (post.liked_by || []).filter(
        (user) => user.nickname !== input.currentUser.nickname
      ),
    };
  });
}

export function applyPostCommentAdded(input: {
  posts: Post[];
  postId: string;
  comment: PostComment;
}) {
  return input.posts.map((post) => {
    if (post.id !== input.postId) return post;

    return {
      ...post,
      comment_count: (post.comment_count || 0) + 1,
      latest_comments: [input.comment, ...(post.latest_comments || [])].slice(
        0,
        1
      ),
    };
  });
}

export function applyPostCommentDeleted(input: {
  posts: Post[];
  postId: string;
}) {
  return input.posts.map((post) =>
    post.id === input.postId
      ? {
          ...post,
          comment_count: Math.max(0, (post.comment_count || 0) - 1),
        }
      : post
  );
}

export function applyCommentLikeState(input: {
  comments: Record<string, PostComment[]>;
  postId: string;
  commentId: string;
  liked: boolean;
}) {
  return {
    ...input.comments,
    [input.postId]: (input.comments[input.postId] || []).map((comment) =>
      comment.id === input.commentId
        ? {
            ...comment,
            like_count: input.liked
              ? (comment.like_count || 0) + 1
              : Math.max(0, (comment.like_count || 0) - 1),
            is_liked: input.liked,
          }
        : comment
    ),
  };
}

export interface SquareFeedActionResult {
  ok: boolean;
  message?: string;
}

export interface SquareFeedContext {
  activeChannelId: string | null;
  currentUser: any;
  posts: Post[];
}

export interface SquareFeedRepository {
  fetchProfilesByIds: (userIds: string[]) => Promise<{ data?: any[] | null }>;
  fetchLikedPostIds: (userId: string, postIds: string[]) => Promise<Set<string>>;
  fetchLatestComments: (
    postId: string,
    limit?: number
  ) => Promise<{ data?: any[] | null }>;
  fetchPostWithCounts: (postId: string) => Promise<{ data?: any | null }>;
  fetchProfileById: (userId: string) => Promise<{ data?: any | null }>;
  uploadPostImage: (userId: string, file: File) => Promise<string>;
  createPost: (postData: {
    channel_id: string;
    user_id: string;
    content: string;
    image_url?: string;
  }) => Promise<{ error?: any | null }>;
  createNotification: (payload: {
    user_id: string;
    actor_id: string;
    type: string;
    post_id: string;
  }) => Promise<{ error?: any | null }>;
  likePost: (postId: string, userId: string) => Promise<{ error?: any | null }>;
  unlikePost: (
    postId: string,
    userId: string
  ) => Promise<{ error?: any | null }>;
  deletePost: (postId: string) => Promise<{ error?: any | null }>;
}

export interface SquareFeedLocalState {
  replacePosts: (updater: (previousPosts: Post[]) => Post[]) => void;
}

export function createSquareFeedExecutor(input: {
  getContext: () => SquareFeedContext;
  repository: SquareFeedRepository;
  localState: SquareFeedLocalState;
}) {
  const formatPosts = async (postsData: any[]) => {
    const { currentUser } = input.getContext();
    const { data: profilesData } = await input.repository.fetchProfilesByIds(
      getSquareFeedProfileIds(postsData)
    );
    const profileMap = buildSquareProfileMap(profilesData);
    let likedPostIds = new Set<string>();

    if (currentUser) {
      likedPostIds = await input.repository.fetchLikedPostIds(
        currentUser.id,
        postsData.map((post) => post.id)
      );
    }

    return assembleSquarePosts({
      postsData,
      profileMap,
      likedPostIds,
    });
  };

  const attachCommentPreviews = async (posts: Post[]) => {
    const postsNeedingComments = getPostsNeedingCommentPreviews(posts);
    if (postsNeedingComments.length === 0) return posts;

    const previews = await Promise.all(
      postsNeedingComments.map(async (post) => {
        const { data } = await input.repository.fetchLatestComments(post.id, 1);
        return { postId: post.id, comments: data || [] };
      })
    );
    const { data: profiles } = await input.repository.fetchProfilesByIds(
      getCommentPreviewProfileIds(previews)
    );

    return attachSquareCommentPreviews({
      posts,
      previews,
      profileMap: buildSquareProfileMap(profiles),
    });
  };

  const prependRealtimePost = async (postId: string) => {
    const { data: postData } = await input.repository.fetchPostWithCounts(postId);
    if (!postData) return;

    const { data: profileData } = await input.repository.fetchProfileById(
      postData.user_id
    );
    const formattedPost = formatRealtimeSquarePost({ postData, profileData });

    input.localState.replacePosts((previous) =>
      prependSquarePost(previous, formattedPost)
    );
  };

  const publishPost = async (
    content: string,
    imageFile?: File
  ): Promise<SquareFeedActionResult> => {
    const { activeChannelId, currentUser } = input.getContext();
    if ((!content.trim() && !imageFile) || !activeChannelId || !currentUser) {
      return { ok: false };
    }

    const postData: {
      channel_id: string;
      user_id: string;
      content: string;
      image_url?: string;
    } = {
      channel_id: activeChannelId,
      user_id: currentUser.id,
      content: content.trim(),
    };

    if (imageFile) {
      postData.image_url = await input.repository.uploadPostImage(
        currentUser.id,
        imageFile
      );
    }

    const { error } = await input.repository.createPost(postData);
    if (error) return { ok: false, message: "发布失败: " + error.message };

    return { ok: true };
  };

  const togglePostLike = async (postId: string) => {
    const { currentUser, posts } = input.getContext();
    if (!currentUser) return;

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    if (post.is_liked) {
      const { error } = await input.repository.unlikePost(postId, currentUser.id);
      if (!error) {
        input.localState.replacePosts((previous) =>
          applyPostLikeState({
            posts: previous,
            postId,
            currentUser,
            liked: false,
          })
        );
      }
      return;
    }

    const { error } = await input.repository.likePost(postId, currentUser.id);
    if (error) return;

    input.localState.replacePosts((previous) =>
      applyPostLikeState({
        posts: previous,
        postId,
        currentUser,
        liked: true,
      })
    );

    if (post.user_id !== currentUser.id) {
      await input.repository.createNotification({
        user_id: post.user_id,
        actor_id: currentUser.id,
        type: "like",
        post_id: postId,
      });
    }
  };

  const deleteFeedPost = async (postId: string) => {
    const { currentUser, posts } = input.getContext();
    if (!currentUser) return false;

    const post = posts.find((item) => item.id === postId);
    if (!post || post.user_id !== currentUser.id) return false;

    const { error } = await input.repository.deletePost(postId);
    if (error) return false;

    input.localState.replacePosts((previous) => removeSquarePost(previous, postId));
    return true;
  };

  return {
    formatPosts,
    attachCommentPreviews,
    prependRealtimePost,
    publishPost,
    togglePostLike,
    deleteFeedPost,
  };
}
