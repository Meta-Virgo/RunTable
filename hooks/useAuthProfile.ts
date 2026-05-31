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
    let mounted = true;
    const loadingFallback = window.setTimeout(() => {
      if (mounted) {
        console.warn("Auth session restore timed out; continuing startup.");
        setAuthLoading(false);
      }
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        window.clearTimeout(loadingFallback);
        setSession(data.session);
        setAuthLoading(false);
        syncProfile(data.session).catch((error) => {
          console.error("Failed to sync profile:", error);
        });
      })
      .catch((error) => {
        console.error("Failed to restore auth session:", error);
        window.clearTimeout(loadingFallback);
        if (mounted) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      syncProfile(nextSession).catch((error) => {
        console.error("Failed to sync profile:", error);
      });
    });

    return () => {
      mounted = false;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    authLoading,
    userNickname,
    isVip,
  };
}
