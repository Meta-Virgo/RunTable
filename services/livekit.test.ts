import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVoiceParticipantName,
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
  });

  it("uses keeper or character names for voice participants", () => {
    const characters = [
      { id: "char-1", name: "林见鹿" },
    ] as Character[];

    expect(getVoiceParticipantName("pc", "", characters)).toBe("守秘人");
    expect(getVoiceParticipantName("char-1", "", characters)).toBe("林见鹿");
    expect(getVoiceParticipantName("missing", "", characters)).toBe("未知用户");
  });

  it("returns a token from the voice token endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: "voice-token" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestVoiceToken(tokenRequest)).resolves.toBe("voice-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
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
