import { describe, expect, it } from "vitest";
import {
  getCurrentTrackId,
  getMusicOuterFallbackUrl,
  getNextTrackIdBatch,
  getNextTrackIndex,
  getPreviousTrackIndex,
  getNextPlayMode,
  getSyncedMusicInputState,
  getTrackEndedAction,
  isUnavailableTrackUrl,
  shouldAutoplayLoadedTrack,
  shouldLoadMoreTracks,
} from "./musicPlayback";

describe("music playback model", () => {
  it("resolves the current track id from single-song and playlist sources", () => {
    expect(
      getCurrentTrackId({
        parsedType: 2,
        parsedId: "song-1",
        playlistTracks: [],
        currentTrackIndex: 0,
      })
    ).toBe("song-1");

    expect(
      getCurrentTrackId({
        parsedType: 0,
        parsedId: "playlist-1",
        playlistTracks: [{ id: 1 }, { id: "2" }],
        currentTrackIndex: 1,
      })
    ).toBe("2");
  });

  it("moves next and previous in sequence mode with wraparound", () => {
    expect(
      getNextTrackIndex({
        currentTrackIndex: 2,
        trackCount: 3,
        playMode: "sequence",
      })
    ).toBe(0);

    expect(
      getPreviousTrackIndex({
        currentTrackIndex: 0,
        trackCount: 3,
        playMode: "sequence",
      })
    ).toBe(2);
  });

  it("keeps the same index for automatic single repeat", () => {
    expect(
      getNextTrackIndex({
        currentTrackIndex: 1,
        trackCount: 3,
        playMode: "single",
        isAuto: true,
      })
    ).toBe(1);
  });

  it("avoids selecting the current track in shuffle mode when possible", () => {
    expect(
      getNextTrackIndex({
        currentTrackIndex: 1,
        trackCount: 3,
        playMode: "shuffle",
        random: () => 0.4,
      })
    ).toBe(2);

    expect(
      getPreviousTrackIndex({
        currentTrackIndex: 1,
        trackCount: 3,
        playMode: "shuffle",
        random: () => 0.4,
      })
    ).toBe(0);
  });

  it("selects the next unloaded track id batch", () => {
    expect(
      getNextTrackIdBatch({
        allTrackIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
        loadedTrackCount: 1,
        batchSize: 2,
      })
    ).toEqual(["2", "3"]);
  });

  it("loads more only near the loaded queue tail", () => {
    expect(
      shouldLoadMoreTracks({
        isLoadingMore: false,
        loadedTrackCount: 20,
        totalTrackCount: 50,
        visualTrackIndex: 11,
      })
    ).toBe(true);

    expect(
      shouldLoadMoreTracks({
        isLoadingMore: false,
        loadedTrackCount: 20,
        totalTrackCount: 50,
        visualTrackIndex: 5,
      })
    ).toBe(false);

    expect(
      shouldLoadMoreTracks({
        isLoadingMore: true,
        loadedTrackCount: 20,
        totalTrackCount: 50,
        visualTrackIndex: 19,
      })
    ).toBe(false);
  });

  it("derives synced input state only while the input panel is closed", () => {
    expect(
      getSyncedMusicInputState({
        showInput: true,
        parsedId: "123",
        parsedType: 0,
      })
    ).toBeNull();

    expect(
      getSyncedMusicInputState({
        showInput: false,
        parsedId: "123",
        parsedType: 0,
      })
    ).toEqual({ inputUrl: "123", musicType: "playlist" });

    expect(
      getSyncedMusicInputState({
        showInput: false,
        parsedId: null,
        parsedType: 2,
      })
    ).toEqual({ inputUrl: "", musicType: "song" });
  });

  it("cycles play modes and resolves audio side-effect decisions", () => {
    expect(getNextPlayMode("sequence")).toBe("shuffle");
    expect(getNextPlayMode("shuffle")).toBe("single");
    expect(getNextPlayMode("single")).toBe("sequence");

    expect(
      shouldAutoplayLoadedTrack({
        isFirstMount: true,
        isKP: false,
        syncedIsPlaying: true,
      })
    ).toBe(true);
    expect(
      shouldAutoplayLoadedTrack({
        isFirstMount: true,
        isKP: true,
        syncedIsPlaying: true,
      })
    ).toBe(false);
    expect(
      shouldAutoplayLoadedTrack({
        isFirstMount: false,
        isKP: true,
      })
    ).toBe(true);

    expect(isUnavailableTrackUrl("")).toBe(true);
    expect(isUnavailableTrackUrl("https://example.test/404.mp3")).toBe(true);
    expect(isUnavailableTrackUrl("https://example.test/song.mp3")).toBe(false);
    expect(getMusicOuterFallbackUrl("123")).toBe(
      "https://music.163.com/song/media/outer/url?id=123.mp3"
    );
  });

  it("decides what to do when the current track ends", () => {
    expect(getTrackEndedAction({ parsedType: 0, playlistTrackCount: 2 })).toBe(
      "play-next"
    );
    expect(getTrackEndedAction({ parsedType: 2, playlistTrackCount: 0 })).toBe(
      "repeat-single"
    );
  });
});
