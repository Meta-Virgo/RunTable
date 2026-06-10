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
      className="w-[min(92vw,52rem)] h-[85vh] flex flex-col p-0 overflow-hidden bg-dicecho-panel border-dicecho-border/50"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-dicecho-border/40 bg-dicecho-panel/90 backdrop-blur-sm z-10 md:px-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2"
            onClick={() => openProfile(post.user_id)}
          >
            <div className="w-8 h-8 rounded-full bg-dicecho-card overflow-hidden cursor-pointer border border-dicecho-border/40">
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
                post.profiles?.is_vip ? "text-dicecho-primary" : "text-slate-200"
              )}
            >
              {post.profiles?.nickname || "未知用户"}
            </span>
            {post.profiles?.is_vip && (
              <span className="text-[10px] bg-dicecho-primary/20 text-dicecho-primary px-1 rounded border border-dicecho-primary/30">
                VIP
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 md:p-6">
          <div className="max-w-3xl text-slate-200 text-base leading-relaxed mb-4 md:text-[17px] md:leading-8">
            <SquareMarkdown source={post.content} variant="detail" />
          </div>

          {post.image_url && (
            <div className="mb-4">
              <img
                src={post.image_url}
                alt="Post Image"
                className="w-full rounded-lg border border-dicecho-border/40"
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-dicecho-muted mb-2">
            {post.tags && post.tags.length > 0 && (
              <span className="flex items-center gap-1 text-dicecho-muted">
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
                    : "text-dicecho-muted"
                )}
              />
              <div className="flex-1 text-xs text-dicecho-muted leading-5">
                <span className="text-slate-300 font-medium">
                  {post.liked_by.map((user) => user.nickname).join(", ")}
                </span>
                <span> 赞了</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-dicecho-border/30 mx-5 md:mx-6" />

        <div className="p-5 md:p-6">
          <h4 className="font-bold text-slate-200 text-sm mb-4">
            评论 {post.comment_count}
          </h4>

          {loadingComments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-dicecho-primary" />
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full bg-dicecho-card overflow-hidden shrink-0 cursor-pointer border border-dicecho-border/40"
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
                              ? "text-dicecho-primary"
                              : "text-dicecho-muted"
                          )}
                          onClick={() => openProfile(comment.user_id)}
                        >
                          {comment.profiles?.nickname || "未知用户"}
                        </span>
                        {comment.quote && (
                          <div className="mb-1 pl-2 border-l-2 border-dicecho-border/60 text-xs text-dicecho-muted">
                            <span className="font-bold text-slate-300">
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
                        <div className="flex items-center gap-3 text-xs text-dicecho-muted mt-1">
                          <span>{formatSquareTime(comment.created_at)}</span>
                          <button
                            className="text-dicecho-muted hover:text-slate-200"
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
                              : "text-dicecho-muted group-hover/clike:text-pink-400"
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px]",
                            comment.is_liked
                              ? "text-pink-500"
                              : "text-dicecho-muted group-hover/clike:text-pink-400"
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
            <div className="text-center text-dicecho-muted py-12 text-sm">
              暂无评论，快来抢沙发~
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-dicecho-panel border-t border-dicecho-border/40 flex flex-col gap-2 md:px-6">
        {replyTo && (
          <div className="flex items-center justify-between bg-dicecho-card/70 px-3 py-1.5 rounded-lg text-xs border border-dicecho-border/30">
            <span className="text-dicecho-muted">
              回复{" "}
              <span className="text-dicecho-primary font-bold">
                @{replyTo.profiles?.nickname || "未知用户"}
              </span>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-dicecho-muted hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-dicecho-card/70 rounded-lg px-3 py-2 cursor-text border border-dicecho-border/30 hover:border-dicecho-primary/50 transition-colors">
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
              "rounded-lg px-6 transition-colors",
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
