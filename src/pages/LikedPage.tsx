import { Link } from "react-router-dom";
import { Heart, Play, Search, Shuffle } from "lucide-react";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { CollectionHeader, EmptyState } from "../components/Common";
import { TrackList } from "../components/TrackList";
import { formatTotal, totalDuration, tracksLabel } from "../lib/format";
import { gradientFor } from "../lib/colors";

export function LikedPage() {
  const liked = useLibrary((state) => state.liked);
  const playTracks = usePlayer((state) => state.playTracks);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);

  const playAll = () => {
    if (liked.length) playTracks(liked, 0);
  };

  const playShuffled = () => {
    if (!liked.length) return;
    if (!usePlayer.getState().shuffle) toggleShuffle();
    const start = Math.floor(Math.random() * liked.length);
    playTracks(liked, start);
  };

  const total = totalDuration(liked);

  return (
    <div className="page">
      <CollectionHeader
        eyebrow="Плейлист"
        title="Любимые треки"
        art={
          <div className="header-art liked-art-large" style={{ background: gradientFor("liked-songs") }}>
            <Heart size={64} fill="currentColor" strokeWidth={1.2} />
          </div>
        }
        meta={
          <>
            <span>{tracksLabel(liked.length)}</span>
            {total > 0 && <span> · {formatTotal(total)}</span>}
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="play-fab"
              onClick={playAll}
              disabled={!liked.length}
              aria-label="Слушать любимые треки"
            >
              <Play size={22} fill="currentColor" />
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={playShuffled}
              disabled={!liked.length}
            >
              <Shuffle size={17} />
              Перемешать
            </button>
          </>
        }
      />

      {liked.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Любимых треков пока нет"
          text="Нажмите на сердечко рядом с треком — он появится здесь и останется на этом устройстве."
          action={
            <Link to="/search" className="btn primary">
              <Search size={16} />
              Найти музыку
            </Link>
          }
        />
      ) : (
        <div className="list-section">
          <TrackList tracks={liked} />
        </div>
      )}
    </div>
  );
}
