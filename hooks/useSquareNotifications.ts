import { useCallback, useEffect, useMemo, useState } from "react";
import { Notification } from "../types";
import {
  deleteNotification as deleteSquareNotification,
  fetchNotifications,
  markNotificationRead,
} from "../services/squareNotificationsRepository";

export function useSquareNotifications(currentUser: any, shouldRefresh: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const currentUserId = currentUser?.id;
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const refreshNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      return;
    }

    const { data } = await fetchNotifications(currentUserId);
    if (data) {
      setNotifications(data as any);
    }
  }, [currentUserId]);

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
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await deleteSquareNotification(notificationId);

      if (error) {
        console.error("Delete notification error:", error);
        return { ok: false, message: "删除失败: " + error.message };
      }

      setNotifications((prev) => {
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
