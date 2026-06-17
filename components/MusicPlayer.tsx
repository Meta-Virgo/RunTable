import React from "react";
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
  Loader2,
} from "lucide-react";
import { Button } from "./UI";
import { SkeletonBlock } from "./Skeleton";
import { useMusicPlaybackController } from "../hooks/useMusicPlaybackController";
import { themeRgb } from "../utils/theme";

interface MusicPlayerProps {
  url: string | null;
  isKP: boolean;
  onUpdateUrl: (url: string) => void;
  mode?: "fixed" | "sidebar";
  className?: string;
  isMobile?: boolean;
  isHidden?: boolean;
  globalMute?: boolean;
  volume?: number;
  syncedIsPlaying?: boolean;
  syncedTrackIndex?: number;
  onUpdateSyncState?: (isPlaying: boolean, trackIndex: number) => void;
}

const MusicHeaderSkeleton: React.FC = () => (
  <>
    <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full bg-dicecho-border/30" />
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SkeletonBlock className="h-3.5 w-28 bg-dicecho-border/35" />
        <SkeletonBlock className="h-3 w-16 bg-dicecho-border/25" />
      </div>
      <SkeletonBlock className="h-1 w-full rounded-full bg-dicecho-border/25" />
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <SkeletonBlock className="h-6 w-6 rounded-full bg-dicecho-border/25" />
      <SkeletonBlock className="h-8 w-8 rounded-full bg-dicecho-primary/25" />
      <SkeletonBlock className="h-6 w-6 rounded-full bg-dicecho-border/25" />
    </div>
  </>
);

const PlaylistTrackSkeleton: React.FC<{ index: number }> = ({ index }) => (
  <div className="flex items-center gap-2 p-2">
    <SkeletonBlock className="h-3 w-6 shrink-0 bg-dicecho-border/20" />
    <SkeletonBlock className="h-8 w-8 shrink-0 rounded bg-dicecho-border/30" />
    <div className="min-w-0 flex-1 space-y-1.5">
      <SkeletonBlock
        className={`h-3 bg-dicecho-border/35 ${
          index % 3 === 0 ? "w-2/3" : index % 3 === 1 ? "w-1/2" : "w-3/4"
        }`}
      />
      <SkeletonBlock className="h-2.5 w-20 bg-dicecho-border/25" />
    </div>
    <SkeletonBlock className="h-2.5 w-8 shrink-0 bg-dicecho-border/20" />
  </div>
);

