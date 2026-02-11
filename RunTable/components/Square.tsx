import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import {
  Channel,
  Post,
  PostComment,
  Notification,
  Profile,
  GameHistory,
  GameHistoryParticipant,
  Character,
} from "../types";
import {
  Hash,
  Search,
  MessageSquare,
  Users,
  Bell,
  Loader2,
  Send,
  Heart,
  X,
  Trash2,
  CornerDownRight,
  ArrowUp,
  Menu,
  FileText,
} from "lucide-react";
import { Button, cn, Modal } from "./UI";
import { AvatarUpload } from "./AvatarUpload";
import { useElasticScroll } from "../hooks/useElasticScroll";

const MAX_POST_LENGTH = 140;

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();

  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `昨天 ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }

  const dayBefore = new Date(now);
  dayBefore.setDate(now.getDate() - 2);
  const isDayBefore =
    date.getDate() === dayBefore.getDate() &&
    date.getMonth() === dayBefore.getMonth() &&
    date.getFullYear() === dayBefore.getFullYear();

  if (isDayBefore) {
    return `前天 ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date
      .toLocaleDateString([], {
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-");
  }

  return date
    .toLocaleDateString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
};

const formatDetailTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const PostContent: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = content.length > MAX_POST_LENGTH;

  return (
    <div className="text-slate-300 text-sm leading-relaxed mb-2 whitespace-pre-wrap">
      {shouldTruncate && !expanded
        ? content.slice(0, MAX_POST_LENGTH) + "..."
        : content}
      {shouldTruncate && (
        <button
          className="ml-1 text-indigo-400 hover:text-indigo-300 text-xs font-bold hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
};

interface SquareProps {
  onScrollChange?: (direction: "up" | "down") => void;
}

export const Square: React.FC<SquareProps> = ({ onScrollChange }) => {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string;
    name: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Comments & Notifications
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<
    Record<string, boolean>
  >({});
  const [newCommentContent, setNewCommentContent] = useState("");
  const [_commenting, setCommenting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(scrollContainerRef, contentRef);

  const lastScrollTop = React.useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setShowBackToTop(scrollTop > 300);

        if (onScrollChange) {
          const diff = scrollTop - lastScrollTop.current;
          const isScrollingDown = diff > 0;
          const threshold = isScrollingDown ? 10 : 800;

          if (Math.abs(diff) > threshold) {
            if (isScrollingDown && scrollTop > 50) {
              onScrollChange("down");
            } else if (!isScrollingDown || scrollTop < 20) {
              onScrollChange("up");
            }
            lastScrollTop.current = scrollTop;
          } else if (scrollTop < 20) {
            onScrollChange("up");
            lastScrollTop.current = scrollTop;
          }
        }
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    type: "post" | "comment" | null;
    postId?: string;
    commentId?: string;
  }>({ open: false, type: null });
  const [historyTab, setHistoryTab] = useState<"player" | "kp">("player");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kpHistory, setKpHistory] = useState<GameHistory[]>([]);
  const [playerHistory, setPlayerHistory] = useState<
    (GameHistoryParticipant & {
      game_history: GameHistory;
      latest_character?: Character;
    })[]
  >([]);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setPendingImage({ dataUrl: result, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  // Fetch Channels & User
  useEffect(() => {
    const init = async () => {
      // 1. Get User
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setCurrentUser({ ...user, ...profile });
      }

      // 2. Get Channels
      const { data, error: _error } = await supabase
        .from("channels")
        .select("*")
        .order("category")
        .order("created_at");

      if (data) {
        setChannels(data);
        // Set default active channel (e.g., '闲聊大厅')
        const defaultChannel =
          data.find((c) => c.name === "闲聊大厅") || data[0];
        if (defaultChannel) setActiveChannelId(defaultChannel.id);
      }
      setLoadingChannels(false);
    };
    init();
  }, []);

  // Fetch Posts when active channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchPosts = async () => {
      setLoadingPosts(true);

      // 1. Fetch Posts (without profiles join first)
      const { data: postsData } = await supabase
        .from("posts")
        .select(
          `
          *,
          post_likes (user_id),
          post_comments (count)
        `
        )
        .eq("channel_id", activeChannelId)
        .order("created_at", { ascending: false });

      if (postsData) {
        // 2. Fetch Profiles manually (authors AND likers)
        const authorIds = postsData.map((p: any) => p.user_id);
        const likerIds = postsData.flatMap((p: any) =>
          p.post_likes ? p.post_likes.map((l: any) => l.user_id) : []
        );
        const allUserIds = Array.from(new Set([...authorIds, ...likerIds]));

        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, is_vip")
          .in("id", allUserIds);

        const profileMap = new Map(
          profilesData?.map((p: any) => [p.id, p]) || []
        );

        // 3. Fetch My Likes
        let myLikedPostIds = new Set();
        if (currentUser) {
          const { data: myLikes } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", currentUser.id)
            .in(
              "post_id",
              postsData.map((p) => p.id)
            );
          if (myLikes) {
            myLikedPostIds = new Set(myLikes.map((l) => l.post_id));
          }
        }

        // 4. Transform data
        const formattedPosts: Post[] = postsData.map((p: any) => ({
          ...p,
          profiles: profileMap.get(p.user_id) || {
            nickname: "未知用户",
            avatar_url: null,
            is_vip: false,
          },
          like_count: p.post_likes?.length || 0,
          comment_count: p.post_comments?.[0]?.count || 0,
          is_liked: myLikedPostIds.has(p.id),
          liked_by:
            p.post_likes
              ?.map((l: any) => profileMap.get(l.user_id))
              .filter(Boolean) || [],
        }));
        setPosts(formattedPosts);
      }
      setLoadingPosts(false);
    };

    fetchPosts();

    // Fetch latest comments for posts that have comments but no preview
    // We will do this in the effect dependency or a separate effect.
  }, [activeChannelId, currentUser]);

  // Separate effect for fetching comment previews
  useEffect(() => {
    if (posts.length === 0) return;

    // Identify posts that need comment previews
    const postsNeedingComments = posts.filter(
      (p) => (p.comment_count || 0) > 0 && p.latest_comments === undefined
    );

    if (postsNeedingComments.length === 0) return;

    const fetchPreviews = async () => {
      // Fetch in parallel for simplicity
      const results = await Promise.all(
        postsNeedingComments.map(async (post) => {
          const { data } = await supabase
            .from("post_comments")
            .select("*") // Fetch raw comments first
            .eq("post_id", post.id)
            .order("created_at", { ascending: false })
            .limit(1);
          return { postId: post.id, comments: data || [] };
        })
      );

      // Collect all user IDs from the fetched comments
      const userIds = new Set<string>();
      results.forEach((r) => {
        r.comments.forEach((c: any) => userIds.add(c.user_id));
      });

      // Fetch profiles for these users
      let profileMap = new Map();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, is_vip")
          .in("id", Array.from(userIds));

        if (profiles) {
          profileMap = new Map(profiles.map((p: any) => [p.id, p]));
        }
      }

      setPosts((prev) =>
        prev.map((p) => {
          const res = results.find((r) => r.postId === p.id);
          if (res) {
            // Attach profiles to comments
            const commentsWithProfiles = res.comments.map((c: any) => ({
              ...c,
              profiles: profileMap.get(c.user_id) || {
                nickname: "未知用户",
                avatar_url: null,
                is_vip: false,
              },
            }));
            return { ...p, latest_comments: commentsWithProfiles };
          }
          return p;
        })
      );
    };

    fetchPreviews();
  }, [posts, activeChannelId]); // Changed dependency to posts to ensure it runs when content updates but length matches

  // Realtime subscription for posts in this channel
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
          const newPostId = payload.new.id;
          // Fetch full post data
          const { data: postData } = await supabase
            .from("posts")
            .select(
              `
              *,
              post_likes (count),
              post_comments (count)
            `
            )
            .eq("id", newPostId)
            .single();

          if (postData) {
            // Fetch Profile for this user
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id, nickname, avatar_url, is_vip")
              .eq("id", postData.user_id)
              .single();

            const formattedPost: Post = {
              ...postData,
              profiles: profileData || {
                nickname: "未知用户",
                avatar_url: null,
                is_vip: false,
              },
              like_count: postData.post_likes?.[0]?.count || 0,
              comment_count: postData.post_comments?.[0]?.count || 0,
            };
            setPosts((prev) => [formattedPost, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  const handlePost = async () => {
    if (
      (!newPostContent.trim() && !pendingImage) ||
      !activeChannelId ||
      !currentUser
    )
      return;
    setPosting(true);

    const postData: any = {
      channel_id: activeChannelId,
      user_id: currentUser.id,
      content: newPostContent.trim(),
    };

    if (pendingImage) {
      postData.image_url = pendingImage.dataUrl;
    }

    const { error } = await supabase.from("posts").insert(postData);

    if (error) {
      alert("发布失败: " + error.message);
    } else {
      setNewPostContent("");
      setPendingImage(null);
    }
    setPosting(false);
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser, showNotifications]);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("notifications")
      .select("*, actor:actor_id(nickname, avatar_url), post:post_id(content)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as any);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const deleteNotification = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("notifications")
        .delete({ count: "exact" })
        .eq("id", notificationId);

      if (error) {
        console.error("Delete notification error:", error);
        alert("删除失败: " + error.message);
        return;
      }

      // 如果没有报错，即使 count 为 0 (可能已经被删除了)，我们也从 UI 移除
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === notificationId);
        if (target && !target.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n.id !== notificationId);
      });
    } catch (err) {
      console.error("Delete notification exception:", err);
      alert("删除时发生错误");
    }
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    const { data: rawComments } = await supabase
      .from("post_comments")
      .select(
        `
        *,
        quote:quote_id (
          id,
          content,
          user_id
        ),
        comment_likes (user_id)
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (rawComments && rawComments.length > 0) {
      // Collect all user IDs (commenters + quoted users)
      const userIds = new Set<string>();
      rawComments.forEach((c: any) => {
        userIds.add(c.user_id);
        if (c.quote?.user_id) {
          userIds.add(c.quote.user_id);
        }
      });

      // Fetch profiles
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url, is_vip")
        .in("id", Array.from(userIds));

      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      const myId = currentUser?.id;

      const merged = rawComments.map((c: any) => ({
        ...c,
        profiles: pmap.get(c.user_id) || {
          nickname: "未知用户",
          avatar_url: null,
          is_vip: false,
        },
        quote: c.quote
          ? {
              ...c.quote,
              profiles: pmap.get(c.quote.user_id) || { nickname: "未知用户" },
            }
          : null,
        like_count: c.comment_likes?.length || 0,
        is_liked: myId
          ? c.comment_likes?.some((l: any) => l.user_id === myId)
          : false,
      }));
      setComments((prev) => ({ ...prev, [postId]: merged }));
    } else {
      setComments((prev) => ({ ...prev, [postId]: [] }));
    }
    setLoadingComments((prev) => ({ ...prev, [postId]: false }));
  };

  const handleSendComment = async (
    postId: string,
    content?: string,
    quoteId?: string
  ) => {
    const finalContent = content || newCommentContent;
    if (!finalContent.trim() || !currentUser) return false;
    if (!content) setCommenting(true);

    const payload: any = {
      post_id: postId,
      user_id: currentUser.id,
      content: finalContent.trim(),
    };
    if (quoteId) payload.quote_id = quoteId;

    const { data, error } = await supabase
      .from("post_comments")
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      // Notify post owner if not self
      const post = posts.find((p) => p.id === postId);
      if (post && post.user_id !== currentUser.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: currentUser.id,
          type: "comment",
          post_id: postId,
        });
      }

      if (!content) setNewCommentContent("");
      fetchComments(postId);

      // Update comment count and latest_comments locally
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
      const newCommentObj: PostComment = {
        ...data,
        profiles: profile || {
          nickname: "我",
          avatar_url: null,
          is_vip: false,
        },
      };

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            // Update latest_comments (prepend)
            const newLatest = [
              newCommentObj,
              ...(p.latest_comments || []),
            ].slice(0, 1);
            return {
              ...p,
              comment_count: (p.comment_count || 0) + 1,
              latest_comments: newLatest,
            };
          }
          return p;
        })
      );
    }
    if (!content) setCommenting(false);
    return !error;
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.is_liked) {
      // Unlike
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .match({ post_id: postId, user_id: currentUser.id });
      if (!error) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  like_count: Math.max(0, (p.like_count || 0) - 1),
                  is_liked: false,
                  liked_by: (p.liked_by || []).filter(
                    (u) => u.nickname !== currentUser.nickname
                  ),
                }
              : p
          )
        );
      }
    } else {
      // Like
      const { error } = await supabase.from("post_likes").insert({
        post_id: postId,
        user_id: currentUser.id,
      });

      if (!error) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  like_count: (p.like_count || 0) + 1,
                  is_liked: true,
                  liked_by: [
                    ...(p.liked_by || []),
                    { nickname: currentUser.nickname || "我" },
                  ],
                }
              : p
          )
        );

        // Notify
        if (post.user_id !== currentUser.id) {
          await supabase.from("notifications").insert({
            user_id: post.user_id,
            actor_id: currentUser.id,
            type: "like",
            post_id: postId,
          });
        }
      }
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser || !selectedPostId) return;
    const postId = selectedPostId;
    const list = comments[postId] || [];
    const comment = list.find((c) => c.id === commentId);
    if (!comment) return;

    if (comment.is_liked) {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .match({ comment_id: commentId, user_id: currentUser.id });
      if (!error) {
        setComments((prev) => ({
          ...prev,
          [postId]: prev[postId].map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  like_count: Math.max(0, (c.like_count || 0) - 1),
                  is_liked: false,
                }
              : c
          ),
        }));
      }
    } else {
      const { error } = await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: currentUser.id,
      });
      if (!error) {
        setComments((prev) => ({
          ...prev,
          [postId]: prev[postId].map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  like_count: (c.like_count || 0) + 1,
                  is_liked: true,
                }
              : c
          ),
        }));

        if (comment.user_id !== currentUser.id) {
          await supabase.from("notifications").insert({
            user_id: comment.user_id,
            actor_id: currentUser.id,
            type: "comment_like", // We might need to handle this type in notifications or just map it to 'like' but strictly it's a comment like
            post_id: postId, // Keeping post_id for reference
            // You might want to add a comment_id column to notifications if you want to deep link
          });
        }
      }
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post || post.user_id !== currentUser.id) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPostId === postId) setSelectedPostId(null);
    }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!currentUser) return;
    const list = comments[postId] || [];
    const c = list.find((x) => x.id === commentId);
    if (!c || c.user_id !== currentUser.id) return;
    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId);
    if (!error) {
      setComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((x) => x.id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comment_count: Math.max(0, (p.comment_count || 0) - 1),
              }
            : p
        )
      );
    }
  };

  const requestDeletePost = (postId: string) => {
    setConfirmDelete({ open: true, type: "post", postId });
  };

  const requestDeleteComment = (commentId: string, postId: string) => {
    setConfirmDelete({ open: true, type: "comment", commentId, postId });
  };

  const performDelete = async () => {
    if (!confirmDelete.open || !confirmDelete.type) return;
    if (confirmDelete.type === "post" && confirmDelete.postId) {
      await handleDeletePost(confirmDelete.postId);
    } else if (
      confirmDelete.type === "comment" &&
      confirmDelete.commentId &&
      confirmDelete.postId
    ) {
      await handleDeleteComment(confirmDelete.commentId, confirmDelete.postId);
    }
    setConfirmDelete({ open: false, type: null });
  };

  const openProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setSelectedProfile(data as any);
      fetchUserHistory(userId);
      setShowProfile(true);
    }
  };

  const fetchUserHistory = async (userId: string) => {
    setHistoryLoading(true);
    const { data: kpData } = await supabase
      .from("game_histories")
      .select("*")
      .eq("kp_id", userId)
      .order("created_at", { ascending: false });
    if (kpData) setKpHistory(kpData);

    const { data: playerData } = await supabase
      .from("game_history_participants")
      .select(`*, game_history:game_histories (*)`)
      .eq("user_id", userId)
      .order("id", { ascending: false });
    if (playerData) {
      const charIds = playerData
        .map((p: any) => p.character_snapshot?.id)
        .filter(Boolean);
      let charMap = new Map<string, Character>();
      if (charIds.length > 0) {
        const { data: latestChars } = await supabase
          .from("characters")
          .select("*")
          .in("id", charIds);
        if (latestChars) {
          charMap = new Map(latestChars.map((c: any) => [c.id, c]));
        }
      }
      const sorted = (playerData as any[])
        .map((p) => ({
          ...p,
          latest_character: charMap.get(p.character_snapshot?.id as string),
        }))
        .sort(
          (a, b) =>
            new Date(b.game_history.created_at).getTime() -
            new Date(a.game_history.created_at).getTime()
        );
      setPlayerHistory(sorted);
    } else {
      setPlayerHistory([]);
    }
    setHistoryLoading(false);
  };

  const categories = Array.from(new Set(channels.map((c) => c.category)));
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const channelScrollRef = React.useRef<HTMLDivElement>(null);
  const channelContentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(channelScrollRef, channelContentRef);

  return (
    <div className="flex h-full bg-[#020617] text-slate-200 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Left Sidebar - Channels */}
      <div
        className={cn(
          "w-64 flex-shrink-0 border-r border-white/5 bg-slate-900 md:bg-slate-900/50 flex flex-col transition-transform duration-300 ease-in-out z-50",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          showMobileSidebar ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-white/5 justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <MessageSquare className="text-indigo-500" size={20} />
            广场频道
          </h2>
          <button
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setShowMobileSidebar(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div
          ref={channelScrollRef}
          className="flex-1 overflow-y-auto p-3 custom-scrollbar overscroll-y-none"
        >
          <div ref={channelContentRef} className="space-y-6">
            {loadingChannels ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-indigo-500" />
              </div>
            ) : (
              categories.map((category) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase px-3 mb-2 tracking-wider">
                    {category}
                  </h3>
                  <div className="space-y-0.5">
                    {channels
                      .filter((c) => c.category === category)
                      .map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => {
                            setActiveChannelId(channel.id);
                            setShowMobileSidebar(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                            activeChannelId === channel.id
                              ? "bg-indigo-500/20 text-indigo-300"
                              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Hash
                              size={16}
                              className={
                                activeChannelId === channel.id
                                  ? "text-indigo-400"
                                  : "text-slate-600 group-hover:text-slate-500"
                              }
                            />
                            {channel.name}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-bold text-slate-300 mb-1">RunTable 广场</p>
            <p>这里是所有调查员的聚集地。</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-slate-900/30 relative">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-slate-400 hover:text-white mr-1"
              onClick={() => setShowMobileSidebar(true)}
            >
              <Menu size={24} />
            </button>
            <Hash className="text-slate-500 hidden md:block" size={24} />
            <div>
              <h3 className="font-bold text-white text-lg">
                {activeChannel?.name || "加载中..."}
              </h3>
              <p className="text-xs text-slate-500">
                {activeChannel?.description || "暂无描述"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64 hidden md:block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={16}
              />
              <input
                type="text"
                placeholder="搜索话题..."
                className="w-full bg-slate-800 border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="static md:relative">
              <Button
                variant="ghost"
                size="icon"
                icon={Bell}
                className={unreadCount > 0 ? "text-indigo-400" : ""}
                onClick={() => setShowNotifications(!showNotifications)}
              />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
              )}

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  ></div>
                  <div className="absolute left-4 right-4 top-16 mt-2 md:left-auto md:right-0 md:top-full md:mt-2 w-auto md:w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-96 origin-top md:origin-top-right animate-scale-in">
                    <div className="p-3 border-b border-slate-700 font-bold text-sm text-slate-300 flex justify-between items-center">
                      <span>通知中心</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() =>
                            notifications.forEach((n) => markAsRead(n.id))
                          }
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          全部已读
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs">
                          暂无通知
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              "p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer group",
                              !n.is_read && "bg-slate-700/20"
                            )}
                            onClick={() => {
                              markAsRead(n.id);
                            }}
                          >
                            <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-600 shrink-0 overflow-hidden">
                                {n.actor?.avatar_url ? (
                                  <img
                                    src={n.actor.avatar_url}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="flex items-center justify-center h-full text-xs font-bold text-slate-400">
                                    {n.actor?.nickname?.[0]}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-300">
                                  <span className="font-bold text-white">
                                    {n.actor?.nickname}
                                  </span>
                                  {n.type === "like"
                                    ? " 赞了你的帖子"
                                    : " 评论了你的帖子"}
                                </p>
                                {n.post?.content && (
                                  <p className="text-xs text-slate-500 truncate mt-1">
                                    "{n.post.content}"
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-600 mt-1">
                                  {new Date(n.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                {!n.is_read && (
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></div>
                                )}
                                <button
                                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  onClick={(e) => deleteNotification(e, n.id)}
                                  title="删除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" icon={Users} />
          </div>
        </header>

        {/* Post List */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar overscroll-y-none"
          ref={scrollContainerRef}
        >
          <div
            ref={contentRef}
            className="max-w-4xl mx-auto space-y-6 min-h-full"
          >
            {/* Input Area */}
            <div
              className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 md:p-4 mb-8 focus-within:border-indigo-500 focus-within:bg-slate-800/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="flex gap-3 md:gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {currentUser?.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-indigo-400 font-bold">
                      {currentUser?.nickname?.[0] || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {pendingImage && (
                    <div className="mb-2 relative inline-block group">
                      <img
                        src={pendingImage.dataUrl}
                        alt="Preview"
                        className="max-h-48 rounded-lg border border-white/10"
                      />
                      <button
                        onClick={() => setPendingImage(null)}
                        className="absolute -top-2 -right-2 bg-slate-900 rounded-full p-1 text-slate-400 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <textarea
                    className="w-full bg-transparent border-none focus:ring-0 outline-none text-slate-200 placeholder:text-slate-500 resize-none min-h-[80px] custom-scrollbar"
                    placeholder={`在 #${
                      activeChannel?.name || "..."
                    } 发起讨论...`}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    onPaste={handlePaste}
                  />
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 relative z-20">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            processFile(e.target.files[0]);
                        }}
                      />
                      {/* Image Button Removed as requested, paste/drag only */}
                    </div>
                    <Button
                      size="sm"
                      onClick={handlePost}
                      disabled={
                        posting || (!newPostContent.trim() && !pendingImage)
                      }
                      icon={posting ? Loader2 : Send}
                    >
                      {posting ? "发布中..." : "发布"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts */}
            {loadingPosts ? (
              <div className="text-center py-10 text-slate-500">
                <Loader2 className="animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                暂无帖子，来抢沙发吧！
              </div>
            ) : (
              posts
                .filter(
                  (post) =>
                    !searchQuery ||
                    post.content
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    post.tags?.some((t) =>
                      t.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                )
                .map((post) => (
                  <div
                    key={post.id}
                    className="group flex gap-4 animate-fade-in"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0 overflow-hidden">
                      <button
                        className="w-full h-full"
                        title="查看资料"
                        onClick={() => openProfile(post.user_id)}
                      >
                        {post.profiles?.avatar_url ? (
                          <img
                            src={post.profiles.avatar_url}
                            alt={post.profiles.nickname}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          post.profiles?.nickname?.[0] || "?"
                        )}
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          className={cn(
                            "font-bold text-sm",
                            post.profiles?.is_vip
                              ? "text-purple-400"
                              : "text-white"
                          )}
                          onClick={() => openProfile(post.user_id)}
                        >
                          {post.profiles?.nickname || "未知用户"}
                        </button>
                      </div>

                      {/* Clickable Content Area */}
                      <div
                        className="cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors mb-1"
                        onClick={() => {
                          setSelectedPostId(post.id);
                          fetchComments(post.id);
                        }}
                      >
                        <PostContent content={post.content} />

                        {post.image_url && (
                          <div className="mb-2">
                            <img
                              src={post.image_url}
                              alt="Post Image"
                              className="max-h-64 rounded-lg border border-white/10"
                            />
                          </div>
                        )}
                      </div>

                      {post.tags && post.tags.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-slate-500">
                          {formatTime(post.created_at)}
                        </div>
                        <div className="flex items-center gap-6 text-slate-500 text-xs">
                          <button
                            className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                            onClick={() => {
                              setSelectedPostId(post.id);
                              fetchComments(post.id);
                            }}
                          >
                            <MessageSquare size={14} />
                            {post.comment_count} 评论
                          </button>
                          <button
                            className={cn(
                              "flex items-center gap-1 hover:text-pink-400 transition-colors group/like relative",
                              post.is_liked && "text-pink-400"
                            )}
                            onClick={() => handleLike(post.id)}
                          >
                            <Heart
                              size={14}
                              className={cn(post.is_liked && "fill-current")}
                            />
                            {post.like_count} 赞
                            {post.liked_by && post.liked_by.length > 0 && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/like:block z-50">
                                <div className="bg-slate-900 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700 whitespace-nowrap shadow-xl">
                                  {post.liked_by
                                    .slice(0, 5)
                                    .map((u) => u.nickname)
                                    .join(", ")}
                                  {post.liked_by.length > 5 &&
                                    ` 等 ${post.liked_by.length} 人`}
                                </div>
                              </div>
                            )}
                          </button>
                          {currentUser?.id === post.user_id && (
                            <button
                              className="flex items-center gap-1 hover:text-red-400 transition-colors"
                              onClick={() => requestDeletePost(post.id)}
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comment Preview (One comment + view more) */}
                      {(post.comment_count || 0) > 0 && (
                        <>
                          {post.latest_comments === undefined ? (
                            <div className="mt-3 bg-slate-900/20 rounded-lg p-3 border border-white/5 flex flex-col gap-2 animate-pulse">
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-3 bg-slate-700/50 rounded"></div>
                                <div className="flex-1 h-3 bg-slate-700/30 rounded"></div>
                              </div>
                            </div>
                          ) : (
                            post.latest_comments.length > 0 && (
                              <div className="mt-3 bg-slate-900/40 rounded-lg p-3 text-xs border border-white/5 animate-fade-in">
                                {post.latest_comments.map((c) => (
                                  <div
                                    key={c.id}
                                    className="mb-1 last:mb-0 text-slate-300 flex items-start"
                                  >
                                    <span className="font-bold text-slate-200 mr-2 shrink-0">
                                      {c.profiles?.nickname || "未知"}:
                                    </span>
                                    <span className="line-clamp-2 break-all whitespace-pre-wrap">
                                      {c.content}
                                    </span>
                                  </div>
                                ))}
                                {(post.comment_count || 0) > 1 && (
                                  <button
                                    className="text-indigo-400 mt-2 hover:text-indigo-300 font-medium flex items-center gap-1"
                                    onClick={() => {
                                      setSelectedPostId(post.id);
                                      fetchComments(post.id);
                                    }}
                                  >
                                    查看全部 {post.comment_count} 条评论
                                    <CornerDownRight size={12} />
                                  </button>
                                )}
                              </div>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 right-8 z-50 p-3 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 transition-all duration-300 hover:bg-indigo-500 hover:scale-110",
          showBackToTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-10 pointer-events-none"
        )}
      >
        <ArrowUp size={24} />
      </button>

      {/* Profile Modal (Friends Resume Card) */}
      {showProfile && selectedProfile && (
        <Modal
          onClose={() => setShowProfile(false)}
          title={null}
          headerClassName="hidden"
          className="max-w-md overflow-visible !bg-transparent !border-none !shadow-none !p-0"
        >
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-3xl relative overflow-hidden shadow-2xl backdrop-blur-xl">
            {selectedProfile.is_vip && (
              <div className="absolute top-4 left-4 z-10">
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-purple-400/30">
                  VIP
                </span>
              </div>
            )}
            <div className="p-8 pb-0 text-center relative">
              <div className="mx-auto mb-4 flex justify-center relative">
                <div className="relative">
                  <svg
                    className="absolute -top-1 -left-1 w-[104px] h-[104px] rotate-[-90deg]"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="3"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="3"
                      strokeDasharray="301.59"
                      strokeDashoffset="52.77825"
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    ></circle>
                  </svg>
                  <div
                    className="relative group block"
                    style={{ width: "96px", height: "96px" }}
                  >
                    <div className="rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative w-full h-full">
                      <AvatarUpload
                        url={selectedProfile.avatar_url}
                        onUpload={() => {}}
                        editable={false}
                        size={96}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative inline-flex items-center gap-2">
                <h2 className="text-2xl font-bold mb-1 transition-colors text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                  {selectedProfile.nickname}
                </h2>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
                  LV.{selectedProfile.level || 1}
                </span>
              </div>
              <div className="flex justify-center items-center gap-2 mb-4 mt-2">
                <span className="text-sm text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                  UID: {selectedProfile.user_code}
                </span>
              </div>
              <p className="text-slate-300 mb-6 max-w-md mx-auto italic">
                {selectedProfile.bio || "这个人很神秘，什么都没有写..."}
              </p>
              <div className="grid grid-cols-2 gap-4 text-left mt-6 mb-6">
                <div
                  onClick={() => setHistoryTab("player")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all group ${
                    historyTab === "player"
                      ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900/50 border-slate-700/30 hover:bg-slate-800"
                  }`}
                >
                  <div
                    className={`text-xs uppercase font-bold mb-1 transition-colors ${
                      historyTab === "player"
                        ? "text-indigo-400"
                        : "text-slate-500 group-hover:text-indigo-400"
                    }`}
                  >
                    参与的团
                  </div>
                  <div className="text-2xl font-mono font-bold text-indigo-400">
                    {playerHistory.length}
                  </div>
                </div>
                <div
                  onClick={() => setHistoryTab("kp")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all group ${
                    historyTab === "kp"
                      ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900/50 border-slate-700/30 hover:bg-slate-800"
                  }`}
                >
                  <div
                    className={`text-xs uppercase font-bold mb-1 transition-colors ${
                      historyTab === "kp"
                        ? "text-indigo-400"
                        : "text-slate-500 group-hover:text-indigo-400"
                    }`}
                  >
                    主持的团
                  </div>
                  <div className="text-2xl font-mono font-bold text-indigo-400">
                    {kpHistory.length}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-950/30 border-t border-white/5 p-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-indigo-500" />
                </div>
              ) : historyTab === "player" ? (
                <div className="space-y-3">
                  {playerHistory.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      暂无记录
                    </div>
                  )}
                  {playerHistory.map((item) => {
                    const snapshot = item.character_snapshot;
                    const latest: any = (item as any).latest_character;
                    const char = latest || snapshot;
                    const name = char.name;
                    const avatarUrl =
                      char.info?.avatar_url ||
                      char.avatar_url ||
                      snapshot.info?.avatar_url ||
                      snapshot.avatar_url;
                    const job =
                      char.info?.job ||
                      char.job ||
                      snapshot.info?.job ||
                      snapshot.job ||
                      "无职业";
                    const sex =
                      char.info?.sex ||
                      char.sex ||
                      snapshot.info?.sex ||
                      snapshot.sex ||
                      "未知";
                    const isDead = item.outcome === "死亡";
                    const isLost = item.outcome === "失踪";
                    const isCrazy = item.outcome === "疯狂";
                    return (
                      <div
                        key={item.id}
                        className={`relative p-3 rounded-xl border transition-all ${
                          isDead
                            ? "bg-slate-950 border-slate-800 grayscale"
                            : "bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/30"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-white text-sm line-clamp-1">
                              {item.game_history.room_title}
                            </h4>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-yellow-500"
                              >
                                <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>
                              </svg>
                              {new Date(
                                item.game_history.created_at
                              ).toLocaleDateString()}
                              <span className="w-0.5 h-0.5 rounded-full bg-slate-600"></span>
                              KP: {item.game_history.kp_nickname}
                            </div>
                          </div>
                          <div
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isDead
                                ? "bg-red-950 text-red-500 border border-red-900"
                                : isLost
                                ? "bg-yellow-950 text-yellow-500 border border-yellow-900"
                                : isCrazy
                                ? "bg-purple-950 text-purple-500 border border-purple-900"
                                : "bg-emerald-950 text-emerald-500 border border-emerald-900"
                            }`}
                          >
                            {item.outcome}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg">
                          <div className="w-6 h-6 flex items-center justify-center">
                            <AvatarUpload
                              url={avatarUrl}
                              onUpload={() => {}}
                              editable={false}
                              size={24}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-300 truncate">
                              {name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {job} · {sex}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {kpHistory.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      暂无记录
                    </div>
                  )}
                  {kpHistory.map((history) => (
                    <div
                      key={history.id}
                      className="bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl hover:border-indigo-500/30 transition-all"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-white text-sm">
                          {history.room_title}
                        </h4>
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                          {new Date(history.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-yellow-500"
                        >
                          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>
                        </svg>
                        <span>主持人 (KP)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {/* Post Detail Modal */}
      {selectedPostId && (
        <PostDetailModal
          post={posts.find((p) => p.id === selectedPostId)!}
          currentUser={currentUser}
          onClose={() => setSelectedPostId(null)}
          onLike={handleLike}
          onDeletePost={requestDeletePost}
          onDeleteComment={requestDeleteComment}
          comments={comments[selectedPostId] || []}
          loadingComments={!!loadingComments[selectedPostId]}
          openProfile={openProfile}
          onSendComment={handleSendComment}
          onLikeComment={handleLikeComment}
        />
      )}
      {/* Confirm Delete */}
      <ConfirmDialog
        open={confirmDelete.open}
        title={confirmDelete.type === "post" ? "删除发言确认" : "删除评论确认"}
        content={
          confirmDelete.type === "post"
            ? "确定要删除这条发言吗？删除后不可恢复。"
            : "确定要删除这条评论吗？删除后不可恢复。"
        }
        onCancel={() => setConfirmDelete({ open: false, type: null })}
        onConfirm={performDelete}
      />
    </div>
  );
};

// Confirm Delete Modal
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  content: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, title, content, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <div className="p-4 text-slate-300 text-sm">{content}</div>
        <div className="p-4 flex justify-end gap-2 border-t border-slate-800">
          <button
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border border-red-500/50 transition-colors"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

const PostDetailModal: React.FC<{
  post: Post;
  currentUser: any;
  onClose: () => void;
  onLike: (id: string) => void;
  onDeletePost: (id: string) => void;
  onDeleteComment: (cid: string, pid: string) => void;
  comments: PostComment[];
  loadingComments: boolean;
  openProfile: (uid: string) => void;
  onSendComment: (
    pid: string,
    content?: string,
    quoteId?: string
  ) => Promise<boolean>;
  onLikeComment: (commentId: string) => void;
}> = ({
  post,
  currentUser,
  onClose,
  onLike: _onLike,
  onDeletePost: _onDeletePost,
  onDeleteComment,
  comments,
  loadingComments,
  openProfile,
  onSendComment,
  onLikeComment,
}) => {
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);

  return (
    <Modal
      onClose={onClose}
      title={null}
      headerClassName="hidden"
      className="max-w-md h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-900"
    >
      {/* Custom Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2"
            onClick={() => openProfile(post.user_id)}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden cursor-pointer">
              {post.profiles?.avatar_url ? (
                <img
                  src={post.profiles.avatar_url}
                  alt={post.profiles.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                  {post.profiles?.nickname?.[0] || "?"}
                </div>
              )}
            </div>
            <span
              className={cn(
                "font-bold text-sm cursor-pointer",
                post.profiles?.is_vip ? "text-purple-400" : "text-slate-200"
              )}
            >
              {post.profiles?.nickname || "未知用户"}
            </span>
            {post.profiles?.is_vip && (
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1 rounded border border-purple-500/30">
                VIP
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4">
          {/* Content */}
          <div className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap mb-4">
            {post.content}
          </div>

          {post.image_url && (
            <div className="mb-4">
              <img
                src={post.image_url}
                alt="Post Image"
                className="w-full rounded-lg border border-white/10"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            {post.tags && post.tags.length > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <FileText size={12} />
                {post.tags[0]}
              </span>
            )}
            <span>{formatDetailTime(post.created_at)}</span>
          </div>

          {/* Likes List */}
          {post.liked_by && post.liked_by.length > 0 && (
            <div className="flex items-start gap-3 mt-2">
              <Heart
                size={16}
                className={cn(
                  "mt-0.5",
                  post.is_liked
                    ? "fill-pink-500 text-pink-500"
                    : "text-slate-400"
                )}
              />
              <div className="flex-1 text-xs text-slate-400 leading-5">
                <span className="text-slate-300 font-medium">
                  {post.liked_by.map((u) => u.nickname).join(", ")}
                </span>
                <span> 赞了</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-b border-white/5 mx-4"></div>

        {/* Comments Section */}
        <div className="p-4">
          <h4 className="font-bold text-slate-200 text-sm mb-4">
            评论 {post.comment_count}
          </h4>

          {loadingComments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-500" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0 cursor-pointer"
                    onClick={() => openProfile(comment.user_id)}
                  >
                    {comment.profiles?.avatar_url ? (
                      <img
                        src={comment.profiles.avatar_url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs font-bold">
                        {comment.profiles?.nickname?.[0] || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            "text-sm font-bold cursor-pointer",
                            comment.profiles?.is_vip
                              ? "text-purple-400"
                              : "text-slate-400"
                          )}
                          onClick={() => openProfile(comment.user_id)}
                        >
                          {comment.profiles?.nickname || "未知用户"}
                        </span>
                        {comment.quote && (
                          <div className="mb-1 pl-2 border-l-2 border-slate-700 text-xs text-slate-500">
                            <span className="font-bold text-slate-400">
                              @{comment.quote.profiles?.nickname || "未知用户"}:
                            </span>{" "}
                            {comment.quote.content}
                          </div>
                        )}
                        <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {comment.content}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>{formatTime(comment.created_at)}</span>
                          <button
                            className="text-slate-400 hover:text-slate-200"
                            onClick={() => setReplyTo(comment)}
                          >
                            回复
                          </button>
                          {currentUser?.id === comment.user_id && (
                            <button
                              className="text-red-400/50 hover:text-red-400"
                              onClick={() =>
                                onDeleteComment(comment.id, post.id)
                              }
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        className="flex flex-col items-center gap-0.5 pt-1 group/clike"
                        onClick={() => onLikeComment(comment.id)}
                      >
                        <Heart
                          size={14}
                          className={cn(
                            "transition-colors",
                            comment.is_liked
                              ? "fill-pink-500 text-pink-500"
                              : "text-slate-500 group-hover/clike:text-pink-400"
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px]",
                            comment.is_liked
                              ? "text-pink-500"
                              : "text-slate-500 group-hover/clike:text-pink-400"
                          )}
                        >
                          {comment.like_count || 0}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-600 py-12 text-sm">
              暂无评论，快来抢沙发~
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-3 px-4 bg-slate-900 border-t border-white/5 flex flex-col gap-2">
        {replyTo && (
          <div className="flex items-center justify-between bg-slate-800/50 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">
              回复{" "}
              <span className="text-indigo-400 font-bold">
                @{replyTo.profiles?.nickname || "未知用户"}
              </span>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-slate-500 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-800/50 rounded-full px-4 py-2 flex items-center gap-2 cursor-text border border-transparent hover:border-slate-700 transition-colors">
            <textarea
              className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 flex-1 resize-none leading-snug"
              placeholder={
                replyTo
                  ? `回复 @${replyTo.profiles?.nickname || "..."}...`
                  : "发言要友善，畅聊不引战"
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={1}
            />
          </div>
          <Button
            size="sm"
            disabled={!newComment.trim() || sending}
            onClick={async () => {
              setSending(true);
              const success = await onSendComment(
                post.id,
                newComment,
                replyTo?.id
              );
              if (success) {
                setNewComment("");
                setReplyTo(null);
              }
              setSending(false);
            }}
            className={cn(
              "rounded-full px-6 transition-all",
              !newComment.trim() && "opacity-50"
            )}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : "发送"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
