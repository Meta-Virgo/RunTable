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
  const postRequestIdRef = useRef(0);
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
    let eagerChannels: Channel[] = [];

    const applyDefaultChannel = (nextChannels: Channel[]) => {
      if (feedContextRef.current.activeChannelId) return;
      const defaultChannel =
        nextChannels.find((channel) => channel.name === DEFAULT_CHANNEL_NAME) ||
        nextChannels[0];
      if (defaultChannel) setActiveChannelId(defaultChannel.id);
    };

    const loadChannelsFirst = async () => {
      try {
        const { data } = await fetchChannels();
        if (cancelled) return;

        eagerChannels = data || [];
        if (data) setChannels(data);
      } catch (error) {
        console.error("Failed to preload square channels:", error);
      } finally {
        if (!cancelled) setLoadingChannels(false);
      }
    };

    const applyBootstrap = async (channelId: string | null = null) => {
      const requestId = ++postRequestIdRef.current;
      const { data, error } = await fetchSquareFeedBootstrap(channelId);

      if (error) {
        if (isMissingSquareFeedBootstrapError(error)) {
          useBootstrapRef.current = false;
          return false;
        }

        throw error;
      }

      if (cancelled) return true;
      if (requestId !== postRequestIdRef.current) return true;

      const bootstrap = data as any;
      const bootstrapChannels = (bootstrap?.channels || []) as Channel[];
      const bootstrapPosts = (bootstrap?.posts || []) as Post[];
      const nextActiveChannelId = bootstrap?.active_channel_id || null;
      const nextCurrentUser = bootstrap?.current_user || null;

      feedContextRef.current = {
        activeChannelId: nextActiveChannelId,
        currentUser: nextCurrentUser,
        posts: bootstrapPosts,
      };

      setCurrentUser(nextCurrentUser);
      setChannels(bootstrapChannels);
      skipNextPostRefreshRef.current = Boolean(bootstrap?.active_channel_id);
      setActiveChannelId(nextActiveChannelId);
      setPosts(bootstrapPosts);
      setLoadingChannels(false);
      setLoadingPosts(false);
      return true;
    };

    const init = async () => {
      const channelsPromise = loadChannelsFirst();

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

      await channelsPromise;
      if (cancelled) return;
      applyDefaultChannel(eagerChannels);
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

    const channelId = activeChannelId;
    const requestId = ++postRequestIdRef.current;
    const isCurrentRequest = () =>
      requestId === postRequestIdRef.current &&
      feedContextRef.current.activeChannelId === channelId;

    setLoadingPosts(true);

    try {
      if (useBootstrapRef.current) {
        try {
          const { data, error } = await fetchSquareFeedBootstrap(channelId);

          if (!isCurrentRequest()) return;

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
            return;
          }
        } catch (error) {
          if (!isCurrentRequest()) return;
          console.error("Failed to refresh square feed bootstrap:", error);
          useBootstrapRef.current = false;
        }
      }

      const { data } = await fetchPostsForChannel(channelId);

      if (!isCurrentRequest()) return;

      if (data) {
        const formattedPosts = await feedExecutor.formatPosts(data);
        if (isCurrentRequest()) setPosts(formattedPosts);
      }
    } catch (error) {
      if (isCurrentRequest()) {
        console.error("Failed to refresh square posts:", error);
      }
    } finally {
      if (isCurrentRequest()) setLoadingPosts(false);
    }
  }, [activeChannelId, feedExecutor]);

  const selectChannel = useCallback((channelId: string) => {
    if (feedContextRef.current.activeChannelId === channelId) return;

    postRequestIdRef.current += 1;
    skipNextPostRefreshRef.current = false;
    feedContextRef.current = {
      ...feedContextRef.current,
      activeChannelId: channelId,
      posts: [],
    };

    setActiveChannelId(channelId);
    setPosts([]);
    setLoadingPosts(true);
  }, []);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (useBootstrapRef.current) return;
    if (posts.length === 0) return;

    let cancelled = false;
    const channelId = activeChannelId;
    const requestId = postRequestIdRef.current;

    feedExecutor.attachCommentPreviews(posts).then((nextPosts) => {
      if (
        !cancelled &&
        requestId === postRequestIdRef.current &&
        feedContextRef.current.activeChannelId === channelId
      ) {
        setPosts(nextPosts);
      }
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
          await feedExecutor.prependRealtimePost(
            payload.new.id,
            () => feedContextRef.current.activeChannelId === activeChannelId
          );
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
    selectChannel,
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
