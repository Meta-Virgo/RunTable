import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export function useGlobalPresence(userId?: string) {
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (!userId) {
      setGlobalOnlineUsers(new Set());
      return;
    }

    const channel = supabase
      .channel("global_presence")
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const userIds = new Set<string>();
        for (const id in newState) {
          (newState[id] as any[]).forEach((presence) => {
            if (presence.user_id) userIds.add(presence.user_id);
          });
        }
        setGlobalOnlineUsers(userIds);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return globalOnlineUsers;
}
