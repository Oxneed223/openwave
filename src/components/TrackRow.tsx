import { useEffect, useRef, useState } from "react";
import { Heart, ListMusic, ListPlus, MoreHorizontal, Music2, Pause, Play, Plus, X } from "lucide-react";
import type { Track } from "../types";
import { usePlayer } from "../store/player";
import { useLibrary } from "../store/library";
import { useUi } from "../store/ui";
import { cn, formatTime } from "../lib/format";
import { gradientFor } from "../lib/colors";
import { prefetchStream } from "../api/music";

interface TrackRowProps {
  track: Track;
  index: number;
  onPlay: () => void;
  onRemove?: () => void;
}

const SOURCE_LABELS: Partial<Record<Track["source"], string>> = {
  spotify: "Spotify",
  youtube: "YouTube",
  audius: "Audius"
};

export function TrackRow({ track, index, onPlay, onRemove }: TrackRowProps) {
  const [broken, setBroken] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const prefetchTimer = useRef<number | null>(null);
  const currentId = usePlayer((state) => state.queue[state.index]?.id);
  const playing = usePlayer((state) => state.isPlaying);
  const toggle = usePlayer((state) => state.toggle);
  const playNext = usePlayer((state) => state.playNext);
  const addToQueue = usePlayer((state) => state.addToQueue);
  const liked = useLibrary((state) => state.liked);
  const toggleLike = useLibrary((state) => state.toggleLike);
  const openAddToPlaylist = useUi((state) => state.openAddToPlaylist);

  const isCurrent = currentId === track.id;
  const isLiked = liked.some((item) => item.id === track.id);

  useEffect(
    () => () => {
      if (prefetchTimer.current) window.clearTimeout(prefetchTimer.current);
    },
    []
  );

  const schedulePrefetch = () => {
    if (prefetchTimer.current) window.clearTimeout(prefetchTimer.current);
    prefetchTimer.current = window.setTimeout(() => {
      prefetchTimer.current = null;
      prefetchStream(track.streamUrl);
    }, 180);
  };

  const cancelPrefetch = () => {
    if (prefetchTimer.current) {
      window.clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const trigger = () => {
    if (isCurrent) toggle();
    else onPlay();
  };

  return (
    <div
      className={cn("track-row", isCurrent && "is-current")}
      onMouseEnter={schedulePrefetch}
      onMouseLeave={cancelPrefetch}
      onFocus={schedulePrefetch}
      onBlur={cancelPrefetch}
      onPointerDown={() => prefetchStream(track.streamUrl)}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        onPlay();
      }}
    >
      <div className="row-leading">
        {isCurrent && playing ? (
          <span className="eq" aria-label="Играет">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="row-index">{index + 1}</span>
        )}
        <button
          type="button"
          className="row-play"
          onClick={trigger}
          aria-label={isCurrent && playing ? `Пауза ${track.title}` : `Слушать ${track.title}`}
        >
          {isCurrent && playing ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
        </button>
      </div>

      <div className="row-main">
        <div className="row-art">
          {track.artwork && !broken ? (
            <img src={track.artwork} alt="" loading="lazy" onError={() => setBroken(true)} />
          ) : (
            <div className="art-placeholder" style={{ background: gradientFor(track.id) }}>
              <Music2 size={17} strokeWidth={1.6} />
            </div>
          )}
        </div>
        <div className="row-text">
          <span className="row-title">{track.title}</span>
          <span className="row-artist">
            <span className="row-artist-name">{track.artist}</span>
            {SOURCE_LABELS[track.source] && (
              <span className={cn("source-pill", track.source)}>{SOURCE_LABELS[track.source]}</span>
            )}
          </span>
        </div>
      </div>

      <span className="row-genre" title={track.album || track.genre}>
        {track.album || track.genre || ""}
      </span>

      <div className="row-actions">
        <button
          type="button"
          className={cn("row-action action-like", isLiked && "liked")}
          onClick={() => toggleLike(track)}
          aria-label={isLiked ? "Убрать из любимых" : "Добавить в любимые"}
          title={isLiked ? "Убрать из любимых" : "В любимые"}
        >
          <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
        </button>

        <div className="track-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className={cn("row-action action-menu", menuOpen && "is-open")}
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Действия с треком"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Ещё"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="track-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="track-menu-item"
                onClick={() => {
                  playNext(track);
                  setMenuOpen(false);
                }}
              >
                <ListPlus size={16} />
                Играть следующим
              </button>
              <button
                type="button"
                role="menuitem"
                className="track-menu-item"
                onClick={() => {
                  addToQueue(track);
                  setMenuOpen(false);
                }}
              >
                <ListMusic size={16} />
                Добавить в очередь
              </button>
              <button
                type="button"
                role="menuitem"
                className="track-menu-item"
                onClick={() => {
                  openAddToPlaylist(track);
                  setMenuOpen(false);
                }}
              >
                <Plus size={16} />
                Добавить в плейлист
              </button>
              <button
                type="button"
                role="menuitem"
                className="track-menu-item"
                onClick={() => {
                  toggleLike(track);
                  setMenuOpen(false);
                }}
              >
                <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
                {isLiked ? "Убрать из любимых" : "В любимые"}
              </button>
              {onRemove && (
                <button
                  type="button"
                  role="menuitem"
                  className="track-menu-item danger"
                  onClick={() => {
                    onRemove();
                    setMenuOpen(false);
                  }}
                >
                  <X size={16} />
                  Убрать из плейлиста
                </button>
              )}
            </div>
          )}
        </div>

        {onRemove && (
          <button
            type="button"
            className="row-action action-remove danger"
            onClick={onRemove}
            aria-label="Убрать из плейлиста"
            title="Убрать из плейлиста"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <span className="row-duration">{formatTime(track.duration)}</span>
    </div>
  );
}
