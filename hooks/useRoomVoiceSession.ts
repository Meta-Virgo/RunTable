import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureMicrophonePermission,
  getVoiceParticipantName,
  requestVoiceToken,
} from "../services/livekit";
import type { Character } from "../types";
import {
  buildVoiceConnectedState,
  buildVoiceConnectingState,
  buildVoiceDisconnectedState,
  buildVoiceIdleState,
  buildVoiceReconnectingState,
  buildVoiceRequestingState,
  buildVoiceRuntimeErrorState,
  buildVoiceSetupErrorState,
  getVoiceSetupErrorMessage,
  type RoomVoiceState,
} from "./roomSessionModel";

interface UseRoomVoiceSessionOptions {
  roomType: "text" | "voice";
  currentRoomId: string | null;
  activeCharId: string;
  userNickname: string;
  characters: Character[];
  voiceAccessToken?: string;
}

export function useRoomVoiceSession({
  roomType,
  currentRoomId,
  activeCharId,
  userNickname,
  characters,
  voiceAccessToken,
}: UseRoomVoiceSessionOptions) {
  const [state, setState] = useState<RoomVoiceState>(buildVoiceIdleState);

  const participantName = useMemo(
    () => getVoiceParticipantName(activeCharId, userNickname, characters),
    [activeCharId, characters, userNickname]
  );

  useEffect(() => {
    if (roomType !== "voice" || !currentRoomId || !voiceAccessToken) {
      setState(buildVoiceIdleState());
      return;
    }

    let cancelled = false;

    const setupVoiceSession = async () => {
      setState(buildVoiceRequestingState());

      try {
        await ensureMicrophonePermission();
        if (cancelled) return;

        const token = await requestVoiceToken({
          accessToken: voiceAccessToken,
          roomId: currentRoomId,
          activeCharId,
          participantName,
        });
        if (cancelled) return;

        setState(buildVoiceConnectingState(token));
      } catch (error) {
        if (cancelled) return;

        const message = getVoiceSetupErrorMessage(error);
        console.error(error);
        console.warn("voice setup failed", {
          roomId: currentRoomId,
          activeCharId,
          message,
        });
        setState(buildVoiceSetupErrorState(message));
      }
    };

    void setupVoiceSession();

    return () => {
      cancelled = true;
    };
  }, [
    activeCharId,
    currentRoomId,
    participantName,
    roomType,
    voiceAccessToken,
  ]);

  const markConnected = useCallback(() => {
    setState((previous) => buildVoiceConnectedState(previous.token));
  }, []);

  const markReconnecting = useCallback(() => {
    setState((previous) => buildVoiceReconnectingState(previous.token));
  }, []);

  const markDisconnected = useCallback((message: string) => {
    setState((previous) => buildVoiceDisconnectedState(previous.token, message));
  }, []);

  const markError = useCallback((message: string) => {
    setState((previous) => buildVoiceRuntimeErrorState(previous.token, message));
  }, []);

  return {
    token: state.token,
    voiceConnectionStatus: state.voiceConnectionStatus,
    voiceError: state.voiceError,
    actions: {
      markConnected,
      markReconnecting,
      markDisconnected,
      markError,
    },
  };
}
