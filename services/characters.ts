import { supabase } from "../supabase";
import { CharacterMutationPayload } from "../utils/characterPayload";

export async function createCharacter(characterData: CharacterMutationPayload) {
  return supabase.from("characters").insert(characterData).select().single();
}

export async function updateCharacter(
  characterId: string,
  characterData: CharacterMutationPayload
) {
  return supabase.from("characters").update(characterData).eq("id", characterId);
}

export async function fetchUserInvestigators(userId: string) {
  return supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "investigator");
}

export async function fetchCharacterById(characterId: string) {
  return supabase.from("characters").select("*").eq("id", characterId).single();
}

export async function deleteCharacter(characterId: string) {
  return supabase.from("characters").delete().eq("id", characterId);
}

export async function removeCharacterFromRoom(characterId: string) {
  return supabase
    .from("characters")
    .update({ room_id: null })
    .eq("id", characterId);
}

export async function updateCharacterStats(
  characterId: string,
  stats: Record<string, any>
) {
  return supabase.from("characters").update({ stats }).eq("id", characterId);
}
