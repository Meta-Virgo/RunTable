import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { GameHistory } from "../types";
import { getCurrentUser, updatePassword } from "../services/auth";
import {
  createProfileForUser,
  fetchProfileDetails,
  updateProfile,
} from "../services/profiles";
import {
  fetchCharactersByIds,
  fetchFriendRequestCount,
  fetchKpHistory,
  fetchPlayerHistory,
} from "../services/homeProfileRepository";
import {
  fetchHomeProfileHistory,
  type HomePlayerHistoryItem,
} from "../services/homeProfileModel";

interface ActionResult {
  ok: boolean;
  message?: string;
}

export function useHomeProfileData() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userNickname, setUserNickname] = useState<string | null>(null);
  const [userBio, setUserBio] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [kpHistory, setKpHistory] = useState<GameHistory[]>([]);
  const [playerHistory, setPlayerHistory] = useState<HomePlayerHistoryItem[]>([]);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  const applyProfile = useCallback((profile: any) => {
    setUserCode(profile.user_code);
    setUserNickname(profile.nickname);
    setUserBio(profile.bio || "");
    setUserAvatar(profile.avatar_url);
    setUserCreatedAt(profile.created_at);
    setIsVip(!!profile.is_vip);
  }, []);

  const refreshFriendRequestCount = useCallback(async (userId: string) => {
    const { count, error } = await fetchFriendRequestCount(userId);

    if (!error && count !== null) {
      setFriendRequestCount(count);
    }
  }, []);

  const refreshGameHistory = useCallback(async (userId: string) => {
    const result = await fetchHomeProfileHistory({
      userId,
      repository: {
        fetchKpHistory,
        fetchPlayerHistory,
        fetchCharactersByIds,
      },
    });

    setKpHistory(result.kpHistory);
    setPlayerHistory(result.playerHistory);
  }, []);

  useEffect(() => {
    getCurrentUser().then(async ({ data: { user } }) => {
      if (!user) return;

      setCurrentUserId(user.id);
      setUserEmail(user.email || "");

      const { data: profile } = await fetchProfileDetails(user.id);
      if (profile) {
        applyProfile(profile);
      } else {
        const { data: newProfile } = await createProfileForUser(
          user.id,
          user.email
        );
        if (newProfile) applyProfile(newProfile);
      }

      refreshGameHistory(user.id);
      refreshFriendRequestCount(user.id);
    });
  }, [applyProfile, refreshFriendRequestCount, refreshGameHistory]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("friendships_monitor")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `friend_id=eq.${currentUserId}`,
        },
        () => {
          refreshFriendRequestCount(currentUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshFriendRequestCount]);

  const saveProfile = useCallback(
    async (profile: {
      nickname: string;
      bio: string;
      avatar_url: string | null;
    }): Promise<ActionResult> => {
      if (!currentUserId) return { ok: false };

      const { error } = await updateProfile(currentUserId, profile);
      if (error) return { ok: false, message: "更新失败: " + error.message };

      setUserNickname(profile.nickname);
      setUserBio(profile.bio);
      setUserAvatar(profile.avatar_url);
      return { ok: true };
    },
    [currentUserId]
  );

  const changePassword = useCallback(
    async (password: string): Promise<ActionResult> => {
      const { error } = await updatePassword(password);
      if (error) return { ok: false, message: "修改失败: " + error.message };
      return { ok: true };
    },
    []
  );

  return {
    currentUserId,
    userCode,
    userEmail,
    userNickname,
    userBio,
    userAvatar,
    userCreatedAt,
    isVip,
    kpHistory,
    playerHistory,
    friendRequestCount,
    saveProfile,
    changePassword,
    refreshGameHistory,
    refreshFriendRequestCount,
  };
}
