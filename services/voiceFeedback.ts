import type { RoomMemberRole, RoomMemberStatus } from "./roomAuthority";

export type VoiceConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export function getVoiceConnectionFeedback(
  state: VoiceConnectionState,
  error?: string | null
) {
  if (state === "reconnecting") {
    return {
      severity: "warning" as const,
      message: "Reconnecting to voice. Check your network if this continues.",
    };
  }

  if (state === "disconnected") {
    return {
      severity: "warning" as const,
      message: "Voice disconnected. Rejoin the room or refresh the page.",
    };
  }

  if (state === "error") {
    return {
      severity: "error" as const,
      message: `Voice error${error ? `: ${error}` : ". Try reconnecting."}`,
    };
  }

  return {
    severity: state === "connected" ? ("success" as const) : ("info" as const),
    message: state === "connected" ? "Voice connected." : "Voice is preparing.",
  };
}

export function buildVoiceParticipantFeedback(input: {
  members: Array<{
    userId: string;
    displayName: string;
    role: RoomMemberRole;
    status: RoomMemberStatus;
  }>;
  connectedUserIds: Set<string>;
}) {
  return input.members
    .filter((member) => member.status === "active")
    .map((member) => ({
      ...member,
      connectionState: input.connectedUserIds.has(member.userId)
        ? ("connected" as const)
        : ("disconnected" as const),
    }));
}
