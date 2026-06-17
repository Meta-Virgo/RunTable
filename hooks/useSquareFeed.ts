import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { Channel, CreateSquarePostModuleInput, Post } from "../types";
import {
  createNotification,
  createPost,
  createPostModules,
  deletePost,
  fetchChannels,
  fetchSquareFeedBootstrap,
  fetchLatestComments,
  fetchLikedPostIds,
  fetchPostsForChannel,
  fetchPostWithCounts,
  fetchProfileById,
  fetchProfilesByIds,
  fetchSquareUser,
  isMissingSquareFeedBootstrapError,
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
  const useBootstrapRef = useRef(true);
  const skipNextPostRefreshRef = useRef(false);
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
          createPostModules,
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
    let cancelled = false;

    const applyBootstrap = async (channelId: string | null = null) => {
      const { data, error } = await fetchSquareFeedBootstrap(channelId);

      if (error) {
        if (isMissingSquareFeedBootstrapError(error)) {
          useBootstrapRef.current = false;
          return false;
        }

        throw error;
      }

      if (cancelled) return true;

      const bootstrap = data as any;
      const bootstrapChannels = (bootstrap?.channels || []) as Channel[];
      setCurrentUser(bootstrap?.current_user || null);
      setChannels(bootstrapChannels);
      skipNextPostRefreshRef.current = Boolean(bootstrap?.active_channel_id);
      setActiveChannelId(bootstrap?.active_channel_id || null);
      setPosts((bootstrap?.posts || []) as Post[]);
      setLoadingChannels(false);
      setLoadingPosts(false);
      return true;
    };

    const init = async () => {
      if (useBootstrapRef.current) {
        try {
          const loaded = await applyBootstrap();
          if (loaded) return;
        } catch (error) {
          console.error("Failed to load square feed bootstrap:", error);
          useBootstrapRef.current = false;
        }
      }

      const user = await fetchSquareUser();
      if (cancelled) return;
      setCurrentUser(user || null);

      const { data } = await fetchChannels();
      if (cancelled) return;
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

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPosts = useCallback(async () => {
    if (!activeChannelId) return;
    if (skipNextPostRefreshRef.current) {
      skipNextPostRefreshRef.current = false;
      return;
    }

    setLoadingPosts(true);

    if (useBootstrapRef.current) {
      try {
        const { data, error } = await fetchSquareFeedBootstrap(activeChannelId);

        if (error) {
          if (isMissingSquareFeedBootstrapError(error)) {
            useBootstrapRef.current = false;
          } else {
            throw error;
          }
        } else {
          const bootstrap = data as any;
          setCurrentUser(bootstrap?.current_user || null);
          if (bootstrap?.channels) setChannels(bootstrap.channels as Channel[]);
          setPosts((bootstrap?.posts || []) as Post[]);
          setLoadingPosts(false);
          return;
        }
      } catch (error) {
        console.error("Failed to refresh square feed bootstrap:", error);
        useBootstrapRef.current = false;
      }
    }

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
    if (useBootstrapRef.current) return;
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
    async (
      content: string,
      imageFile?: File,
      modules?: CreateSquarePostModuleInput[]
    ) => feedExecutor.publishPost(content, imageFile, modules),
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
