import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "../services/squareFeedRepository";
import { createSquareFeedExecutor } from "../services/squareFeedModel";

const DEFAULT_CHANNEL_NAME = "闲聊大厅";

export function useSquareFeed() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const feedContextRef = useRef({
    activeChannelId: null as string | null,
    currentUser: null as any,
    posts: [] as Post[],
  });

  feedContextRef.current = {
    activeChannelId,
    currentUser,
    posts,
  };

  const feedExecutor = useMemo(
    () =>
      createSquareFeedExecutor({
        getContext: () => feedContextRef.current,
        repository: {
          fetchProfilesByIds,
          fetchLikedPostIds,
          fetchLatestComments,
          fetchPostWithCounts,
          fetchProfileById,
          uploadPostImage,
          createPost,
          createNotification,
          likePost,
          unlikePost,
          deletePost,
        },
        localState: {
          replacePosts: setPosts,
        },
      }),
    []
  );

  useEffect(() => {
    const init = async () => {
      const user = await fetchSquareUser();
      if (user) setCurrentUser(user);

      const { data } = await fetchChannels();
      if (data) {
        setChannels(data);
        const defaultChannel =
          data.find((channel) => channel.name === DEFAULT_CHANNEL_NAME) ||
          data[0];
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
      setPosts(await feedExecutor.formatPosts(data));
    }

    setLoadingPosts(false);
  }, [activeChannelId, feedExecutor]);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (posts.length === 0) return;

    let cancelled = false;

    feedExecutor.attachCommentPreviews(posts).then((nextPosts) => {
      if (!cancelled) setPosts(nextPosts);
    });

    return () => {
      cancelled = true;
    };
  }, [activeChannelId, feedExecutor, posts.length]);

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
          await feedExecutor.prependRealtimePost(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, feedExecutor]);

  const publishPost = useCallback(
    async (content: string, imageFile?: File) =>
      feedExecutor.publishPost(content, imageFile),
    [feedExecutor]
  );

  const togglePostLike = useCallback(
    async (postId: string) => {
      await feedExecutor.togglePostLike(postId);
    },
    [feedExecutor]
  );

  const deleteFeedPost = useCallback(
    async (postId: string) => feedExecutor.deleteFeedPost(postId),
    [feedExecutor]
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
