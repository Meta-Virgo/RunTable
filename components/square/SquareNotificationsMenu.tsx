import React from "react";
import type { MouseEvent } from "react";
import { Trash2 } from "lucide-react";
import type { Notification } from "../../types";
import { summarizeMarkdown } from "../../services/squareMarkdown";
import { cn } from "../UI";
import { StaggeredItem } from "../Skeleton";

interface SquareNotificationsMenuProps {
  show: boolean;
  notifications: Notification[];
  unreadCount: number;
  onClose: () => void;
  onMarkAsRead: (notificationId: string) => void;
  onDeleteNotification: (
    event: MouseEvent,
    notificationId: string
  ) => void | Promise<void>;
}

export const SquareNotificationsMenu: React.FC<
  SquareNotificationsMenuProps
> = ({
  show,
  notifications,
  unreadCount,
  onClose,
  onMarkAsRead,
  onDeleteNotification,
}) => {
  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-4 right-4 top-16 mt-2 md:left-auto md:right-0 md:top-full md:mt-2 w-auto md:w-80 bg-dicecho-panel border border-dicecho-border/50 rounded-lg shadow-lg shadow-black/25 z-50 overflow-hidden flex flex-col max-h-96 origin-top md:origin-top-right">
        <div className="p-3 border-b border-dicecho-border/40 font-bold text-sm text-slate-200 flex justify-between items-center">
          <span>通知中心</span>
          {unreadCount > 0 && (
            <button
              onClick={() =>
                notifications.forEach((notification) =>
                  onMarkAsRead(notification.id)
                )
              }
              className="text-xs text-dicecho-primary hover:text-white"
            >
              全部已读
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-dicecho-muted text-xs">
              暂无通知
            </div>
          ) : (
            notifications.map((notification, index) => (
              <StaggeredItem
                key={notification.id}
                index={index}
                className={cn(
                  "p-3 border-b transition-colors cursor-pointer group",
                  "border-dicecho-border/30 hover:bg-white/10",
                  !notification.is_read && "bg-dicecho-primary/10"
                )}
                onClick={() => {
                  onMarkAsRead(notification.id);
                }}
              >
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-dicecho-card shrink-0 overflow-hidden border border-dicecho-border/40">
                    {notification.actor?.avatar_url ? (
                      <img
                        src={notification.actor.avatar_url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center justify-center h-full text-xs font-bold text-dicecho-muted">
                        {notification.actor?.nickname?.[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300">
                      <span className="font-bold text-white">
                        {notification.actor?.nickname}
                      </span>
                      {notification.type === "like"
                        ? " 赞了你的帖子"
                        : " 评论了你的帖子"}
                    </p>
                    {notification.post?.content && (
                      <p className="text-xs text-dicecho-muted truncate mt-1">
                        "{summarizeMarkdown(notification.post.content)}"
                      </p>
                    )}
                    <p className="text-[10px] text-dicecho-muted mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-dicecho-primary mt-1.5" />
                    )}
                    <button
                      className="text-dicecho-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      onClick={(event) =>
                        onDeleteNotification(event, notification.id)
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </StaggeredItem>
            ))
          )}
        </div>
      </div>
    </>
  );
};
