import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVoiceParticipantName,
  getVoiceTokenEndpoint,
  requestVoiceToken,
} from "./livekit";
import type { Character } from "../types";

const tokenRequest = {
  accessToken: "access-token",
  roomId: "room-1",
  activeCharId: "char-1",
  participantName: "调查员",
};

describe("livekit service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses keeper or character names for voice participants", () => {
    const characters = [
      { id: "char-1", name: "林见鹿" },
    ] as Character[];

    expect(getVoiceParticipantName("pc", "", characters)).toBe("守秘人");
    expect(getVoiceParticipantName("char-1", "", characters)).toBe("林见鹿");
    expect(getVoiceParticipantName("missing", "", characters)).toBe("未知用户");
  });

  it("resolves the Supabase Edge Function endpoint when VITE_SUPABASE_URL is set", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("VITE_VOICE_TOKEN_ENDPOINT", "");

    expect(getVoiceTokenEndpoint()).toBe(
      "https://example.supabase.co/functions/v1/livekit-token"
    );
  });

  it("returns a token from the voice token endpoint", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("VITE_VOICE_TOKEN_ENDPOINT", "");

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: "voice-token" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestVoiceToken(tokenRequest)).resolves.toBe("voice-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/livekit-token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          apikey: "anon-key",
        }),
      })
    );
  });

  it("translates coded token errors into user-facing Chinese", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "keeper_only" }), { status: 403 })
      )
    );

    await expect(requestVoiceToken(tokenRequest)).rejects.toThrow(
      "只有房主可以守秘人身份进入语音房。"
    );
  });

  it("keeps non-JSON server errors readable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("A server error has occurred", { status: 500 })
      )
    );

    await expect(requestVoiceToken(tokenRequest)).rejects.toThrow(
      "A server error has occurred"
    );
  });
});