const PlaylistSkeleton: React.FC = () => (
  <div className="divide-y divide-dicecho-border/20">
    {Array.from({ length: 12 }).map((_, index) => (
      <PlaylistTrackSkeleton key={index} index={index} />
    ))}
  </div>
);

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  url,
  isKP,
  onUpdateUrl,
  mode = "fixed",
  className = "",
  isMobile = false,
  isHidden = false,
  globalMute = false,
  volume = 0.8,
  syncedIsPlaying,
  syncedTrackIndex,
  onUpdateSyncState,
}) => {
  const music = useMusicPlaybackController({
    url,
    isKP,
    onUpdateUrl,
    mode,
    isMobile,
    isHidden,
    globalMute,
    volume,
    syncedIsPlaying,
    syncedTrackIndex,
    onUpdateSyncState,
  });

  const {
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
    isLoadingPlaylist,
    isLoadingMore,
    isCollapsed,
    setIsCollapsed,
    activeTrackRef,
    playlistScrollRef,
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
  } = music;

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
        // @ts-ignore
        referrerPolicy="no-referrer"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (!isNaN(d) && d > 0) setDuration(d);
        }}
        onEnded={onEnded}
        onError={(e) => {
          handleAudioError(e.currentTarget.error, e);
        }}
        className="hidden"
      />
    ) : null;

  const uiContent =
    !isKP && mode === "fixed" ? null : (
      <div className={containerClass} style={containerStyle}>
        {/* Audio used to be here, now moved out to persist */}

        <div className={innerClass}>
          {/* Control Panel (KP Only) - Only show in Sidebar mode */}
          {isKP && showInput && mode === "sidebar" && (
            <div
              className="relative z-20 w-full shrink-0 rounded-lg border border-dicecho-border/60 bg-dicecho-card/80 p-4 dicecho-card-shadow"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-dicecho-primary/35 bg-dicecho-primary/15 text-dicecho-primary">
                    <Music size={13} />
                  </span>
                  背景音乐设置
                </span>
                <button
                  onClick={() => setShowInput(false)}
                  aria-label="关闭背景音乐设置"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-dicecho-muted transition-colors hover:bg-dicecho-raised/70 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex bg-dicecho-panel/80 rounded-lg p-1 mb-3 border border-dicecho-border/45">
                <button
                  onClick={() => setMusicType("song")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    musicType === "song"
                      ? "border-dicecho-primary/55 bg-dicecho-primary/18 text-white"
                      : "border-transparent text-dicecho-muted hover:bg-dicecho-raised/55 hover:text-white"
                  }`}
                >
                  <Disc size={12} /> 单曲
                </button>
                <button
                  onClick={() => setMusicType("playlist")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    musicType === "playlist"
                      ? "border-dicecho-primary/55 bg-dicecho-primary/18 text-white"
                      : "border-transparent text-dicecho-muted hover:bg-dicecho-raised/55 hover:text-white"
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
                  className="w-full rounded-lg border border-dicecho-border/55 bg-dicecho-panel/85 px-3 py-2 text-xs text-white outline-none transition-colors duration-150 placeholder-dicecho-muted/60 focus:border-dicecho-primary/80 focus:ring-1 focus:ring-dicecho-primary/25 font-mono"
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
                    className="border border-rose-400/25 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                  >
                    停止播放
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleSave}
                    className="bg-dicecho-primary-strong hover:bg-dicecho-primary"
                  >
                    同步播放
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-dicecho-muted/75 mt-3 leading-relaxed">
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
            {mode === "fixed" && parsedId && parsedType !== 2 && (
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
                    stroke={themeRgb("border")}
                    strokeWidth="2"
                    className="opacity-50"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="24"
                    fill="none"
                    stroke={themeRgb("primary")}
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
                      ? "bg-dicecho-panel/90 border-dicecho-border/60 text-dicecho-muted hover:text-white hover:bg-dicecho-raised cursor-pointer"
                      : "bg-dicecho-primary-strong border-dicecho-primary text-white cursor-pointer hover:bg-dicecho-primary"
                  }`}
                >
                  <Music
                    size={20}
                    className={isPlaying ? "animate-pulse text-white" : ""}
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
                      : "bg-dicecho-card/70 rounded-lg dicecho-card-shadow border border-dicecho-border/55"
                  }`}
                >
                  {/* Custom UI for Songs & Playlist Header */}
                  <div
                    className={`p-3 flex items-center gap-3 shrink-0 ${
                      parsedType === 2
                        ? "bg-transparent hidden"
                        : "bg-dicecho-panel/65 border-b border-dicecho-border/35"
                    }`}
                  >
                    {isLoadingPlaylist ? (
                      <MusicHeaderSkeleton />
                    ) : (
                      <>
                        {/* Album Art Placeholder */}
                        <div
                          onClick={() => parsedType === 2 && togglePlay()}
                          className={`w-10 h-10 rounded-full bg-dicecho-card flex items-center justify-center border border-dicecho-border/50 shrink-0 animate-spin-slow overflow-hidden ${
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
                                  playlistTracks[currentTrackIndex].album
                                    ?.picUrl ||
                                  playlistTracks[currentTrackIndex].al?.picUrl
                                }
                                alt="cover"
                                className="w-full h-full object-cover"
                              />
                              {/* Vinyl center hole for single song */}
                              {parsedType === 2 && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-dicecho-card rounded-full border border-dicecho-border"></div>
                              )}
                            </div>
                          ) : (
                            <Music size={18} className="text-dicecho-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <div className="flex-1 overflow-hidden mr-2 relative h-4">
                              {(() => {
                                const trackName =
                                  (parsedType === 0 || parsedType === 2) &&
                                  playlistTracks.length > 0
                                    ? playlistTracks[currentTrackIndex]?.name ||
                                      "未知歌曲"
                                    : "背景音乐";
                                return (
                                  <div className="text-xs font-bold text-white truncate w-full">
                                    {trackName}
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="text-[10px] text-dicecho-muted font-mono">
                                {formatTime(currentTime)} / {formatTime(duration)}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div
                            className="h-1 bg-dicecho-raised rounded-full overflow-hidden cursor-pointer group"
                            onClick={(e) => {
                              if (!audioRef.current || !duration) return;
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const percent = x / rect.width;
                              audioRef.current.currentTime = percent * duration;
                            }}
                          >
                            <div
                              className="h-full bg-dicecho-primary group-hover:bg-dicecho-primary-strong transition-all relative"
                              style={{
                                width: `${(currentTime / duration) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {parsedType === 0 && (
                            <>
                              <button
                                onClick={togglePlayMode}
                                className="w-6 h-6 rounded-full text-dicecho-muted hover:text-white flex items-center justify-center transition-all mr-1"
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
                                className="w-6 h-6 rounded-full text-dicecho-muted hover:text-white flex items-center justify-center transition-all"
                              >
                                <SkipBack size={14} fill="currentColor" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={togglePlay}
                            className="w-8 h-8 rounded-full bg-dicecho-primary-strong hover:bg-dicecho-primary text-white flex items-center justify-center transition-all shadow-lg shadow-dicecho-primary/20 shrink-0"
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
                              className="w-6 h-6 rounded-full text-dicecho-muted hover:text-white flex items-center justify-center transition-all"
                            >
                              <SkipForward size={14} fill="currentColor" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Playlist Tracks List */}
                  {parsedType === 0 && (
                    <div
                      ref={playlistScrollRef}
                      className="flex-1 overflow-y-auto custom-scrollbar bg-dicecho-card/45 border-t border-dicecho-border/40 overscroll-contain"
                    >
                      <div>
                        {isLoadingPlaylist ? (
                          <PlaylistSkeleton />
                        ) : playlistTracks.length > 0 ? (
                          <div className="divide-y divide-dicecho-border/25">
                            {playlistTracks.map((track, idx) => (
                              <div
                                key={track.id}
                                ref={
                                  currentTrackIndex === idx
                                    ? activeTrackRef
                                    : null
                                }
                                onClick={() => {
                                  if (!isLoadingSong) setCurrentTrackIndex(idx);
                                }}
                                className={`p-2 flex items-center gap-2 cursor-pointer transition-colors hover:bg-dicecho-raised/45 group ${
                                  currentTrackIndex === idx
                                    ? "bg-dicecho-primary/12"
                                    : ""
                                } ${isLoadingSong ? "cursor-not-allowed" : ""}`}
                              >
                                {/* Track Number / Play Icon */}
                                <span
                                  className={`text-[10px] w-6 text-center shrink-0 ${
                                    currentTrackIndex === idx
                                      ? "text-dicecho-primary font-bold"
                                      : "text-dicecho-muted/60 group-hover:text-dicecho-muted"
                                  }`}
                                >
                                  {currentTrackIndex === idx &&
                                  isLoadingSong ? (
                                    <Loader2
                                      size={10}
                                      className="mx-auto animate-spin text-dicecho-primary"
                                    />
                                  ) : currentTrackIndex === idx ? (
                                    <div className="w-2 h-2 rounded-full bg-dicecho-primary mx-auto animate-pulse shadow-[0_0_8px_rgba(155,134,246,0.5)]" />
                                  ) : (
                                    idx + 1
                                  )}
                                </span>

                                {/* Album Art (Small) */}
                                <div className="w-8 h-8 rounded bg-dicecho-raised overflow-hidden shrink-0 border border-dicecho-border/50">
                                  {track.album?.picUrl || track.al?.picUrl ? (
                                    <img
                                      src={
                                        track.album?.picUrl || track.al?.picUrl
                                      }
                                      alt=""
                                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-dicecho-muted/60">
                                      <Disc size={12} />
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div
                                    className={`text-xs truncate font-medium ${
                                      currentTrackIndex === idx
                                        ? "text-dicecho-primary"
                                        : "text-white/85 group-hover:text-white"
                                    }`}
                                  >
                                    {track.name}
                                  </div>
                                  <div className="text-[10px] text-dicecho-muted truncate group-hover:text-dicecho-muted/95">
                                    {track.artists
                                      ?.map((a: any) => a.name)
                                      .join(", ") ||
                                      track.ar
                                        ?.map((a: any) => a.name)
                                        .join(", ")}
                                  </div>
                                </div>
                                <span className="text-[10px] text-dicecho-muted/70 font-mono shrink-0">
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
                                className="p-3 text-center text-[10px] text-dicecho-muted hover:text-dicecho-primary cursor-pointer transition-colors"
                              >
                                {isLoadingMore ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <div
                                      className="w-1.5 h-1.5 bg-dicecho-primary rounded-full"
                                      style={{ animationDelay: "0ms" }}
                                    />
                                    <div
                                      className="w-1.5 h-1.5 bg-dicecho-primary rounded-full"
                                      style={{ animationDelay: "150ms" }}
                                    />
                                    <div
                                      className="w-1.5 h-1.5 bg-dicecho-primary rounded-full"
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
                            <span className="text-xs text-dicecho-muted">
                              无法加载歌单信息
                            </span>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() =>
                                parsedId && fetchPlaylist(parsedId)
                              }
                              className="text-dicecho-primary hover:text-white"
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
                    <div className="flex-1 flex items-center justify-center relative overflow-hidden rounded-lg bg-dicecho-card/35 border border-dicecho-border/35">
                      {/* Record Player Container */}
                      <div
                        onClick={togglePlay}
                        className="relative z-10 cursor-pointer group scale-90 sm:scale-100 transition-transform duration-300 active:scale-95"
                      >
                        {/* Vinyl Disc */}
                        <div
                          className={`w-64 h-64 rounded-full bg-dicecho-card shadow-xl shadow-black/35 flex items-center justify-center relative animate-spin`}
                          style={{
                            animationDuration: "8s",
                            animationPlayState: isPlaying
                              ? "running"
                              : "paused",
                            background:
                              "radial-gradient(circle, rgb(var(--theme-bg)) 0%, rgb(var(--theme-panel)) 28%, rgb(var(--theme-card)) 29%, rgb(var(--theme-raised)) 30%, rgb(var(--theme-card)) 32%, rgb(var(--theme-raised)) 34%, rgb(var(--theme-card)) 36%, rgb(var(--theme-raised)) 38%, rgb(var(--theme-card)) 40%, rgb(var(--theme-raised)) 42%, rgb(var(--theme-card)) 44%, rgb(var(--theme-raised)) 46%, rgb(var(--theme-card)) 48%, rgb(var(--theme-raised)) 50%, rgb(var(--theme-card)) 52%, rgb(var(--theme-raised)) 54%, rgb(var(--theme-card)) 56%, rgb(var(--theme-raised)) 58%, rgb(var(--theme-card)) 60%, rgb(var(--theme-panel)) 100%)",
                            boxShadow:
                              "0 0 20px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(86,96,120,0.45)",
                          }}
                        >
                          {/* Inner Label / Cover */}
                          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-dicecho-border/60 relative shadow-inner">
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
                              <div className="w-full h-full bg-dicecho-raised flex items-center justify-center text-dicecho-muted">
                                <Music size={32} />
                              </div>
                            )}
                            {isLoadingSong && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                                <Loader2
                                  size={24}
                                  className="text-white animate-spin"
                                />
                              </div>
                            )}
                            {/* Center Hole */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-dicecho-bg rounded-full border border-dicecho-border z-30"></div>
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
                          <div className="absolute top-0 left-0 w-12 h-12 rounded-full bg-dicecho-raised shadow-xl border border-dicecho-border/50 z-20 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-dicecho-border shadow-inner"></div>
                          </div>

                          {/* Rod */}
                          <div className="absolute top-6 left-6 w-2 h-32 bg-dicecho-border origin-top transform -rotate-12 rounded-full shadow-lg z-10"></div>

                          {/* Head */}
                          <div className="absolute bottom-6 right-7 w-6 h-9 bg-dicecho-raised rounded shadow-xl transform rotate-[18deg] z-20 border border-dicecho-border/50"></div>
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
                                        ? "border-dicecho-primary z-50 ring-2 ring-dicecho-primary/20"
                                        : "border-dicecho-border hover:border-dicecho-primary/60 bg-dicecho-card"
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
                                    if (isLoadingSong) return;
                                    if (isPlayingTrack) {
                                      togglePlay();
                                    } else {
                                      setCurrentTrackIndex(realIndex);
                                    }
                                  }}
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
                                      className="text-dicecho-muted"
                                    />
                                  )}

                                  {/* Play/Pause Overlay */}
                                  <div
                                    className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${
                                      isVisualCenter || isPlayingTrack
                                        ? "opacity-100"
                                        : "opacity-0 group-hover/item:opacity-100"
                                    } ${
                                      isLoadingSong ? "cursor-not-allowed" : ""
                                    }`}
                                  >
                                    {isPlayingTrack && isLoadingSong ? (
                                      <Loader2
                                        size={20}
                                        className="text-white animate-spin"
                                      />
                                    ) : isPlayingTrack ? (
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
                                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-1 bg-dicecho-raised/90 rounded-full overflow-hidden pointer-events-auto"
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
                                        className="h-full bg-dicecho-primary"
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
                  className={`p-3 rounded-full shadow-lg transition-all border ${
                    showInput
                      ? "bg-dicecho-primary-strong text-white border-dicecho-primary/70"
                      : "bg-dicecho-card text-dicecho-muted border-dicecho-border/50 hover:bg-dicecho-raised hover:text-white hover:border-dicecho-primary/50"
                  }`}
                >
                  <Music size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );

  if (mode === "fixed" && isHidden) {
    return <>{audioContent}</>;
  }

  if (mode === "fixed" && !isMobile) {
    return (
      <>
        {audioContent}
        {createPortal(uiContent, document.body)}
      </>
    );
  }

  if (isHidden) {
    return <>{audioContent}</>;
  }

  return (
    <>
      {audioContent}
      {uiContent}
    </>
  );
};
