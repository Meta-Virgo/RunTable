import React, { useState } from "react";
import { FileText, Heart, Loader2, X } from "lucide-react";
import type { Post, PostComment, Profile } from "../../types";
import { summarizeMarkdown } from "../../services/squareMarkdown";
import { Button, cn, Modal } from "../UI";
import { SquareMarkdown } from "../SquareMarkdown";
import { SquareMarkdownEditor } from "../SquareMarkdownEditor";
import { formatSquareDetailTime, formatSquareTime } from "./squareTime";

interface SquarePostDetailModalProps {
  post: Post;
  currentUser: Pick<Profile, "id"> | null | undefined;
  onClose: () => void;
  onDeleteComment: (commentId: string, postId: string) => void;
  comments: PostComment[];
  loadingComments: boolean;
  openProfile: (userId: string) => void;
  onSendComment: (
    postId: string,
    content?: string,
    quoteId?: string
  ) => Promise<boolean>;
  onLikeComment: (commentId: string) => void;
}

export const SquarePostDetailModal: React.FC<SquarePostDetailModalProps> = ({
  post,
  currentUser,
  onClose,
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
          <div className="text-slate-200 text-base leading-relaxed mb-4">
            <SquareMarkdown source={post.content} variant="detail" />
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

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            {post.tags && post.tags.length > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <FileText size={12} />
                {post.tags[0]}
              </span>
            )}
            <span>{formatSquareDetailTime(post.created_at)}</span>
          </div>

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
                  {post.liked_by.map((user) => user.nickname).join(", ")}
                </span>
                <span> 赞了</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-white/5 mx-4" />

        <div className="p-4">
          <h4 className="font-bold text-slate-200 text-sm mb-4">
            评论 {post.comment_count}
          </h4>

          {loadingComments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-500" />
            </div>
          ) : comments.length > 0 ? (
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
                            {summarizeMarkdown(comment.quote.content, 80)}
                          </div>
                        )}
                        <div className="text-sm text-slate-200 leading-relaxed">
                          <SquareMarkdown
                            source={comment.content}
                            variant="comment"
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>{formatSquareTime(comment.created_at)}</span>
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
          <div className="flex-1 bg-slate-800/50 rounded-xl px-3 py-2 cursor-text border border-transparent hover:border-slate-700 transition-colors">
            <SquareMarkdownEditor
              value={newComment}
              onChange={setNewComment}
              placeholder={
                replyTo
                  ? `回复 @${replyTo.profiles?.nickname || "..."}...`
                  : "发言要友善，畅聊不引战"
              }
              rows={1}
              showToolbar={false}
              showModeSwitch={false}
              previewVariant="comment"
              textareaClassName="text-sm leading-snug"
              maxHeight={120}
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

