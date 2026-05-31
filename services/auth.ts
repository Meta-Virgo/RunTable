import { supabase } from "../supabase";

export async function getCurrentUser() {
  return supabase.auth.getUser();
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export function clearLocalSupabaseSession() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
      localStorage.removeItem(key);
    }
  });
}
