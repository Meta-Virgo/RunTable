import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClipboardEvent, DragEvent, MouseEvent } from "react";
import type { Character, CreateSquarePostModuleInput } from "../types";
import { fetchUserInvestigators } from "../services/characters";
import { createCharacterSummaryModule } from "../services/squarePostModules";
import { mapCharacterRow } from "../utils/characterMapper";
import { useSquareComments } from "./useSquareComments";
import { useSquareFeed } from "./useSquareFeed";
import { useSquareNotifications } from "./useSquareNotifications";
import { useSquareProfilePanel } from "./useSquareProfilePanel";

interface PendingSquareImage {
  dataUrl: string;
  name: string;
  file: File;
}

type DeleteTarget =
  | { open: true; type: "post"; postId: string }
  | { open: true; type: "comment"; postId: string; commentId: string }
  | { open: false; type: null };

const idleDeleteTarget: DeleteTarget = { open: false, type: null };

export function useSquareExperience() {
  const feed = useSquareFeed();
  const [searchQuery, setSearchQuery] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [pendingImage, setPendingImage] =
    useState<PendingSquareImage | null>(null);
  const [pendingModules, setPendingModules] = useState<
    CreateSquarePostModuleInput[]
  >([]);
  const [shareableCharacters, setShareableCharacters] = useState<Character[]>(
    []
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [confirmDelete, setConfirmDelete] =
    useState<DeleteTarget>(idleDeleteTarget);

  const comments = useSquareComments({
    currentUser: feed.currentUser,
    posts: feed.posts,
    setPosts: feed.setPosts,
  });
  const notifications = useSquareNotifications(
    feed.currentUser,
    showNotifications
  );
  const profilePanel = useSquareProfilePanel();

  const activeChannel = useMemo(
    () => feed.channels.find((channel) => channel.id === feed.activeChannelId),
    [feed.activeChannelId, feed.channels]
  );
  const categories = useMemo(
    () => Array.from(new Set(feed.channels.map((channel) => channel.category))),
    [feed.channels]
  );
  const selectedPost = useMemo(
    () =>
      comments.selectedPostId
        ? feed.posts.find((post) => post.id === comments.selectedPostId) || null
        : null,
    [comments.selectedPostId, feed.posts]
  );
  const selectedPostComments = comments.selectedPostId
    ? comments.comments[comments.selectedPostId] || []
    : [];
  const selectedPostLoading = comments.selectedPostId
    ? Boolean(comments.loadingComments[comments.selectedPostId])
    : false;

  useEffect(() => {
    if (!feed.currentUser?.id) {
      setShareableCharacters([]);
      return;
    }

    let cancelled = false;
    fetchUserInvestigators(feed.currentUser.id).then(({ data }) => {
      if (!cancelled) {
        setShareableCharacters((data || []).map((row: any) => mapCharacterRow(row)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [feed.currentUser?.id]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPendingImage({ dataUrl: result, name: file.name, file });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData.items;
      for (let index = 0; index < items.length; index++) {
        if (items[index].type.indexOf("image") !== -1) {
          const file = items[index].getAsFile();
          if (file) processFile(file);
        }
      }
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const [file] = Array.from(event.dataTransfer.files);
      if (file) processFile(file);
    },
    [processFile]
  );

  const handlePost = useCallback(async () => {
    setPosting(true);
    try {
      const result = await feed.publishPost(
        newPostContent,
        pendingImage?.file,
        pendingModules
      );
      if (!result.ok && result.message) {
        alert(result.message);
      } else if (result.ok) {
        setNewPostContent("");
        setPendingImage(null);
        setPendingModules([]);
      }
    } catch (error: any) {
      alert("图片上传失败: " + error.message);
    } finally {
      setPosting(false);
    }
  }, [feed.publishPost, newPostContent, pendingImage?.file, pendingModules]);

  const addCharacterModule = useCallback((character: Character) => {
    setPendingModules((previous) => [
      ...previous,
      createCharacterSummaryModule(character),
    ]);
  }, []);

  const removeModule = useCallback((index: number) => {
    setPendingModules((previous) =>
      previous.filter((_module, moduleIndex) => moduleIndex !== index)
    );
  }, []);

  const openPost = useCallback(
    (postId: string) => {
      comments.setSelectedPostId(postId);
      void comments.fetchComments(postId);
    },
    [comments]
  );

  const closePost = useCallback(() => {
    comments.setSelectedPostId(null);
  }, [comments]);

  const handleDeleteNotification = useCallback(
    async (event: MouseEvent, notificationId: string) => {
      event.stopPropagation();
      const result = await notifications.deleteNotification(notificationId);
      if (!result.ok && result.message) {
        alert(result.message);
      }
    },
    [notifications]
  );

  const handleSendComment = useCallback(
    (postId: string, content?: string, quoteId?: string) =>
      comments.sendComment(postId, content || "", quoteId),
    [comments]
  );

  const handleLikePost = useCallback(
    async (postId: string) => {
      await feed.togglePostLike(postId);
    },
    [feed]
  );

  const handleLikeComment = useCallback(
    async (commentId: string) => {
      await comments.toggleCommentLike(commentId);
    },
    [comments]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      const deleted = await feed.deleteFeedPost(postId);
      if (deleted && comments.selectedPostId === postId) {
        comments.setSelectedPostId(null);
      }
    },
    [comments, feed]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string, postId: string) => {
      await comments.deleteComment(commentId, postId);
    },
    [comments]
  );

  const requestDeletePost = useCallback((postId: string) => {
    setConfirmDelete({ open: true, type: "post", postId });
  }, []);

  const requestDeleteComment = useCallback(
    (commentId: string, postId: string) => {
      setConfirmDelete({ open: true, type: "comment", commentId, postId });
    },
    []
  );

  const cancelDelete = useCallback(() => {
    setConfirmDelete(idleDeleteTarget);
  }, []);

  const performDelete = useCallback(async () => {
    if (!confirmDelete.open) return;

    if (confirmDelete.type === "post") {
      await handleDeletePost(confirmDelete.postId);
    } else {
      await handleDeleteComment(confirmDelete.commentId, confirmDelete.postId);
    }

    setConfirmDelete(idleDeleteTarget);
  }, [confirmDelete, handleDeleteComment, handleDeletePost]);

  const selectChannel = useCallback(
    (channelId: string) => {
      feed.setActiveChannelId(channelId);
      setShowMobileSidebar(false);
    },
    [feed]
  );

  return {
    feed: {
      activeChannelId: feed.activeChannelId,
      activeChannel,
      categories,
      channels: feed.channels,
      posts: feed.posts,
      loadingChannels: feed.loadingChannels,
      loadingPosts: feed.loadingPosts,
      currentUser: feed.currentUser,
      selectChannel,
      handleLikePost,
    },
    composer: {
      searchQuery,
      setSearchQuery,
      newPostContent,
      setNewPostContent,
      posting,
      pendingImage,
      pendingModules,
      shareableCharacters,
      addCharacterModule,
      removeModule,
      clearPendingImage: () => setPendingImage(null),
      processFile,
      handlePaste,
      handleDrop,
      handlePost,
    },
    comments: {
      selectedPostId: comments.selectedPostId,
      selectedPost,
      selectedPostComments,
      selectedPostLoading,
      openPost,
      closePost,
      handleSendComment,
      handleLikeComment,
    },
    notifications: {
      showNotifications,
      openNotifications: () => setShowNotifications(true),
      closeNotifications: () => setShowNotifications(false),
      toggleNotifications: () =>
        setShowNotifications((previous) => !previous),
      notifications: notifications.notifications,
      unreadCount: notifications.unreadCount,
      markAsRead: notifications.markAsRead,
      handleDeleteNotification,
    },
    mobileSidebar: {
      showMobileSidebar,
      openMobileSidebar: () => setShowMobileSidebar(true),
      closeMobileSidebar: () => setShowMobileSidebar(false),
    },
    profilePanel,
    deletion: {
      dialog: {
        open: confirmDelete.open,
        title:
          confirmDelete.type === "post" ? "删除发言确认" : "删除评论确认",
        content:
          confirmDelete.type === "post"
            ? "确定要删除这条发言吗？删除后不可恢复。"
            : "确定要删除这条评论吗？删除后不可恢复。",
        onCancel: cancelDelete,
        onConfirm: performDelete,
      },
      requestDeletePost,
      requestDeleteComment,
    },
  };
}
