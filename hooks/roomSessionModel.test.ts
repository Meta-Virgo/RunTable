import { describe, expect, it } from "vitest";
import {
  buildAppliedRoomSnapshotState,
  buildClearedRoomSessionState,
  applyRoomMemberRemovedLocally,
  buildRoomActionFailureMessage,
  buildRoomActionFailureResult,
  buildVoiceConnectedState,
  buildVoiceConnectingState,
  buildVoiceDisconnectedState,
  buildVoiceIdleState,
  buildVoiceReconnectingState,
  buildVoiceRequestingState,
  buildVoiceRuntimeErrorState,
  buildVoiceSetupErrorState,
  createRoomJoinSequence,
  buildRoomCharacterRemovedMessage,
  buildRoomChatClearedMessage,
  buildRoomEnterMessage,
  buildRoomLeaveMessage,
  buildRoomMemberKickedMessage,
  getOldestLog,
  getRoomLeaveCharacterId,
  getVoiceSetupErrorMessage,
  prependOlderRoomLogs,
  removeRoomLogById,
  shouldClearRestoredRoomUrl,
  shouldLoadMoreRoomLogs,
  shouldWarnMissingMusicSyncSchema,
} from "./roomSessionModel";

describe("room session model", () => {
  const character = (id: string, userId?: string) =>
    ({
      id,
      user_id: userId,
      name: id,
      role: "Investigator",
      type: "investigator",
      job: "",
      age: "",
      sex: "",
      str: 50,
      con: 50,
      siz: 50,
      dex: 50,
      app: 50,
      int: 50,
      pow: 50,
      edu: 50,
      luck: 50,
      hp: 10,
      san: 50,
      mp: 10,
      notes: "",
      backstory: "",
      skills: {},
    } as const);

  const membership = (userId: string, characterId: string | null) =>
    ({
      room_id: "room-1",
      user_id: userId,
      character_id: characterId,
      role: "player" as const,
      status: "active" as const,
    } as const);

  it("builds one applied snapshot for room identity, authority, music, and module info", () => {
    const state = buildAppliedRoomSnapshotState(
      {
        id: "room-1",
        kp_id: "keeper-1",
        title: "The Haunting",
        description: null,
        type: "voice",
        bg_music_url: "p:123",
        is_music_playing: true,
        music_track_index: 3,
      },
      "char-1",
      false,
      "player",
      "active"
    );

    expect(state).toEqual({
      currentRoomId: "room-1",
      characters: [],
      logs: [],
      hasMoreLogs: true,
      isLoadingMore: false,
      moduleInfo: {
        title: "The Haunting",
        description: "",
        notes: "",
      },
      roomType: "voice",
      roomPassword: "",
      activeCharId: "char-1",
      isKP: false,
      roomRole: "player",
      roomMembershipStatus: "active",
      roomMembers: [],
      kpId: "keeper-1",
      onlineUsers: new Set(),
      bgMusicUrl: "p:123",
      isMusicPlaying: true,
      musicTrackIndex: 3,
    });
  });

  it("defaults missing room type and music state while preserving keeper authority", () => {
    const state = buildAppliedRoomSnapshotState(
      {
        id: "room-2",
        kp_id: "keeper-2",
        title: "Text room",
        description: "brief",
        type: undefined as any,
        bg_music_url: null,
        is_music_playing: null,
        music_track_index: null,
      },
      "pc",
      true
    );

    expect(state).toMatchObject({
      currentRoomId: "room-2",
      roomType: "text",
      activeCharId: "pc",
      isKP: true,
      roomRole: "keeper",
      roomMembershipStatus: "unknown",
      bgMusicUrl: null,
      isMusicPlaying: false,
      musicTrackIndex: 0,
    });
  });

  it("builds a full local reset for leaving, deletion, kick, and logout cleanup", () => {
    const state = buildClearedRoomSessionState();

    expect(state).toMatchObject({
      currentRoomId: null,
      roomType: "text",
      characters: [],
      logs: [],
      hasMoreLogs: true,
      isLoadingMore: false,
      moduleInfo: {
        title: "",
        description: "",
        notes: "",
      },
      roomPassword: "",
      isKP: false,
      roomRole: "player",
      roomMembershipStatus: "unknown",
      roomMembers: [],
      activeCharId: "pc",
      kpId: null,
      bgMusicUrl: null,
      isMusicPlaying: false,
      musicTrackIndex: 0,
    });
    expect(state.onlineUsers).toEqual(new Set());
  });

  it("invalidates stale room join sequences when a newer join starts", () => {
    const sequence = createRoomJoinSequence();
    const firstJoin = sequence.begin();
    const secondJoin = sequence.begin();

    expect(sequence.isCurrent(firstJoin)).toBe(false);
    expect(sequence.isCurrent(secondJoin)).toBe(true);
  });

  it("explicitly invalidates a pending room join sequence during cleanup", () => {
    const sequence = createRoomJoinSequence();
    const pendingJoin = sequence.begin();

    expect(sequence.isCurrent(pendingJoin)).toBe(true);

    sequence.invalidate();

    expect(sequence.isCurrent(pendingJoin)).toBe(false);
    expect(sequence.isCurrent(sequence.begin())).toBe(true);
  });

  it("keeps a restored room URL when the restore join was cancelled by a newer session action", () => {
    expect(shouldClearRestoredRoomUrl({ ok: false })).toBe(true);
    expect(shouldClearRestoredRoomUrl({ ok: false, cancelled: true })).toBe(
      false
    );
    expect(shouldClearRestoredRoomUrl({ ok: true })).toBe(false);
  });

  it("builds voice connection states through the room session interface", () => {
    expect(buildVoiceIdleState()).toEqual({
      token: "",
      voiceConnectionStatus: "idle",
      voiceError: null,
    });
    expect(buildVoiceRequestingState()).toEqual({
      token: "",
      voiceConnectionStatus: "requesting-token",
      voiceError: null,
    });
    expect(buildVoiceConnectingState("voice-token")).toEqual({
      token: "voice-token",
      voiceConnectionStatus: "connecting",
      voiceError: null,
    });
    expect(buildVoiceConnectedState("voice-token")).toEqual({
      token: "voice-token",
      voiceConnectionStatus: "connected",
      voiceError: null,
    });
    expect(buildVoiceReconnectingState("voice-token")).toEqual({
      token: "voice-token",
      voiceConnectionStatus: "connecting",
      voiceError: null,
    });
    expect(buildVoiceDisconnectedState("voice-token", "lost")).toEqual({
      token: "voice-token",
      voiceConnectionStatus: "disconnected",
      voiceError: "lost",
    });
    expect(buildVoiceRuntimeErrorState("voice-token", "boom")).toEqual({
      token: "voice-token",
      voiceConnectionStatus: "error",
      voiceError: "boom",
    });
    expect(buildVoiceSetupErrorState("denied")).toEqual({
      token: "",
      voiceConnectionStatus: "error",
      voiceError: "denied",
    });
  });

  it("normalizes unknown voice setup failures", () => {
    expect(getVoiceSetupErrorMessage(new Error("microphone denied"))).toBe(
      "microphone denied"
    );
    expect(getVoiceSetupErrorMessage("bad")).toBe(
      "Unable to get voice room credentials"
    );
  });

  it("builds room session lifecycle messages", () => {
    expect(
      buildRoomEnterMessage({
        userName: "Yves",
        requestedCharacterId: "pc",
      })
    ).toBe("Yves (守秘人) 进入了房间");

    expect(
      buildRoomEnterMessage({
        userName: "Yves",
        requestedCharacterId: "char-1",
        characterName: "Lin",
      })
    ).toBe("Yves (Lin) 进入了房间");

    expect(
      buildRoomLeaveMessage({
        userNickname: "Yves",
        isKP: true,
        activeCharId: "pc",
      })
    ).toBe("Yves (守秘人) 离开了房间");

    expect(
      buildRoomLeaveMessage({
        userNickname: "Yves",
        isKP: false,
        activeCharId: "char-1",
        activeCharacterName: "Lin",
      })
    ).toBe("Yves (Lin) 离开了房间");

    expect(buildRoomCharacterRemovedMessage("Lin")).toBe(
      "守秘人将 [Lin] 移出了房间"
    );
    expect(buildRoomMemberKickedMessage("Lin")).toBe(
      "守秘人将 [Lin] 移出了房间"
    );
    expect(buildRoomMemberKickedMessage()).toBe("守秘人将 [玩家] 移出了房间");
    expect(buildRoomChatClearedMessage()).toBe("守秘人已清空聊天记录");
  });

  it("builds consistent room session action failures", () => {
    expect(
      buildRoomActionFailureMessage("删除房间失败", { message: "denied" })
    ).toBe("删除房间失败: denied");
    expect(buildRoomActionFailureResult("结团失败", undefined)).toEqual({
      ok: false,
      message: "结团失败: 未知错误",
    });
  });

  it("selects leave message character ids without leaking caller branches", () => {
    expect(getRoomLeaveCharacterId({ isKP: true, activeCharId: "char-1" })).toBe(
      null
    );
    expect(getRoomLeaveCharacterId({ isKP: false, activeCharId: "pc" })).toBe(
      null
    );
    expect(
      getRoomLeaveCharacterId({ isKP: false, activeCharId: "char-1" })
    ).toBe("char-1");
  });

  it("models paginated room log loading decisions", () => {
    const newest = {
      id: "new",
      timestamp: "10:05",
      createdAt: "2026-06-08T10:05:00.000Z",
      charId: "pc",
      charName: "Keeper",
      charRole: "Keeper",
      type: "normal" as const,
      content: "new",
    };
    const oldest = {
      ...newest,
      id: "old",
      timestamp: "10:00",
      createdAt: "2026-06-08T10:00:00.000Z",
      content: "old",
    };

    expect(getOldestLog([newest, oldest])).toBe(oldest);
    expect(
      shouldLoadMoreRoomLogs({
        isLoadingMore: false,
        hasMoreLogs: true,
        logCount: 2,
        currentRoomId: "room-1",
      })
    ).toBe(true);
    expect(
      shouldLoadMoreRoomLogs({
        isLoadingMore: true,
        hasMoreLogs: true,
        logCount: 2,
        currentRoomId: "room-1",
      })
    ).toBe(false);
    expect(prependOlderRoomLogs([newest], [oldest])).toEqual([oldest, newest]);
    expect(removeRoomLogById([oldest, newest], "old")).toEqual([newest]);
  });

  it("detects stale Supabase schema errors for music sync warnings", () => {
    expect(shouldWarnMissingMusicSyncSchema({ code: "PGRST204" })).toBe(true);
    expect(shouldWarnMissingMusicSyncSchema({ code: "42501" })).toBe(false);
    expect(shouldWarnMissingMusicSyncSchema(null)).toBe(false);
  });

  it("applies local room state after removing a member character", () => {
    const alice = character("char-1", "user-1");
    const bob = character("char-2", "user-2");

    expect(
      applyRoomMemberRemovedLocally({
        characters: [alice, bob],
        roomMembers: [membership("user-1", "char-1"), membership("user-2", "char-2")],
        activeCharId: "char-1",
        removedCharacterId: "char-1",
        removedUserId: "user-1",
      })
    ).toEqual({
      characters: [bob],
      roomMembers: [membership("user-2", "char-2")],
      activeCharId: "pc",
    });
  });

  it("keeps the selected character when removing a different room member", () => {
    const alice = character("char-1", "user-1");
    const bob = character("char-2", "user-2");

    expect(
      applyRoomMemberRemovedLocally({
        characters: [alice, bob],
        roomMembers: [membership("user-1", "char-1"), membership("user-2", "char-2")],
        activeCharId: "char-1",
        removedCharacterId: "char-2",
        removedUserId: "user-2",
      })
    ).toEqual({
      characters: [alice],
      roomMembers: [membership("user-1", "char-1")],
      activeCharId: "char-1",
    });
  });

  it("can remove only a room member when no character is attached", () => {
    const alice = character("char-1", "user-1");

    expect(
      applyRoomMemberRemovedLocally({
        characters: [alice],
        roomMembers: [membership("user-1", "char-1"), membership("user-3", null)],
        activeCharId: "char-1",
        removedUserId: "user-3",
      })
    ).toEqual({
      characters: [alice],
      roomMembers: [membership("user-1", "char-1")],
      activeCharId: "char-1",
    });
  });
});
