import { useEffect, useRef, useState } from "react";
import {
  fetchPlayableSongUrl,
  fetchPlaylistDetails,
  fetchSongDetails,
  formatMusicSource,
  parseMusicInput,
  parseMusicSource,
} from "../services/musicCatalog";
import {
  getCurrentTrackId,
  getMusicOuterFallbackUrl,
  getNextPlayMode,
  getNextTrackIdBatch,
  getNextTrackIndex,
  getPreviousTrackIndex,
  getSyncedMusicInputState,
  getTrackEndedAction,
  isUnavailableTrackUrl,
  shouldAutoplayLoadedTrack,
  shouldLoadMoreTracks,
  type MusicPlayMode,
} from "../services/musicPlayback";
import { useDraggable } from "./useDraggable";
import { useElasticScroll } from "./useElasticScroll";

interface UseMusicPlaybackControllerOptions {
  url: string | null;
  isKP: boolean;
  onUpdateUrl: (url: string) => void;
  mode: "fixed" | "sidebar";
  isMobile: boolean;
  isHidden: boolean;
  globalMute: boolean;
  syncedIsPlaying?: boolean;
  syncedTrackIndex?: number;
  onUpdateSyncState?: (isPlaying: boolean, trackIndex: number) => void;
}

export function useMusicPlaybackController({
  url,
  isKP,
  onUpdateUrl,
  mode,
  isMobile,
  isHidden,
  globalMute,
  syncedIsPlaying,
  syncedTrackIndex,
  onUpdateSyncState,
}: UseMusicPlaybackControllerOptions) {
  const [showInput, setShowInput] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [musicType, setMusicType] = useState<"song" | "playlist">("song");
  const [playMode, setPlayMode] = useState<MusicPlayMode>("sequence");
  const [parsedId, setParsedId] = useState<string | null>(null);
  const [parsedType, setParsedType] = useState<number>(2);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastScrollRef = useRef(0);
  const isFirstMount = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoadingSong, setIsLoadingSong] = useState(false);

  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [allTrackIds, setAllTrackIds] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [visualTrackIndex, setVisualTrackIndex] = useState(0);
  const [showPlaylist] = useState(!isMobile || mode === "sidebar");
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const previousPlaylistIdRef = useRef<string | null>(null);
  const activeTrackRef = useRef<HTMLDivElement>(null);
  const playlistScrollRef = useRef<HTMLDivElement>(null);
  const playlistContentRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { position, handleMouseDown, hasMoved } = useDraggable(
    null,
    "music_player_pos"
  );

  useElasticScroll(playlistScrollRef, playlistContentRef, { enabled: false });

  useEffect(() => {
    if (!isKP) {
      if (syncedIsPlaying !== undefined && syncedIsPlaying !== isPlaying) {
        setIsPlaying(syncedIsPlaying);
        if (audioRef.current) {
          if (syncedIsPlaying) {
            audioRef.current.play().catch((error) => {
              if (error.name !== "AbortError") console.error(error);
            });
          } else {
            audioRef.current.pause();
          }
        }
      }

      if (
        syncedTrackIndex !== undefined &&
        syncedTrackIndex !== currentTrackIndex
      ) {
        setCurrentTrackIndex(syncedTrackIndex);
        setVisualTrackIndex(syncedTrackIndex);
      }
    }
  }, [syncedIsPlaying, syncedTrackIndex, isKP, isPlaying, currentTrackIndex]);

  useEffect(() => {
    if (isKP && onUpdateSyncState) {
      onUpdateSyncState(isPlaying, currentTrackIndex);
    }
  }, [isPlaying, currentTrackIndex, isKP, onUpdateSyncState]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = globalMute;
    }
  }, [globalMute]);

  useEffect(() => {
    setVisualTrackIndex(currentTrackIndex);
  }, [currentTrackIndex]);

  useEffect(() => {
    if (!isCollapsed) {
      setVisualTrackIndex(currentTrackIndex);
    }
  }, [isCollapsed, currentTrackIndex]);

  useEffect(() => {
    const nextInputState = getSyncedMusicInputState({
      showInput,
      parsedId,
      parsedType: parsedType as 0 | 2,
    });

    if (!nextInputState) return;

    setInputUrl(nextInputState.inputUrl);
    setMusicType(nextInputState.musicType);
  }, [parsedId, parsedType, showInput]);

  const fetchPlaylist = async (id: string) => {
    setIsLoadingPlaylist(true);
    setPlaylistTracks([]);
    setAllTrackIds([]);

    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      const { tracks, trackIds } = await fetchPlaylistDetails(id);
      setPlaylistTracks(tracks);
      setAllTrackIds(trackIds);
      setCurrentTrackIndex(0);
    } catch (error) {
      console.error("All playlist fetch strategies failed", error);
    }

    setIsLoadingPlaylist(false);
  };

  useEffect(() => {
    if (url) {
      const { id, type } = parseMusicSource(url);

      setParsedId(id);
      setParsedType(type);

      if (type === 0 && id) {
        if (previousPlaylistIdRef.current !== id) {
          previousPlaylistIdRef.current = id;
          void fetchPlaylist(id);
        }
      } else if (type === 2 && id) {
        const fetchSingleSong = async () => {
          setIsLoadingPlaylist(true);
          setPlaylistTracks([]);
          setAllTrackIds([{ id }]);
          setPlayMode("single");
          setCurrentTrackIndex(0);
          setVisualTrackIndex(0);

          try {
            const songs = await fetchSongDetails([id]);
            if (songs.length > 0) {
              setPlaylistTracks(songs);
            } else {
              console.warn("Failed to fetch song details for UI");
            }
          } catch {
            console.warn("Failed to fetch song details for UI");
          }
          setIsLoadingPlaylist(false);
        };

        void fetchSingleSong();
        previousPlaylistIdRef.current = null;
      } else {
        setPlaylistTracks([]);
        previousPlaylistIdRef.current = null;
      }
    } else {
      setParsedId(null);
      setPlaylistTracks([]);
      previousPlaylistIdRef.current = null;
    }
  }, [url]);

  const loadMoreTracks = async () => {
    if (isLoadingMore || playlistTracks.length >= allTrackIds.length) return;

    setIsLoadingMore(true);

    try {
      const nextIds = getNextTrackIdBatch({
        allTrackIds,
        loadedTrackCount: playlistTracks.length,
      });

      if (nextIds.length === 0) {
        setIsLoadingMore(false);
        return;
      }

      const newTracks = await fetchSongDetails(nextIds);
      if (newTracks.length > 0) {
        setPlaylistTracks((prev) => [...prev, ...newTracks]);
      }
    } catch (error) {
      console.error("Failed to load more tracks", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoadingMore &&
          playlistTracks.length < allTrackIds.length
        ) {
          void loadMoreTracks();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isLoadingMore, playlistTracks.length, allTrackIds.length]);

  useEffect(() => {
    if (
      mode === "fixed" &&
      !isHidden &&
      parsedType === 0 &&
      shouldLoadMoreTracks({
        isLoadingMore,
        loadedTrackCount: playlistTracks.length,
        totalTrackCount: allTrackIds.length,
        visualTrackIndex,
      })
    ) {
      void loadMoreTracks();
    }
  }, [
    visualTrackIndex,
    playlistTracks.length,
    allTrackIds.length,
    mode,
    isHidden,
    isLoadingMore,
  ]);

  useEffect(() => {
    if (activeTrackRef.current && showPlaylist) {
      activeTrackRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTrackIndex, showPlaylist]);

  const playNext = (isAuto = false) => {
    if (isLoadingSong && !isAuto) return;
    if (parsedType === 0 && playlistTracks.length > 0) {
      if (isAuto && playMode === "single") {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((error) => {
            if (error.name !== "AbortError") console.error("Play error:", error);
          });
          setIsPlaying(true);
        }
        return;
      }

      setCurrentTrackIndex((prev) =>
        getNextTrackIndex({
          currentTrackIndex: prev,
          trackCount: playlistTracks.length,
          playMode,
          isAuto,
        })
      );
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      const trackId = getCurrentTrackId({
        parsedType: parsedType as 0 | 2,
        parsedId,
        playlistTracks,
        currentTrackIndex,
      });

      if (trackId && audioRef.current) {
        if (audioRef.current.dataset.currentId === String(trackId)) return;

        audioRef.current.pause();
        setIsPlaying(false);
        setRetryCount(0);
        setIsLoadingSong(true);

        try {
          const realUrl = await fetchPlayableSongUrl(trackId);
          if (!isMounted) return;

          if (isUnavailableTrackUrl(realUrl)) {
            console.warn("Song appears unavailable:", trackId);
            if (parsedType === 0) {
              window.setTimeout(() => playNext(true), 1500);
            }
            return;
          }

          audioRef.current.src = realUrl;
          audioRef.current.dataset.currentId = String(trackId);

          const shouldPlay = shouldAutoplayLoadedTrack({
            isFirstMount: isFirstMount.current,
            isKP,
            syncedIsPlaying,
          });

          if (shouldPlay) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                if (error.name !== "AbortError") {
                  console.warn("Auto-play blocked:", error);
                }
              });
            }
            setIsPlaying(true);
          }

          if (isFirstMount.current) {
            isFirstMount.current = false;
          }
        } catch (error) {
          console.error("Error loading audio:", error);
        } finally {
          if (isMounted) setIsLoadingSong(false);
        }
      }
    };

    void loadAudio();

    return () => {
      isMounted = false;
    };
  }, [
    parsedId,
    parsedType,
    playlistTracks,
    currentTrackIndex,
    syncedIsPlaying,
    isKP,
  ]);

  const togglePlay = () => {
    if (isLoadingSong) return;
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((error) => {
        if (error.name !== "AbortError") console.error("Play error:", error);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const playPrev = () => {
    if (isLoadingSong) return;
    if (parsedType === 0 && playlistTracks.length > 0) {
      setCurrentTrackIndex((prev) =>
        getPreviousTrackIndex({
          currentTrackIndex: prev,
          trackCount: playlistTracks.length,
          playMode,
        })
      );
    }
  };

  const togglePlayMode = () => {
    setPlayMode((prev) => getNextPlayMode(prev));
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    if (
      getTrackEndedAction({
        parsedType: parsedType as 0 | 2,
        playlistTrackCount: playlistTracks.length,
      }) === "play-next"
    ) {
      playNext(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        if (error.name !== "AbortError") console.error("Play error:", error);
      });
      setIsPlaying(true);
    }
  };

  const handleAudioError = (error: MediaError | null, event: unknown) => {
    if (error && error.code === 1) return;

    console.error("Audio Load Error", error || event);

    if (parsedType === 2 && parsedId && retryCount === 0) {
      setRetryCount(1);
      if (audioRef.current) {
        audioRef.current.src = getMusicOuterFallbackUrl(parsedId);
        audioRef.current
          .play()
          .catch((playError) => console.error("Fallback play error:", playError));
      }
      return;
    }

    if (parsedType === 0) {
      window.setTimeout(() => playNext(true), 1500);
    }
  };

  const handleInputChange = (value: string) => {
    const parsed = parseMusicInput(value);
    setInputUrl(parsed.inputUrl);
    if (parsed.musicType) setMusicType(parsed.musicType);
  };

  const handleSave = () => {
    const finalUrl = formatMusicSource(inputUrl, musicType);
    if (!finalUrl) {
      onUpdateUrl("");
      setShowInput(false);
      return;
    }

    onUpdateUrl(finalUrl);
    setShowInput(false);
  };

  const formatTime = (time: number) => {
    if (!time) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return {
    showInput,
    setShowInput,
    inputUrl,
    musicType,
    setMusicType,
    playMode,
    parsedId,
    parsedType,
    audioRef,
    lastScrollRef,
    isPlaying,
    currentTime,
    duration,
    isLoadingSong,
    playlistTracks,
    allTrackIds,
    currentTrackIndex,
    setCurrentTrackIndex,
    visualTrackIndex,
    setVisualTrackIndex,
    showPlaylist,
    isLoadingPlaylist,
    isLoadingMore,
    isCollapsed,
    setIsCollapsed,
    activeTrackRef,
    playlistScrollRef,
    playlistContentRef,
    loadMoreRef,
    position,
    handleMouseDown,
    hasMoved,
    fetchPlaylist,
    loadMoreTracks,
    togglePlay,
    playNext,
    playPrev,
    togglePlayMode,
    onTimeUpdate,
    onEnded,
    handleAudioError,
    handleInputChange,
    handleSave,
    formatTime,
    setDuration,
  };
}
