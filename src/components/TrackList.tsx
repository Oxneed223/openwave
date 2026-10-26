import type { Track } from "../types";
import { usePlayer } from "../store/player";
import { TrackRow } from "./TrackRow";

interface TrackListProps {
  tracks: Track[];
  onRemove?: (track: Track) => void;
}

export function TrackList({ tracks, onRemove }: TrackListProps) {
  const playTracks = usePlayer((state) => state.playTracks);

  return (
    <div className="track-list">
      {tracks.length > 0 && (
        <div className="list-head" aria-hidden="true">
          <span>#</span>
          <span>Трек</span>
          <span>Альбом / жанр</span>
          <span />
          <span className="list-head-time">Время</span>
        </div>
      )}
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          track={track}
          index={index}
          onPlay={() => playTracks(tracks, index)}
          onRemove={onRemove ? () => onRemove(track) : undefined}
        />
      ))}
    </div>
  );
}
