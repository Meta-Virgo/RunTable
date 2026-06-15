import type { Character, RoomScene, RoomSceneMarker } from "../../types";

export const scenePatternLabels: Record<RoomScene["background_pattern"], string> =
  {
    plain: "纯色",
    grid: "细线",
    dots: "点阵",
    mist: "雾面",
  };

export function getCharacterRoleLabel(character?: Character) {
  if (!character) return "Token";
  if (character.type === "monster") return "怪物";
  if (character.type === "npc") return "NPC";
  return "调查员";
}

export function getMarkerAccent(
  character: Character | undefined,
  marker?: Pick<RoomSceneMarker, "is_hidden">
) {
  if (marker?.is_hidden) return "#f59e0b";
  if (character?.type === "monster") return "#fb7185";
  if (character?.type === "npc") return "#22d3ee";
  return character?.theme_color || "#9396f7";
}

export function getScenePatternClass(pattern: RoomScene["background_pattern"]) {
  if (pattern === "grid") {
    return "bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]";
  }

  if (pattern === "dots") {
    return "bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:28px_28px]";
  }

  if (pattern === "mist") {
    return "bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_78%_62%,rgba(255,255,255,0.10),transparent_30%)]";
  }

  return "";
}
