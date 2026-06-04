import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Character, GameHistory, GameHistoryParticipant } from "../types";
import { getCurrentUser, updatePassword } from "../services/auth";
import {
  createProfileForUser,
  fetchProfileDetails,
  updateProfile,
} from "../services/profiles";

interface ActionResult {
  ok: boolean;
  message?: string;
}

const applyLatestCharacterSnapshots = async (
  participants: any[]
): Promise<(GameHistoryParticipant & { game_history: GameHistory })[]> => {
  const characterIds = participants
    .map((participant) => participant.character_snapshot?.id)
    .filter(Boolean);
  let characterMap = new Map<string, Character>();

  if (characterIds.length > 0) {
    const { data: latestCharacters } = await supabase
      .from("characters")
      .select("*")
      .in("id", characterIds);

    if (latestCharacters) {
      characterMap = new Map(
        latestCharacters.map((character) => [character.id, character])
      );
    }
  }

  return participants
    .map((participant) => ({
      ...participant,
      latest_character: characterMap.get(participant.character_snapshot?.id),
    }))
    .sort(
      (a, b) =>
        new Date(b.game_history.created_at).getTime() -
        new Date(a.game_history.created_at).getTime()
    );
};

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
  const [playerHistory, setPlayerHistory] = useState<
    (GameHistoryParticipant & { game_history: GameHistory })[]
  >([]);
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
    const { count, error } = await supabase
      .from("friendships")
      .select("id", { count: "exact" })
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (!error && count !== null) {
      setFriendRequestCount(count);
    }
  }, []);

  const refreshGameHistory = useCallback(async (userId: string) => {
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
      setPlayerHistory(await applyLatestCharacterSnapshots(playerData as any[]));
    }
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
