import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Channel, Post } from "../types";
import {
  createNotification,
  createPost,
  deletePost,
  fetchChannels,
  fetchLatestComments,
  fetchLikedPostIds,
  fetchPostsForChannel,
  fetchPostWithCounts,
  fetchProfileById,
  fetchProfilesByIds,
  fetchSquareUser,
  likePost,
  unlikePost,
  uploadPostImage,
} from "../services/square";

const unknownProfile = {
  nickname: "未知用户",
  avatar_url: null,
  is_vip: false,
};

const formatPosts = async (postsData: any[], currentUser: any) => {
  const authorIds = postsData.map((post) => post.user_id);
  const likerIds = postsData.flatMap((post) =>
    post.post_likes ? post.post_likes.map((like: any) => like.user_id) : []
  );
  const allUserIds = Array.from(new Set([...authorIds, ...likerIds]));
  const { data: profilesData } = await fetchProfilesByIds(allUserIds);
  const profileMap = new Map(
    profilesData?.map((profile: any) => [profile.id, profile]) || []
  );
  let myLikedPostIds = new Set<string>();

  if (currentUser) {
    myLikedPostIds = await fetchLikedPostIds(
      currentUser.id,
      postsData.map((post) => post.id)
    );
  }

  return postsData.map((post: any) => ({
    ...post,
    profiles: profileMap.get(post.user_id) || unknownProfile,
    like_count: post.post_likes?.length || 0,
    comment_count: post.post_comments?.[0]?.count || 0,
    is_liked: myLikedPostIds.has(post.id),
    liked_by:
      post.post_likes
        ?.map((like: any) => profileMap.get(like.user_id))
        .filter(Boolean) || [],
  })) as Post[];
};

const attachCommentPreviews = async (posts: Post[]) => {
  const postsNeedingComments = posts.filter(
    (post) => (post.comment_count || 0) > 0 && post.latest_comments === undefined
  );

  if (postsNeedingComments.length === 0) return posts;

  const results = await Promise.all(
    postsNeedingComments.map(async (post) => {
      const { data } = await fetchLatestComments(post.id, 1);
      return { postId: post.id, comments: data || [] };
    })
  );
  const userIds = new Set<string>();

  results.forEach((result) => {
    result.comments.forEach((comment: any) => userIds.add(comment.user_id));
  });

  let profileMap = new Map();
  if (userIds.size > 0) {
    const { data: profiles } = await fetchProfilesByIds(Array.from(userIds));
    if (profiles) {
      profileMap = new Map(profiles.map((profile: any) => [profile.id, profile]));
    }
  }

  return posts.map((post) => {
    const result = results.find((item) => item.postId === post.id);
    if (!result) return post;

    return {
      ...post,
      latest_comments: result.comments.map((comment: any) => ({
        ...comment,
        profiles: profileMap.get(comment.user_id) || unknownProfile,
      })),
    };
  });
};

export function useSquareFeed() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const user = await fetchSquareUser();
      if (user) setCurrentUser(user);

      const { data } = await fetchChannels();
      if (data) {
        setChannels(data);
        const defaultChannel =
          data.find((channel) => channel.name === "闲聊大厅") || data[0];
        if (defaultChannel) setActiveChannelId(defaultChannel.id);
      }

      setLoadingChannels(false);
    };

    init();
  }, []);

  const refreshPosts = useCallback(async () => {
    if (!activeChannelId) return;

    setLoadingPosts(true);
    const { data } = await fetchPostsForChannel(activeChannelId);

    if (data) {
      setPosts(await formatPosts(data, currentUser));
    }

    setLoadingPosts(false);
  }, [activeChannelId, currentUser]);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (posts.length === 0) return;

    let cancelled = false;

    attachCommentPreviews(posts).then((nextPosts) => {
      if (!cancelled) setPosts(nextPosts);
    });

    return () => {
      cancelled = true;
    };
  }, [activeChannelId, posts.length]);

  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`posts:${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          const { data: postData } = await fetchPostWithCounts(payload.new.id);
          if (!postData) return;

          const { data: profileData } = await fetchProfileById(postData.user_id);
          const formattedPost: Post = {
            ...postData,
            profiles: profileData || unknownProfile,
            like_count: postData.post_likes?.[0]?.count || 0,
            comment_count: postData.post_comments?.[0]?.count || 0,
          };

          setPosts((prev) => [formattedPost, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  const publishPost = useCallback(
    async (content: string, imageFile?: File) => {
      if ((!content.trim() && !imageFile) || !activeChannelId || !currentUser) {
        return { ok: false };
      }

      const postData: any = {
        channel_id: activeChannelId,
        user_id: currentUser.id,
        content: content.trim(),
      };

      if (imageFile) {
        postData.image_url = await uploadPostImage(currentUser.id, imageFile);
      }

      const { error } = await createPost(postData);
      if (error) return { ok: false, message: "发布失败: " + error.message };

      return { ok: true };
    },
    [activeChannelId, currentUser]
  );

  const togglePostLike = useCallback(
    async (postId: string) => {
      if (!currentUser) return;

      const post = posts.find((item) => item.id === postId);
      if (!post) return;

      if (post.is_liked) {
        const { error } = await unlikePost(postId, currentUser.id);
        if (!error) {
          setPosts((prev) =>
            prev.map((item) =>
              item.id === postId
                ? {
                    ...item,
                    like_count: Math.max(0, (item.like_count || 0) - 1),
                    is_liked: false,
                    liked_by: (item.liked_by || []).filter(
                      (user) => user.nickname !== currentUser.nickname
                    ),
                  }
                : item
            )
          );
        }
        return;
      }

      const { error } = await likePost(postId, currentUser.id);
      if (!error) {
        setPosts((prev) =>
          prev.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  like_count: (item.like_count || 0) + 1,
                  is_liked: true,
                  liked_by: [
                    ...(item.liked_by || []),
                    { nickname: currentUser.nickname || "我" },
                  ],
                }
              : item
          )
        );

        if (post.user_id !== currentUser.id) {
          await createNotification({
            user_id: post.user_id,
            actor_id: currentUser.id,
            type: "like",
            post_id: postId,
          });
        }
      }
    },
    [currentUser, posts]
  );

  const deleteFeedPost = useCallback(
    async (postId: string) => {
      if (!currentUser) return false;

      const post = posts.find((item) => item.id === postId);
      if (!post || post.user_id !== currentUser.id) return false;

      const { error } = await deletePost(postId);
      if (error) return false;

      setPosts((prev) => prev.filter((item) => item.id !== postId));
      return true;
    },
    [currentUser, posts]
  );

  return {
    activeChannelId,
    setActiveChannelId,
    channels,
    posts,
    setPosts,
    loadingChannels,
    loadingPosts,
    currentUser,
    publishPost,
    togglePostLike,
    deleteFeedPost,
  };
}
