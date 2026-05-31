import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { fetchProfileSummary } from "../services/profiles";

export function useAuthProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userNickname, setUserNickname] = useState("");
  const [isVip, setIsVip] = useState(false);

  const syncProfile = async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setUserNickname("");
      setIsVip(false);
      return;
    }

    const { data } = await fetchProfileSummary(nextSession.user.id);
    if (data) {
      if (data.nickname) setUserNickname(data.nickname);
      setIsVip(!!data.is_vip);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await syncProfile(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await syncProfile(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    authLoading,
    userNickname,
    isVip,
  };
}
