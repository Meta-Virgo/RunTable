import type { MusicSourceType } from "./musicCatalog";

export type MusicPlayMode = "sequence" | "single" | "shuffle";

export interface TrackLike {
  id?: string | number;
}

export function getCurrentTrackId(input: {
  parsedType: MusicSourceType;
  parsedId: string | null;
  playlistTracks: TrackLike[];
  currentTrackIndex: number;
}) {
  if (input.parsedType === 2) return input.parsedId || null;
  if (input.parsedType === 0 && input.playlistTracks.length > 0) {
    const track = input.playlistTracks[input.currentTrackIndex];
    return track?.id !== undefined ? String(track.id) : null;
  }
  return null;
}

export function getNextTrackIndex(input: {
  currentTrackIndex: number;
  trackCount: number;
  playMode: MusicPlayMode;
  isAuto?: boolean;
  random?: () => number;
}) {
  if (input.trackCount <= 0) return input.currentTrackIndex;
  if (input.isAuto && input.playMode === "single") {
    return input.currentTrackIndex;
  }

  if (input.playMode === "shuffle") {
    const random = input.random || Math.random;
    let nextIndex = Math.floor(random() * input.trackCount);
    if (input.trackCount > 1 && nextIndex === input.currentTrackIndex) {
      nextIndex = (nextIndex + 1) % input.trackCount;
    }
    return nextIndex;
  }

  return (input.currentTrackIndex + 1) % input.trackCount;
}

export function getPreviousTrackIndex(input: {
  currentTrackIndex: number;
  trackCount: number;
  playMode: MusicPlayMode;
  random?: () => number;
}) {
  if (input.trackCount <= 0) return input.currentTrackIndex;

  if (input.playMode === "shuffle") {
    const random = input.random || Math.random;
    let previousIndex = Math.floor(random() * input.trackCount);
    if (input.trackCount > 1 && previousIndex === input.currentTrackIndex) {
      previousIndex =
        (previousIndex - 1 + input.trackCount) % input.trackCount;
    }
    return previousIndex;
  }

  return (input.currentTrackIndex - 1 + input.trackCount) % input.trackCount;
}

export function getNextTrackIdBatch(input: {
  allTrackIds: TrackLike[];
  loadedTrackCount: number;
  batchSize?: number;
}) {
  const batchSize = input.batchSize || 50;
  return input.allTrackIds
    .slice(input.loadedTrackCount, input.loadedTrackCount + batchSize)
    .map((track) => track.id)
    .filter((id): id is string | number => id !== undefined)
    .map(String);
}

export function shouldLoadMoreTracks(input: {
  isLoadingMore: boolean;
  loadedTrackCount: number;
  totalTrackCount: number;
  visualTrackIndex: number;
  threshold?: number;
}) {
  if (input.isLoadingMore) return false;
  if (input.loadedTrackCount >= input.totalTrackCount) return false;
  return (
    input.visualTrackIndex >=
    input.loadedTrackCount - (input.threshold || 10)
  );
}

export function getSyncedMusicInputState(input: {
  showInput: boolean;
  parsedId: string | null;
  parsedType: MusicSourceType;
}) {
  if (input.showInput) return null;
  if (!input.parsedId) {
    return { inputUrl: "", musicType: "song" as const };
  }

  return {
    inputUrl: input.parsedId,
    musicType: input.parsedType === 0 ? ("playlist" as const) : ("song" as const),
  };
}

export function getNextPlayMode(playMode: MusicPlayMode): MusicPlayMode {
  if (playMode === "sequence") return "shuffle";
  if (playMode === "shuffle") return "single";
  return "sequence";
}

export function shouldAutoplayLoadedTrack(input: {
  isFirstMount: boolean;
  isKP: boolean;
  syncedIsPlaying?: boolean;
}) {
  return !input.isFirstMount || (!input.isKP && Boolean(input.syncedIsPlaying));
}

export function isUnavailableTrackUrl(url: string | null | undefined) {
  return !url || url.includes("404");
}

export function getMusicOuterFallbackUrl(songId: string) {
  return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
}

export type TrackEndedAction = "repeat-single" | "play-next";

export function getTrackEndedAction(input: {
  parsedType: MusicSourceType;
  playlistTrackCount: number;
}): TrackEndedAction {
  return input.parsedType === 0 && input.playlistTrackCount > 0
    ? "play-next"
    : "repeat-single";
}
