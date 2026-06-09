import { useMemo, useRef, useState } from "react";
import type { Post } from "../types";
import {
  createComment,
  createNotification,
  deleteComment,
  fetchPostComments,
  fetchProfileById,
  fetchProfilesByIds,
  likeComment,
  unlikeComment,
} from "../services/squareCommentsRepository";
import {
  createSquareCommentsExecutor,
  type SquareCommentsByPost,
} from "../services/squareCommentsModel";

interface UseSquareCommentsOptions {
  currentUser: any;
  posts: Post[];
  setPosts: (updater: (previousPosts: Post[]) => Post[]) => void;
}

export function useSquareComments({
  currentUser,
  posts,
  setPosts,
}: UseSquareCommentsOptions) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<SquareCommentsByPost>({});
  const [loadingComments, setLoadingComments] = useState<
    Record<string, boolean>
  >({});
  const commentsContextRef = useRef({
    currentUser,
    posts,
    comments,
    selectedPostId,
  });

  commentsContextRef.current = {
    currentUser,
    posts,
    comments,
    selectedPostId,
  };

  const commentsExecutor = useMemo(
    () =>
      createSquareCommentsExecutor({
        getContext: () => commentsContextRef.current,
        repository: {
          fetchPostComments,
          fetchProfilesByIds,
          createComment,
          createNotification,
          fetchProfileById,
          likeComment,
          unlikeComment,
          deleteComment,
        },
        localState: {
          replaceComments: setComments,
          replacePosts: setPosts,
          setCommentLoading: (postId, isLoading) => {
            setLoadingComments((previous) => ({
              ...previous,
              [postId]: isLoading,
            }));
          },
        },
      }),
    [setPosts]
  );

  return {
    selectedPostId,
    setSelectedPostId,
    comments,
    loadingComments,
    fetchComments: commentsExecutor.fetchComments,
    sendComment: commentsExecutor.sendComment,
    toggleCommentLike: commentsExecutor.toggleCommentLike,
    deleteComment: commentsExecutor.deleteComment,
  };
}
