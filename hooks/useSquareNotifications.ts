import { useCallback, useEffect, useState } from "react";
import { Notification } from "../types";
import {
  deleteNotification as deleteSquareNotification,
  fetchNotifications,
  markNotificationRead,
} from "../services/squareNotificationsRepository";

export function useSquareNotifications(currentUser: any, shouldRefresh: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) return;

    const { data } = await fetchNotifications(currentUser.id);
    if (data) {
      setNotifications(data as any);
      setUnreadCount(data.filter((notification: any) => !notification.is_read).length);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications, shouldRefresh]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await deleteSquareNotification(notificationId);

      if (error) {
        console.error("Delete notification error:", error);
        return { ok: false, message: "删除失败: " + error.message };
      }

      setNotifications((prev) => {
        const target = prev.find((notification) => notification.id === notificationId);
        if (target && !target.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((notification) => notification.id !== notificationId);
      });

      return { ok: true };
    } catch (error) {
      console.error("Delete notification exception:", error);
      return { ok: false, message: "删除时发生错误" };
    }
  }, []);

  return {
    notifications,
    unreadCount,
    refreshNotifications,
    markAsRead,
    deleteNotification,
  };
}
