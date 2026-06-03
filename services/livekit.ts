import { Character } from "../types";

interface VoiceTokenRequest {
  accessToken: string;
  roomId: string;
  activeCharId: string;
  participantName: string;
}

interface VoiceTokenResponse {
  token?: string;
  error?: string;
}

export function getVoiceParticipantName(
  activeCharId: string,
  userNickname: string,
  characters: Character[]
) {
  if (activeCharId === "pc") {
    return userNickname || "守秘人";
  }

  return (
    characters.find((character) => character.id === activeCharId)?.name ||
    "未知用户"
  );
}

export async function requestVoiceToken({
  accessToken,
  roomId,
  activeCharId,
  participantName,
}: VoiceTokenRequest) {
  const response = await fetch("/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      roomName: roomId,
      participantName,
      characterId: activeCharId,
    }),
  });

  const data = (await response.json()) as VoiceTokenResponse;

  if (!response.ok || !data.token) {
    throw new Error(data.error || "Could not join voice room");
  }

  return data.token;
}
