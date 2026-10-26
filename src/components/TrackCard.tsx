import { useState } from "react";
import { Music2, Pause, Play, Plus } from "lucide-react";
import type { Track } from "../types";
import { usePlayer } from "../store/player";
import { useUi } from "../store/ui";
import { cn } from "../lib/format";
import { gradientFor } from "../lib/colors";

interface TrackCardProps {
  track: Track;
  onPlay: () => void;
}

export function TrackCard({ track, onPlay }: TrackCardProps) {
  const [broken, setBroken] = useState(false);
  const currentId = usePlayer((state) => state.queue[state.index]?.id);
  const playing = usePlayer((state) => state.isPlaying);
  const toggle = usePlayer((state) => state.toggle);
  const openAddToPlaylist = useUi((state) => state.openAddToPlaylist);
  const isCurrent = currentId === track.id;

  const handlePlay = () => {
    if (isCurrent) toggle();
    else onPlay();
  };

  return (
    <article className={cn("track-card", isCurrent && "is-current")}>
      <div className="card-art">
        {track.artwork && !broken ? (
          <img
            src={track.artwork}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="art-placeholder" style={{ background: gradientFor(track.id) }}>
            <Music2 size={30} strokeWidth={1.5} />
          </div>
        )}
        <button
          type="button"
          className="card-play"
          onClick={handlePlay}
          aria-label={isCurrent && playing ? `Пауза ${track.title}` : `Слушать ${track.title}`}
        >
          {isCurrent && playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          className="card-add"
          onClick={() => openAddToPlaylist(track)}
          aria-label="Добавить в плейлист"
          title="Добавить в плейлист"
        >
          <Plus size={16} />
        </button>
      </div>
      <button type="button" className="card-text" onClick={handlePlay}>
        <span className="card-title">{track.title}</span>
        <span className="card-sub">{track.artist}</span>
      </button>
    </article>
  );
}
