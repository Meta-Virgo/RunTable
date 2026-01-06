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
  Image as ImageIcon,
  X,
  Trash2,
  CornerDownRight,
} from "lucide-react";
import { Button, cn, Modal } from "./UI";
import { AvatarUpload } from "./AvatarUpload";

export const Square: React.FC = () => {
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
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<
    Record<string, boolean>
  >({});
  const [newCommentContent, setNewCommentContent] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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
      const { data, error } = await supabase
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
      const { data: postsData, error } = await supabase
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

    // Realtime subscription for posts in this channel
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
  }, [activeChannelId, currentUser]);

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

  const fetchComments = async (postId: string) => {
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    const { data: rawComments } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (rawComments && rawComments.length > 0) {
      const commenterIds = Array.from(
        new Set(rawComments.map((c: any) => c.user_id))
      );
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url, is_vip")
        .in("id", commenterIds);
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      const merged = rawComments.map((c: any) => ({
        ...c,
        profiles: pmap.get(c.user_id) || {
          nickname: "未知用户",
          avatar_url: null,
          is_vip: false,
        },
      }));
      setComments((prev) => ({ ...prev, [postId]: merged }));
    } else {
      setComments((prev) => ({ ...prev, [postId]: [] }));
    }
    setLoadingComments((prev) => ({ ...prev, [postId]: false }));
  };

  const handleSendComment = async (postId: string) => {
    if (!newCommentContent.trim() || !currentUser) return;
    setCommenting(true);

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: currentUser.id,
        content: newCommentContent.trim(),
      })
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

      setNewCommentContent("");
      fetchComments(postId);
      // Update comment count locally
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comment_count: (p.comment_count || 0) + 1 }
            : p
        )
      );
    }
    setCommenting(false);
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

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post || post.user_id !== currentUser.id) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (expandedPostId === postId) setExpandedPostId(null);
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

  return (
    <div className="flex h-full bg-[#020617] text-slate-200 overflow-hidden">
      {/* Left Sidebar - Channels */}
      <div className="w-64 flex-shrink-0 border-r border-white/5 bg-slate-900/50 flex flex-col">
        <div className="h-16 flex items-center px-4 border-b border-white/5">
          <h2 className="font-bold text-white flex items-center gap-2">
            <MessageSquare className="text-indigo-500" size={20} />
            广场频道
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
          {loadingChannels ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-slate-500" />
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
                        onClick={() => setActiveChannelId(channel.id)}
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
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/30">
          <div className="flex items-center gap-3">
            <Hash className="text-slate-500" size={24} />
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
            <div className="relative">
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
                  <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-96">
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
                              "p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer",
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
                              {!n.is_read && (
                                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                              )}
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
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Input Area */}
            <div
              className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mb-8 focus-within:border-indigo-500 focus-within:bg-slate-800/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="flex gap-4">
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
                <div className="flex-1">
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
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
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
                        {post.profiles?.is_vip && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1 rounded border border-purple-500/30">
                            VIP
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {new Date(post.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-slate-300 text-sm leading-relaxed mb-2 whitespace-pre-wrap">
                        {post.content}
                      </div>

                      {post.image_url && (
                        <div className="mb-2">
                          <img
                            src={post.image_url}
                            alt="Post Image"
                            className="max-h-64 rounded-lg border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() =>
                              window.open(post.image_url!, "_blank")
                            }
                          />
                        </div>
                      )}

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

                      <div className="flex items-center gap-6 text-slate-500 text-xs">
                        <button
                          className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                          onClick={() => {
                            if (expandedPostId === post.id) {
                              setExpandedPostId(null);
                            } else {
                              setExpandedPostId(post.id);
                              fetchComments(post.id);
                            }
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

                      {/* Comments Section */}
                      {expandedPostId === post.id && (
                        <div className="mt-4 pt-4 border-t border-white/5 animate-fade-in">
                          <div className="space-y-4 mb-4">
                            {loadingComments[post.id] ? (
                              <div className="flex justify-center py-4">
                                <Loader2
                                  className="animate-spin text-slate-500"
                                  size={16}
                                />
                              </div>
                            ) : comments[post.id]?.length > 0 ? (
                              comments[post.id].map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0 overflow-hidden">
                                    {comment.profiles?.avatar_url ? (
                                      <img
                                        src={comment.profiles.avatar_url}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      comment.profiles?.nickname?.[0] || "?"
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <button
                                        className={cn(
                                          "text-xs font-bold",
                                          comment.profiles?.is_vip
                                            ? "text-purple-400"
                                            : "text-slate-300"
                                        )}
                                        onClick={() =>
                                          openProfile(comment.user_id)
                                        }
                                      >
                                        {comment.profiles?.nickname ||
                                          "未知用户"}
                                      </button>
                                      <span className="text-[10px] text-slate-600">
                                        {new Date(
                                          comment.created_at
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                      {comment.content}
                                    </p>
                                  </div>
                                  {currentUser?.id === comment.user_id && (
                                    <button
                                      className="text-slate-600 hover:text-red-400 transition-colors"
                                      onClick={() =>
                                        requestDeleteComment(
                                          comment.id,
                                          post.id
                                        )
                                      }
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-slate-600 text-xs py-2">
                                暂无评论，快来抢沙发~
                              </div>
                            )}
                          </div>

                          {/* Comment Input */}
                          <div className="flex gap-3 items-start">
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                                placeholder="写下你的评论..."
                                value={newCommentContent}
                                onChange={(e) =>
                                  setNewCommentContent(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendComment(post.id);
                                  }
                                }}
                              />
                              <CornerDownRight
                                className="absolute right-3 top-2.5 text-slate-600"
                                size={14}
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={!newCommentContent.trim() || commenting}
                              onClick={() => handleSendComment(post.id)}
                              icon={commenting ? Loader2 : Send}
                            >
                              发送
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
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
                    <div className="text-center text-slate-500 py-4 text-sm">
                      暂无主持记录
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
