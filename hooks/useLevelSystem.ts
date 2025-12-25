import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { Session } from "@supabase/supabase-js";

export interface DailyActivity {
  online_seconds: number;
  login_claimed: boolean;
  online_30m_claimed: boolean;
  online_60m_claimed: boolean;
  online_120m_claimed: boolean;
}

export const useLevelSystem = (session: Session | null) => {
  const [level, setLevel] = useState<number>(1);
  const [experience, setExperience] = useState<number>(0);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity | null>(
    null
  );
  const [nextLevelExp, setNextLevelExp] = useState<number>(5);

  const getNextLevelExp = (lvl: number) => {
    // Keep consistent with SQL logic
    if (lvl === 1) return 5;
    if (lvl === 2) return 15;
    if (lvl === 3) return 30;
    if (lvl === 4) return 50;
    if (lvl === 5) return 100;
    if (lvl === 6) return 200;
    if (lvl === 7) return 500;
    if (lvl === 8) return 1000;
    if (lvl === 9) return 2000;
    if (lvl === 10) return 3000;
    if (lvl === 11) return 6000;
    if (lvl === 12) return 10000;
    if (lvl === 13) return 18000;
    if (lvl === 14) return 30000;
    if (lvl === 15) return 60000;
    if (lvl === 16) return 100000;
    if (lvl === 17) return 300000;
    if (lvl === 18) return 500000;
    if (lvl === 19) return 800000;
    return 999999999;
  };

  const fetchProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("level, experience")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setLevel(data.level || 1);
      setExperience(data.experience || 0);
      setNextLevelExp(getNextLevelExp(data.level || 1));
    }
  }, [session]);

  const heartbeat = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase.rpc("handle_heartbeat");
      if (data) {
        setDailyActivity(data as DailyActivity);
      }
    } catch (err) {
      console.error("Heartbeat failed", err);
    }
  }, [session]);

  const claimReward = async (type: "login" | "30m" | "60m" | "120m") => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase.rpc("claim_experience", {
        reward_type: type,
      });
      if (error) throw error;
      if (data) {
        setLevel(data.level);
        setExperience(data.experience);
        setNextLevelExp(getNextLevelExp(data.level));
        // Refresh daily activity status
        heartbeat();
        return data;
      }
    } catch (err) {
      console.error("Claim failed", err);
      throw err;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchProfile();
    heartbeat();
  }, [fetchProfile, heartbeat]);

  // Heartbeat loop (every 1 minute)
  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => {
      heartbeat();
    }, 60000);
    return () => clearInterval(interval);
  }, [session, heartbeat]);

  // Auto claim login and online rewards
  useEffect(() => {
    if (!dailyActivity) return;

    const claim = async () => {
      if (!dailyActivity.login_claimed) {
        await claimReward("login");
      }
      if (
        !dailyActivity.online_30m_claimed &&
        dailyActivity.online_seconds >= 1800
      ) {
        await claimReward("30m");
      }
      if (
        !dailyActivity.online_60m_claimed &&
        dailyActivity.online_seconds >= 3600
      ) {
        await claimReward("60m");
      }
      if (
        !dailyActivity.online_120m_claimed &&
        dailyActivity.online_seconds >= 7200
      ) {
        await claimReward("120m");
      }
    };

    claim();
  }, [dailyActivity]);

  return {
    level,
    experience,
    nextLevelExp,
    dailyActivity,
    claimReward,
  };
};
