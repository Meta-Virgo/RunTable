import React, { useState } from "react";
import { CornerDownRight, Heart, Loader2, MessageSquare, Trash2 } from "lucide-react";
import type { Post } from "../../types";
import { summarizeMarkdown } from "../../services/squareMarkdown";
import { cn } from "../UI";
import { SquareMarkdown } from "../SquareMarkdown";
import { formatSquareTime } from "./squareTime";

const MAX_POST_LENGTH = 140;

const SquarePostContent: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate =
    summarizeMarkdown(content, MAX_POST_LENGTH + 1).length > MAX_POST_LENGTH;

  return (
    <div className="mb-2">
      <div
        className={cn(
          "text-slate-300 text-sm leading-relaxed",
          shouldTruncate && !expanded && "max-h-36 overflow-hidden"
        )}
      >
        <SquareMarkdown source={content} variant="preview" />
      </div>
      {shouldTruncate && (
        <button
          className="mt-1 text-indigo-400 hover:text-indigo-300 text-xs font-bold hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
};

interface SquarePostListProps {
  posts: Post[];
  loadingPosts: boolean;
  searchQuery: string;
  currentUserId?: string;
  openProfile: (userId: string) => void;
  openPost: (postId: string) => void;
  onLikePost: (postId: string) => void;
  onRequestDeletePost: (postId: string) => void;
}

export const SquarePostList: React.FC<SquarePostListProps> = ({
  posts,
  loadingPosts,
  searchQuery,
  currentUserId,
  openProfile,
  openPost,
  onLikePost,
  onRequestDeletePost,
}) => {
  const visiblePosts = posts.filter(
    (post) =>
      !searchQuery ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  if (loadingPosts) {
    return (
      <div className="text-center py-10 text-slate-500">
        <Loader2 className="animate-spin mx-auto mb-2" />
        加载中...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500">
        暂无帖子，来抢沙发吧！
      </div>
    );
  }

  return (
    <>
      {visiblePosts.map((post) => (
        <div key={post.id} className="group flex gap-4 animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0 overflow-hidden">
            <button
              className="w-full h-full"
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
                  post.profiles?.is_vip ? "text-purple-400" : "text-white"
                )}
                onClick={() => openProfile(post.user_id)}
              >
                {post.profiles?.nickname || "未知用户"}
              </button>
            </div>

            <div
              className="cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors mb-1"
              onClick={() => {
                openPost(post.id);
              }}
            >
              <SquarePostContent content={post.content} />

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
                {formatSquareTime(post.created_at)}
              </div>
              <div className="flex items-center gap-6 text-slate-500 text-xs">
                <button
                  className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                  onClick={() => {
                    openPost(post.id);
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
                  onClick={() => onLikePost(post.id)}
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
                          .map((user) => user.nickname)
                          .join(", ")}
                        {post.liked_by.length > 5 &&
                          ` 等 ${post.liked_by.length} 人`}
                      </div>
                    </div>
                  )}
                </button>
                {currentUserId === post.user_id && (
                  <button
                    className="flex items-center gap-1 hover:text-red-400 transition-colors"
                    onClick={() => onRequestDeletePost(post.id)}
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                )}
              </div>
            </div>

            {(post.comment_count || 0) > 0 && (
              <>
                {post.latest_comments === undefined ? (
                  <div className="mt-3 bg-slate-900/20 rounded-lg p-3 border border-white/5 flex flex-col gap-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-3 bg-slate-700/50 rounded" />
                      <div className="flex-1 h-3 bg-slate-700/30 rounded" />
                    </div>
                  </div>
                ) : (
                  post.latest_comments.length > 0 && (
                    <div className="mt-3 bg-slate-900/40 rounded-lg p-3 text-xs border border-white/5 animate-fade-in">
                      {post.latest_comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="mb-1 last:mb-0 text-slate-300 flex items-start"
                        >
                          <span className="font-bold text-slate-200 mr-2 shrink-0">
                            {comment.profiles?.nickname || "未知"}:
                          </span>
                          <span className="line-clamp-2 break-all">
                            {summarizeMarkdown(comment.content)}
                          </span>
                        </div>
                      ))}
                      {(post.comment_count || 0) > 1 && (
                        <button
                          className="text-indigo-400 mt-2 hover:text-indigo-300 font-medium flex items-center gap-1"
                          onClick={() => {
                            openPost(post.id);
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
      ))}
    </>
  );
};

