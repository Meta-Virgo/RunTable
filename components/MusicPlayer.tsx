import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Music,
  Disc,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  X,
  ListMusic,
} from "lucide-react";
import { Button } from "./UI";
import { useElasticScroll } from "../hooks/useElasticScroll";
import { useDraggable } from "../hooks/useDraggable";

interface MusicPlayerProps {
  url: string | null;
  isKP: boolean;
  onUpdateUrl: (url: string) => void;
  mode?: "fixed" | "sidebar";
  className?: string;
  isMobile?: boolean;
  isHidden?: boolean;
  globalMute?: boolean;
  syncedIsPlaying?: boolean;
  syncedTrackIndex?: number;
  onUpdateSyncState?: (isPlaying: boolean, trackIndex: number) => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  url,
  isKP,
  onUpdateUrl,
  mode = "fixed",
  className = "",
  isMobile = false,
  isHidden = false,
  globalMute = false,
  syncedIsPlaying,
  syncedTrackIndex,
  onUpdateSyncState,
}) => {
  // const [isMuted, setIsMuted] = useState(false); // Local mute (sets volume to 0 / pauses)
  const [showInput, setShowInput] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [musicType, setMusicType] = useState<"song" | "playlist">("song");
  const [playMode, setPlayMode] = useState<"sequence" | "single" | "shuffle">(
    "sequence"
  );

  // State for internal player logic
  const [parsedId, setParsedId] = useState<string | null>(null);
  const [parsedType, setParsedType] = useState<number>(2); // 2 for song, 0 for playlist

  // Custom Player State (Audio Element)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastScrollRef = useRef(0);
  const isFirstMount = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  // const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Playlist State
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [allTrackIds, setAllTrackIds] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [visualTrackIndex, setVisualTrackIndex] = useState(0);
  const [showPlaylist] = useState(!isMobile || mode === "sidebar");

  // --- Sync Effects ---

  // 1. Sync Props -> Internal State (PC Only)
  useEffect(() => {
    if (!isKP) {
      if (syncedIsPlaying !== undefined && syncedIsPlaying !== isPlaying) {
        setIsPlaying(syncedIsPlaying);
        if (audioRef.current) {
          if (syncedIsPlaying) audioRef.current.play().catch(console.error);
          else audioRef.current.pause();
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

  // 2. Sync Internal State -> DB (KP Only)
  useEffect(() => {
    if (isKP && onUpdateSyncState) {
      onUpdateSyncState(isPlaying, currentTrackIndex);
    }
  }, [isPlaying, currentTrackIndex, isKP]);

  // 3. Global Mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = globalMute;
    }
  }, [globalMute]);

  // Sync visual track index with current track index
  useEffect(() => {
    setVisualTrackIndex(currentTrackIndex);
  }, [currentTrackIndex]);

  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!isCollapsed) {
      setVisualTrackIndex(currentTrackIndex);
    }
  }, [isCollapsed, currentTrackIndex]);

  // Draggable logic
  const { position, handleMouseDown, hasMoved } = useDraggable(
    null,
    "music_player_pos"
  );

  useEffect(() => {
    // Restore volume from local storage
    // const savedVol = localStorage.getItem("runtable_bgm_volume");
    // if (savedVol) {
    //   // setVolume(parseFloat(savedVol));
    // }
  }, []);

  // Sync input state when not editing
  useEffect(() => {
    if (!showInput && parsedId) {
      setInputUrl(parsedId);
      setMusicType(parsedType === 0 ? "playlist" : "song");
    } else if (!showInput && !parsedId) {
      setInputUrl("");
      setMusicType("song");
    }
  }, [parsedId, parsedType, showInput]);

  // Fetch Playlist if needed
  const previousPlaylistIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (url) {
      let id = "";
      let type = 2; // Default to song

      // Handle custom prefix format "s:123" or "p:123"
      if (url.startsWith("s:")) {
        id = url.substring(2);
        type = 2;
      } else if (url.startsWith("p:")) {
        id = url.substring(2);
        type = 0;
      } else {
        // Fallback for raw ID or old format
        const match = url.match(/id=(\d+)/);
        if (match) {
          id = match[1];
          if (url.includes("playlist")) type = 0;
        } else if (/^\d+$/.test(url)) {
          id = url;
        }
      }

      setParsedId(id);
      setParsedType(type);

      // Fetch Playlist if needed
      if (type === 0 && id) {
        // Only fetch if ID changed
        if (previousPlaylistIdRef.current !== id) {
          previousPlaylistIdRef.current = id;
          fetchPlaylist(id);
        }
      } else if (type === 2 && id) {
        // Fetch single song detail
        const fetchSingleSong = async () => {
          setIsLoadingPlaylist(true);
          setPlaylistTracks([]);
          setAllTrackIds([{ id }]); // Pseudo track ID

          // Set single loop mode
          setPlayMode("single");
          setCurrentTrackIndex(0);
          setVisualTrackIndex(0);

          const endpoints = [
            {
              url: `https://corsproxy.io/?${encodeURIComponent(
                `https://music.163.com/api/song/detail?ids=[${id}]`
              )}`,
              name: "corsproxy-v6",
            },
            {
              url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(
                `https://music.163.com/api/song/detail?ids=[${id}]`
              )}`,
              name: "codetabs-v6",
            },
          ];

          let success = false;
          for (const endpoint of endpoints) {
            try {
              const res = await fetch(endpoint.url);
              if (!res.ok) continue;
              const data = await res.json();
              const songs = data.songs || [];
              if (songs.length > 0) {
                setPlaylistTracks(songs);
                success = true;
                break;
              }
            } catch (e) {
              console.warn(
                `Failed to fetch song detail via ${endpoint.name}`,
                e
              );
            }
          }

          if (!success) {
            // If fetch fails, we might still want to try playing it (metadata might load from audio)
            // But we won't have cover art.
            console.warn("Failed to fetch song details for UI");
          }
          setIsLoadingPlaylist(false);
        };

        fetchSingleSong();
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

  const fetchPlaylist = async (id: string) => {
    setIsLoadingPlaylist(true);
    setPlaylistTracks([]);
    setAllTrackIds([]);

    // Stop current audio immediately when starting to fetch new playlist
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // Strategy: Try multiple proxies/endpoints
    const endpoints = [
      // Strategy 1: V6 API via corsproxy.io (usually most robust)
      {
        url: `https://corsproxy.io/?${encodeURIComponent(
          `https://music.163.com/api/v6/playlist/detail?id=${id}&n=1000&s=8`
        )}`,
        parser: (data: any) => ({
          tracks: data.playlist?.tracks || [],
          trackIds: data.playlist?.trackIds || [],
        }),
        name: "corsproxy-v6",
      },
      // Strategy 2: CodeTabs Proxy (Backup)
      {
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(
          `https://music.163.com/api/v6/playlist/detail?id=${id}&n=1000`
        )}`,
        parser: (data: any) => ({
          tracks: data.playlist?.tracks || [],
          trackIds: data.playlist?.trackIds || [],
        }),
        name: "codetabs-v6",
      },
    ];

    let success = false;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying playlist fetch via ${endpoint.name}...`);
        const res = await fetch(endpoint.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const { tracks, trackIds } = endpoint.parser(data);

        if (
          (tracks && tracks.length > 0) ||
          (trackIds && trackIds.length > 0)
        ) {
          console.log(
            `Success via ${endpoint.name}, found ${tracks.length} tracks, ${trackIds.length} IDs`
          );
          setPlaylistTracks(tracks);
          setAllTrackIds(trackIds);
          setCurrentTrackIndex(0);
          success = true;
          break; // Stop if successful
        } else {
          console.warn(`No tracks found via ${endpoint.name}`, data);
        }
      } catch (error) {
        console.warn(`Failed via ${endpoint.name}:`, error);
        lastError = error;
      }
    }

    if (!success) {
      console.error("All playlist fetch strategies failed", lastError);
      // Keep empty tracks to show error state
    }

    setIsLoadingPlaylist(false);
  };

  const loadMoreTracks = async () => {
    if (isLoadingMore || playlistTracks.length >= allTrackIds.length) return;

    setIsLoadingMore(true);

    try {
      const startIndex = playlistTracks.length;
      const batchSize = 50;
      // Get next batch of IDs
      const nextIds = allTrackIds
        .slice(startIndex, startIndex + batchSize)
        .map((t: any) => t.id);

      if (nextIds.length === 0) {
        setIsLoadingMore(false);
        return;
      }

      console.log(`Loading more tracks: ${nextIds.length} items`);

      // Use song/detail API via corsproxy (with fallback)
      const endpoints = [
        // Strategy 1: V6 API via corsproxy.io (usually most robust)
        {
          url: `https://corsproxy.io/?${encodeURIComponent(
            `https://music.163.com/api/song/detail?ids=[${nextIds.join(",")}]`
          )}`,
          name: "corsproxy-v6",
        },
        // Strategy 2: CodeTabs Proxy (Backup)
        {
          url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(
            `https://music.163.com/api/song/detail?ids=[${nextIds.join(",")}]`
          )}`,
          name: "codetabs-v6",
        },
      ];

      let success = false;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          console.log(`Loading more tracks via ${endpoint.name}...`);
          const res = await fetch(endpoint.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          const newTracks = data.songs || [];

          if (newTracks.length > 0) {
            setPlaylistTracks((prev) => [...prev, ...newTracks]);
            success = true;
            break; // Stop if successful
          }
        } catch (error) {
          console.warn(
            `Failed to load more tracks via ${endpoint.name}:`,
            error
          );
          lastError = error;
        }
      }

      if (!success) {
        console.error("All load more strategies failed", lastError);
      }
    } catch (e) {
      console.error("Failed to load more tracks", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Scroll to active track
  const activeTrackRef = useRef<HTMLDivElement>(null);

  const playlistScrollRef = useRef<HTMLDivElement>(null);
  const playlistContentRef = useRef<HTMLDivElement>(null);
  useElasticScroll(playlistScrollRef, playlistContentRef);

  // Infinite Scroll Observer (Sidebar Mode)
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoadingMore &&
          playlistTracks.length < allTrackIds.length
        ) {
          loadMoreTracks();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isLoadingMore, playlistTracks.length, allTrackIds.length]);

  // Infinite Scroll Check (Fixed Mode)
  useEffect(() => {
    if (mode === "fixed" && !isHidden && parsedType === 0) {
      // If we are viewing a track near the end of the loaded list, load more
      if (
        !isLoadingMore &&
        playlistTracks.length < allTrackIds.length &&
        visualTrackIndex >= playlistTracks.length - 10
      ) {
        loadMoreTracks();
      }
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

  const fetchSongUrl = async (id: string) => {
    // Try standard outer url first (fastest, but might fail for some)
    // Actually, outer url often returns HTML for blocked songs, hard to detect without HEAD request
    // So better to use API directly via proxy

    const strategies = [
      {
        name: "api-v6-corsproxy",
        url: `https://corsproxy.io/?${encodeURIComponent(
          `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`
        )}`,
      },
      {
        name: "api-v6-codetabs",
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(
          `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`
        )}`,
      },
    ];

    for (const strategy of strategies) {
      try {
        const res = await fetch(strategy.url);
        if (!res.ok) continue;
        const data = await res.json();
        const songUrl = data.data?.[0]?.url;
        if (songUrl) return songUrl.replace(/^http:/, "https:");
      } catch (e) {
        console.warn(`Failed to fetch song url via ${strategy.name}`, e);
      }
    }

    // Fallback to standard outer URL if API fails (last resort)
    return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
  };

  // Audio Element Management
  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      // Determine current track ID
      let trackId = null;
      if (parsedType === 2) {
        trackId = parsedId;
      } else if (parsedType === 0 && playlistTracks.length > 0) {
        trackId = playlistTracks[currentTrackIndex]?.id;
      }

      if (trackId && audioRef.current) {
        // If it's the same ID and we have a valid src, don't reload
        // But we don't store the current ID in ref easily, so checking src might be tricky if it's a signed URL
        // Let's rely on a ref to track current loaded ID
        if (audioRef.current.dataset.currentId === String(trackId)) return;

        // New track detected: Stop old track immediately
        audioRef.current.pause();
        setIsPlaying(false);

        try {
          const realUrl = await fetchSongUrl(String(trackId));
          if (!isMounted) return;

          if (!realUrl || realUrl.includes("404")) {
            console.warn("Song appears unavailable:", trackId);
            if (parsedType === 0) {
              // Auto skip unavailable songs in playlist
              console.log("Auto-skipping unavailable track...");
              setTimeout(() => playNext(), 1500);
            }
            return;
          }

          audioRef.current.src = realUrl;
          audioRef.current.dataset.currentId = String(trackId);

          // Auto play if not muted locally
          // if (!isMuted) {
          const shouldPlay =
            !isFirstMount.current || (!isKP && syncedIsPlaying);

          if (shouldPlay) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch((e) => console.warn("Auto-play blocked:", e));
            }
            setIsPlaying(true);
          }

          // Always clear first mount flag after first load attempt
          if (isFirstMount.current) {
            isFirstMount.current = false;
          }
          // }
        } catch (e) {
          console.error("Error loading audio:", e);
        }
      }
    };

    loadAudio();

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

  // Auto-open input in sidebar mode if no music playing
  useEffect(() => {
    if (mode === "sidebar" && !parsedId && isKP) {
      setShowInput(true);
    }
  }, [mode, parsedId, isKP]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const playNext = (isAuto = false) => {
    if (parsedType === 0 && playlistTracks.length > 0) {
      if (isAuto && playMode === "single") {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
          setIsPlaying(true);
        }
        return;
      }

      if (playMode === "shuffle") {
        let nextIndex = Math.floor(Math.random() * playlistTracks.length);
        // Try to avoid same song if length > 1
        if (playlistTracks.length > 1 && nextIndex === currentTrackIndex) {
          nextIndex = (nextIndex + 1) % playlistTracks.length;
        }
        setCurrentTrackIndex(nextIndex);
      } else {
        setCurrentTrackIndex((prev) => (prev + 1) % playlistTracks.length);
      }
    }
  };

  const playPrev = () => {
    if (parsedType === 0 && playlistTracks.length > 0) {
      if (playMode === "shuffle") {
        let prevIndex = Math.floor(Math.random() * playlistTracks.length);
        if (playlistTracks.length > 1 && prevIndex === currentTrackIndex) {
          prevIndex =
            (prevIndex - 1 + playlistTracks.length) % playlistTracks.length;
        }
        setCurrentTrackIndex(prevIndex);
      } else {
        setCurrentTrackIndex(
          (prev) => (prev - 1 + playlistTracks.length) % playlistTracks.length
        );
      }
    }
  };

  const togglePlayMode = () => {
    setPlayMode((prev) => {
      if (prev === "sequence") return "shuffle";
      if (prev === "shuffle") return "single";
      return "sequence";
    });
  };

  // Handle Volume
  // const handleVolumeChange = (newVol: number) => {
  //   setVolume(newVol);
  //   localStorage.setItem("runtable_bgm_volume", newVol.toString());
  //   if (audioRef.current) {
  //     audioRef.current.volume = newVol;
  //   }
  //   if (newVol === 0) {
  //     setIsMuted(true);
  //   } else if (isMuted) {
  //     setIsMuted(false);
  //   }
  // };

  // Sync Audio Events
  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    if (parsedType === 0 && playlistTracks.length > 0) {
      // Auto play next
      playNext(true);
    } else {
      // Loop single song
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleInputChange = (val: string) => {
    setInputUrl(val);
    // Auto-detect type from pasted URL
    if (val.includes("playlist")) {
      setMusicType("playlist");
      const match = val.match(/id=(\d+)/);
      if (match) setInputUrl(match[1]);
    } else if (val.includes("song")) {
      setMusicType("song");
      const match = val.match(/id=(\d+)/);
      if (match) setInputUrl(match[1]);
    }
  };

  const handleSave = () => {
    let finalUrl = inputUrl;
    // Extract ID if it's still a full URL
    const match = inputUrl.match(/id=(\d+)/);
    if (match) {
      finalUrl = match[1];
    }

    if (!finalUrl.trim()) {
      onUpdateUrl("");
      setShowInput(false);
      return;
    }

    // Add prefix based on type
    const prefix = musicType === "playlist" ? "p:" : "s:";
    onUpdateUrl(prefix + finalUrl);
    setShowInput(false);
  };

  // Format time
  const formatTime = (time: number) => {
    if (!time) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const containerClass =
    mode === "sidebar"
      ? `w-full h-full flex flex-col ${className}`
      : isMobile
      ? "hidden" // Hide floating player on mobile (audio continues in background)
      : `fixed z-[100000] flex flex-col items-end gap-2 pointer-events-none ${
          isHidden ? "invisible opacity-0" : "visible opacity-100"
        } transition-opacity duration-300`;

  const containerStyle =
    mode === "fixed" && !isMobile ? { left: position.x, top: position.y } : {};

  const innerClass =
    mode === "sidebar"
      ? "flex flex-col gap-4 w-full h-full p-4 overflow-hidden relative" // Standard flex-col for sidebar
      : "pointer-events-auto relative flex items-center justify-center"; // Relative for fixed mode to anchor absolute panel

  const playerWidthClass =
    mode === "sidebar"
      ? "w-full flex-1 min-h-0"
      : isMobile
      ? "w-[calc(100vw-32px)] max-w-[280px]"
      : "w-[280px]";

  // Separate Audio Logic to persist across Portal switches
  const audioContent =
    parsedType === 2 || parsedType === 0 ? (
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (!isNaN(d) && d > 0) setDuration(d);
        }}
        onEnded={onEnded}
        onError={(e) => {
          console.error("Audio Load Error", e);
          if (parsedType === 0) {
            // Try next song if current fails
            console.log("Track failed to load, skipping to next...");
            setTimeout(() => playNext(true), 1500);
          }
        }}
        className="hidden"
      />
    ) : null;

  const uiContent =
    !isKP && mode === "fixed" ? null : (
      <div className={containerClass} style={containerStyle}>
        <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee 10s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

        {/* Audio used to be here, now moved out to persist */}

        <div className={innerClass}>
          {/* Control Panel (KP Only) - Only show in Sidebar mode */}
          {isKP && showInput && mode === "sidebar" && (
            <div
              className={`bg-slate-900/95 backdrop-blur border border-slate-700 p-3 rounded-xl shadow-2xl animate-slide-up z-50 ${
                mode === "sidebar"
                  ? "absolute top-4 left-4 right-4"
                  : isMobile
                  ? "w-[calc(100vw-32px)] max-w-[280px] mb-2"
                  : "w-72 mb-2"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <Music size={12} />
                  背景音乐设置
                </span>
                <button
                  onClick={() => setShowInput(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex bg-slate-800 rounded-lg p-1 mb-2">
                <button
                  onClick={() => setMusicType("song")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                    musicType === "song"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Disc size={12} /> 单曲
                </button>
                <button
                  onClick={() => setMusicType("playlist")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                    musicType === "playlist"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ListMusic size={12} /> 歌单
                </button>
              </div>

              <div className="space-y-2">
                <input
                  value={inputUrl}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={
                    musicType === "playlist"
                      ? "输入歌单ID或链接..."
                      : "输入单曲ID或链接..."
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none transition-all placeholder-slate-600 font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      onUpdateUrl(""); // Stop music
                      setShowInput(false);
                    }}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    停止播放
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-500"
                  >
                    同步播放
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                * 支持输入 ID (如 571246314) 或完整链接。
                <br />* 仅支持网易云音乐免费资源。
              </p>
            </div>
          )}

          {/* Player UI */}
          <div
            className={`flex gap-2 ${
              mode === "sidebar"
                ? "flex-col w-full flex-1 min-h-0 gap-4"
                : "items-end"
            }`}
          >
            {/* Toggle Button for Fixed Mode */}
            {mode === "fixed" && parsedId && (
              <div className="relative group/btn pointer-events-auto">
                {/* Progress Ring */}
                <svg
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52px] h-[52px] -rotate-90 pointer-events-none"
                  viewBox="0 0 52 52"
                >
                  <circle
                    cx="26"
                    cy="26"
                    r="24"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="2"
                    className="opacity-50"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="24"
                    fill="none"
                    stroke="#c084fc" // Purple-400
                    strokeWidth="2"
                    strokeDasharray={2 * Math.PI * 24}
                    strokeDashoffset={
                      2 * Math.PI * 24 * (1 - currentTime / (duration || 1))
                    }
                    strokeLinecap="round"
                    className="transition-all duration-200 ease-linear"
                  />
                </svg>

                <div
                  onMouseDown={handleMouseDown}
                  onClick={() => !hasMoved && setIsCollapsed(!isCollapsed)}
                  className={`p-3 rounded-full border shadow-lg backdrop-blur transition-all shrink-0 active:cursor-grabbing flex items-center justify-center relative z-10 ${
                    isCollapsed
                      ? "bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      : "bg-indigo-600 border-indigo-500 text-white cursor-pointer hover:bg-indigo-500"
                  }`}
                >
                  <Music
                    size={20}
                    className={isPlaying ? "animate-pulse text-indigo-100" : ""}
                  />
                </div>
              </div>
            )}

            {parsedId &&
              (mode === "sidebar" ? (
                // Sidebar Mode: Standard List Layout
                <div
                  className={`transition-all duration-300 overflow-hidden flex flex-col ${playerWidthClass} h-full ${
                    parsedType === 2
                      ? "bg-transparent border-none shadow-none"
                      : "bg-slate-900/90 backdrop-blur rounded-xl shadow-xl border border-slate-700/50"
                  }`}
                >
                  {/* Custom UI for Songs & Playlist Header */}
                  <div
                    className={`p-3 flex items-center gap-3 shrink-0 ${
                      parsedType === 2
                        ? "bg-transparent hidden"
                        : "bg-slate-800/50"
                    }`}
                  >
                    {/* Album Art Placeholder */}
                    <div
                      onClick={() => parsedType === 2 && togglePlay()}
                      className={`w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 animate-spin-slow overflow-hidden ${
                        parsedType === 2
                          ? "cursor-pointer hover:scale-105 transition-transform"
                          : ""
                      }`}
                      style={{
                        animationPlayState: isPlaying ? "running" : "paused",
                      }}
                    >
                      {(parsedType === 0 || parsedType === 2) &&
                      (playlistTracks[currentTrackIndex]?.album?.picUrl ||
                        playlistTracks[currentTrackIndex]?.al?.picUrl) ? (
                        <div className="relative w-full h-full">
                          <img
                            src={
                              playlistTracks[currentTrackIndex].album?.picUrl ||
                              playlistTracks[currentTrackIndex].al?.picUrl
                            }
                            alt="cover"
                            className="w-full h-full object-cover"
                          />
                          {/* Vinyl center hole for single song */}
                          {parsedType === 2 && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-800 rounded-full border border-slate-600"></div>
                          )}
                        </div>
                      ) : (
                        <Music size={18} className="text-indigo-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex-1 overflow-hidden mr-2 relative h-4">
                          {(() => {
                            const trackName =
                              (parsedType === 0 || parsedType === 2) &&
                              playlistTracks.length > 0
                                ? playlistTracks[currentTrackIndex]?.name ||
                                  "未知歌曲"
                                : "背景音乐";
                            // Calculate visual length (Chinese ~ 2, English ~ 1)
                            const visualLength = trackName
                              .split("")
                              .reduce(
                                (acc: number, char: string) =>
                                  acc + (char.charCodeAt(0) > 127 ? 2 : 1),
                                0
                              );
                            const shouldScroll = visualLength > 12; // > 6 Chinese chars or 12 English chars
                            return (
                              <div
                                className={`text-xs font-bold text-slate-200 absolute top-0 left-0 ${
                                  shouldScroll
                                    ? "animate-marquee"
                                    : "truncate w-full"
                                }`}
                              >
                                <span className="pr-8">{trackName}</span>
                                {shouldScroll && (
                                  <span className="pr-8">{trackName}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div
                        className="h-1 bg-slate-700 rounded-full overflow-hidden cursor-pointer group"
                        onClick={(e) => {
                          if (!audioRef.current || !duration) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percent = x / rect.width;
                          audioRef.current.currentTime = percent * duration;
                        }}
                      >
                        <div
                          className="h-full bg-indigo-500 group-hover:bg-indigo-400 transition-all relative"
                          style={{
                            width: `${(currentTime / duration) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1">
                      {parsedType === 0 && (
                        <>
                          <button
                            onClick={togglePlayMode}
                            className="w-6 h-6 rounded-full text-slate-400 hover:text-white flex items-center justify-center transition-all mr-1"
                            title={
                              playMode === "sequence"
                                ? "顺序播放"
                                : playMode === "shuffle"
                                ? "随机播放"
                                : "单曲循环"
                            }
                          >
                            {playMode === "sequence" ? (
                              <Repeat size={14} fill="currentColor" />
                            ) : playMode === "shuffle" ? (
                              <Shuffle size={14} fill="currentColor" />
                            ) : (
                              <Repeat1 size={14} fill="currentColor" />
                            )}
                          </button>
                          <button
                            onClick={playPrev}
                            className="w-6 h-6 rounded-full text-slate-400 hover:text-white flex items-center justify-center transition-all"
                          >
                            <SkipBack size={14} fill="currentColor" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shrink-0"
                      >
                        {isPlaying ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play
                            size={14}
                            fill="currentColor"
                            className="ml-0.5"
                          />
                        )}
                      </button>

                      {parsedType === 0 && (
                        <button
                          onClick={() => playNext()}
                          className="w-6 h-6 rounded-full text-slate-400 hover:text-white flex items-center justify-center transition-all"
                        >
                          <SkipForward size={14} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Playlist Tracks List */}
                  {parsedType === 0 && (
                    <div
                      ref={playlistScrollRef}
                      className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 border-t border-slate-700/50 overscroll-y-none"
                    >
                      <div ref={playlistContentRef}>
                        {isLoadingPlaylist ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            正在加载歌单...
                          </div>
                        ) : playlistTracks.length > 0 ? (
                          <div className="divide-y divide-slate-800/50">
                            {playlistTracks.map((track, idx) => (
                              <div
                                key={track.id}
                                ref={
                                  currentTrackIndex === idx
                                    ? activeTrackRef
                                    : null
                                }
                                onClick={() => setCurrentTrackIndex(idx)}
                                className={`p-2 flex items-center gap-2 cursor-pointer transition-colors hover:bg-slate-800/50 group ${
                                  currentTrackIndex === idx
                                    ? "bg-indigo-500/10"
                                    : ""
                                }`}
                              >
                                {/* Track Number / Play Icon */}
                                <span
                                  className={`text-[10px] w-6 text-center shrink-0 ${
                                    currentTrackIndex === idx
                                      ? "text-indigo-400 font-bold"
                                      : "text-slate-600 group-hover:text-slate-400"
                                  }`}
                                >
                                  {currentTrackIndex === idx ? (
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 mx-auto animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                  ) : (
                                    idx + 1
                                  )}
                                </span>

                                {/* Album Art (Small) */}
                                <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden shrink-0 border border-slate-700/50">
                                  {track.album?.picUrl || track.al?.picUrl ? (
                                    <img
                                      src={
                                        track.album?.picUrl || track.al?.picUrl
                                      }
                                      alt=""
                                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                                      <Disc size={12} />
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div
                                    className={`text-xs truncate font-medium ${
                                      currentTrackIndex === idx
                                        ? "text-indigo-300"
                                        : "text-slate-300 group-hover:text-slate-200"
                                    }`}
                                  >
                                    {track.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate group-hover:text-slate-400">
                                    {track.artists
                                      ?.map((a: any) => a.name)
                                      .join(", ") ||
                                      track.ar
                                        ?.map((a: any) => a.name)
                                        .join(", ")}
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-600 font-mono shrink-0">
                                  {formatTime(
                                    track.duration / 1000 || track.dt / 1000
                                  )}
                                </span>
                              </div>
                            ))}

                            {/* Sentinel / Load More Indicator */}
                            {playlistTracks.length < allTrackIds.length && (
                              <div
                                ref={loadMoreRef}
                                onClick={loadMoreTracks}
                                className="p-3 text-center text-[10px] text-slate-500 hover:text-indigo-400 cursor-pointer transition-colors"
                              >
                                {isLoadingMore ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <div
                                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                                      style={{ animationDelay: "0ms" }}
                                    />
                                    <div
                                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                                      style={{ animationDelay: "150ms" }}
                                    />
                                    <div
                                      className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"
                                      style={{ animationDelay: "300ms" }}
                                    />
                                  </span>
                                ) : (
                                  "滚动或点击加载更多"
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 text-center flex flex-col items-center gap-2">
                            <span className="text-xs text-slate-500">
                              无法加载歌单信息
                            </span>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() =>
                                parsedId && fetchPlaylist(parsedId)
                              }
                              className="text-indigo-400 hover:text-indigo-300"
                            >
                              点击重试
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Single Song Mode: Large Record Player */}
                  {parsedType === 2 && (
                    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                      {/* Record Player Container */}
                      <div
                        onClick={togglePlay}
                        className="relative z-10 cursor-pointer group scale-90 sm:scale-100 transition-transform duration-300 active:scale-95"
                        title={isPlaying ? "点击暂停" : "点击播放"}
                      >
                        {/* Vinyl Disc */}
                        <div
                          className={`w-64 h-64 rounded-full bg-[#111] shadow-2xl flex items-center justify-center relative animate-spin`}
                          style={{
                            animationDuration: "8s",
                            animationPlayState: isPlaying
                              ? "running"
                              : "paused",
                            background:
                              "radial-gradient(circle, #1a1a1a 0%, #111 30%, #000 31%, #111 32%, #000 33%, #111 34%, #000 35%, #111 36%, #000 37%, #111 38%, #000 39%, #111 40%, #000 41%, #111 42%, #000 43%, #111 44%, #000 45%, #111 46%, #000 47%, #111 48%, #000 49%, #111 50%, #000 51%, #111 52%, #000 53%, #111 54%, #000 55%, #111 56%, #000 57%, #111 58%, #000 59%, #111 60%, #000 61%, #111 62%, #000 63%, #111 64%, #000 65%, #111 66%, #000 67%, #111 68%, #000 69%, #111 70%, #181818 100%)",
                            boxShadow:
                              "0 0 20px rgba(0,0,0,0.8), inset 0 0 0 2px #222",
                          }}
                        >
                          {/* Inner Label / Cover */}
                          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#222] relative shadow-inner">
                            {playlistTracks[currentTrackIndex]?.album?.picUrl ||
                            playlistTracks[currentTrackIndex]?.al?.picUrl ? (
                              <img
                                src={
                                  playlistTracks[currentTrackIndex].album
                                    ?.picUrl ||
                                  playlistTracks[currentTrackIndex].al?.picUrl
                                }
                                alt="cover"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500">
                                <Music size={32} />
                              </div>
                            )}
                            {/* Center Hole */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#e5e5e5] rounded-full border border-[#999]"></div>
                          </div>
                        </div>

                        {/* Tonearm */}
                        <div
                          className="absolute top-[-30px] right-[-30px] w-24 h-44 pointer-events-none transition-transform duration-700 ease-in-out origin-[24px_24px]"
                          style={{
                            transform: isPlaying
                              ? "rotate(24deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          {/* Base */}
                          <div className="absolute top-0 left-0 w-12 h-12 rounded-full bg-neutral-800 shadow-xl border border-white/5 z-20 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-neutral-600 shadow-inner"></div>
                          </div>

                          {/* Rod */}
                          <div className="absolute top-6 left-6 w-2 h-32 bg-neutral-700 origin-top transform -rotate-12 rounded-full shadow-lg z-10"></div>

                          {/* Head */}
                          <div className="absolute bottom-6 right-7 w-6 h-9 bg-neutral-800 rounded shadow-xl transform rotate-[18deg] z-20 border border-white/5"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Fixed Mode: Radial / Stair Layout
                <div
                  className={`absolute bottom-[26px] right-[26px] pointer-events-none transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) origin-bottom-right ${
                    isCollapsed
                      ? "opacity-0 scale-0 rotate-45"
                      : "opacity-100 scale-100 rotate-0"
                  }`}
                >
                  {parsedType === 0 && playlistTracks.length > 0
                    ? (() => {
                        // Calculate visible range: Current + Neighbors (No Looping for start/end)
                        const total = playlistTracks.length;
                        const VISIBLE_COUNT = 6;
                        const items = [];

                        for (let i = 0; i < VISIBLE_COUNT; i++) {
                          const offset = i - 2;
                          const targetIndex = visualTrackIndex + offset;
                          if (targetIndex >= 0 && targetIndex < total) {
                            items.push({
                              track: playlistTracks[targetIndex],
                              index: targetIndex,
                            });
                          } else {
                            items.push(null);
                          }
                        }

                        return (
                          <div className="relative w-0 h-0">
                            {items.map((item, i) => {
                              if (!item) return null;
                              const { track, index: realIndex } = item;

                              // Logic to determine if this is the active one (center of our window)
                              // We picked 6 items, starting from current-2. So index 2 is current.
                              const isVisualCenter = i === 2;
                              const distanceFromCenter = i - 2; // -2, -1, 0, 1, 2, 3
                              const isPlayingTrack =
                                realIndex === currentTrackIndex;

                              // Calculate position based on fan/stair
                              // Angle: 0 is right, -90 is top, 180 is left.
                              // We want them top-leftish. Button is at bottom-right of this container.
                              // Let's span from 180 (left) to 270 (top).
                              // Center item (current) at 225 deg (top-left diagonal)
                              const baseAngle = 225;
                              const angleStep = 18; // Even tighter spacing
                              const angle =
                                baseAngle + distanceFromCenter * angleStep;
                              const rad = (angle * Math.PI) / 180;

                              // Further radius as requested
                              const radius =
                                105 + Math.abs(distanceFromCenter) * 6;

                              // Adjust center to button center (origin is now at button center)
                              const x = Math.cos(rad) * radius;
                              const y = Math.sin(rad) * radius;

                              // Size scaling
                              const size = isVisualCenter ? 80 : 60; // Rectangular/Square cards need more space
                              const zIndex = isVisualCenter
                                ? 50
                                : 40 - Math.abs(distanceFromCenter);

                              // Rotation for fan effect (bottom points to center)
                              // At 270 (top), we want 0 deg rotation (upright) -> 270 + 90 = 360
                              const rotation = angle + 90;

                              return (
                                <div
                                  key={track.id}
                                  className={`absolute rounded-[24px] shadow-xl border-2 transition-all duration-300 flex items-center justify-center overflow-hidden pointer-events-auto cursor-pointer group/item
                                    ${
                                      isVisualCenter
                                        ? "border-indigo-500 z-50 ring-2 ring-indigo-500/20"
                                        : "border-slate-700 hover:border-slate-500 bg-slate-800"
                                    }
                                `}
                                  style={{
                                    width: size,
                                    height: size,
                                    transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rotation}deg)`,
                                    zIndex,
                                    opacity:
                                      1 - Math.abs(distanceFromCenter) * 0.1, // Less fade
                                  }}
                                  onWheel={(e) => {
                                    e.stopPropagation();
                                    const now = Date.now();
                                    if (now - lastScrollRef.current < 100)
                                      return; // Faster throttle for smooth preview
                                    lastScrollRef.current = now;
                                    if (e.deltaY > 0) {
                                      if (visualTrackIndex < total - 1) {
                                        setVisualTrackIndex((prev) => prev + 1);
                                      }
                                    } else {
                                      if (visualTrackIndex > 0) {
                                        setVisualTrackIndex((prev) => prev - 1);
                                      }
                                    }
                                  }}
                                  onClick={() => {
                                    if (isPlayingTrack) {
                                      togglePlay();
                                    } else {
                                      setCurrentTrackIndex(realIndex);
                                    }
                                  }}
                                  title={track.name}
                                >
                                  {track.album?.picUrl || track.al?.picUrl ? (
                                    <img
                                      src={
                                        track.album?.picUrl || track.al?.picUrl
                                      }
                                      alt={track.name}
                                      className={`w-full h-full object-cover ${
                                        !isPlayingTrack && isVisualCenter
                                          ? "grayscale-[50%]"
                                          : ""
                                      }`}
                                    />
                                  ) : (
                                    <Music
                                      size={size / 2}
                                      className="text-slate-500"
                                    />
                                  )}

                                  {/* Play/Pause Overlay */}
                                  <div
                                    className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${
                                      isVisualCenter || isPlayingTrack
                                        ? "opacity-100"
                                        : "opacity-0 group-hover/item:opacity-100"
                                    }`}
                                  >
                                    {isPlayingTrack ? (
                                      isPlaying ? (
                                        <Pause
                                          size={20}
                                          className="text-white"
                                        />
                                      ) : (
                                        <Play
                                          size={20}
                                          className="text-white"
                                        />
                                      )
                                    ) : (
                                      // Show play icon on hover or if it's the focused card (to indicate "click to play")
                                      isVisualCenter && (
                                        <Play
                                          size={20}
                                          className="text-white/70"
                                        />
                                      )
                                    )}
                                  </div>

                                  {/* Progress Bar for Current - Only if Playing */}
                                  {isPlayingTrack && (
                                    <div
                                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-700/80 rounded-full overflow-hidden pointer-events-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!audioRef.current || !duration)
                                          return;
                                        const rect =
                                          e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const percent = x / rect.width;
                                        audioRef.current.currentTime =
                                          percent * duration;
                                      }}
                                    >
                                      <div
                                        className="h-full bg-indigo-500"
                                        style={{
                                          width: `${
                                            (currentTime / duration) * 100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    : null}
                </div>
              ))}

            {/* Controls */}
            {mode === "sidebar" && isKP && (
              <div className="flex shrink-0 flex-row w-full justify-end items-center mt-2">
                <button
                  onClick={() => setShowInput(!showInput)}
                  className={`p-3 rounded-full shadow-lg transition-all border border-white/5 ${
                    showInput
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                  title="设置背景音乐"
                >
                  <Music size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );

  if (mode === "fixed" && !isMobile) {
    return (
      <>
        {audioContent}
        {createPortal(uiContent, document.body)}
      </>
    );
  }

  return (
    <>
      {audioContent}
      {uiContent}
    </>
  );
};
