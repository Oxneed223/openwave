import type { CSSProperties } from "react";
import {
  Heart,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX
} from "lucide-react";
import { usePlayer } from "../store/player";
import { useLibrary } from "../store/library";
import { useUi } from "../store/ui";
import { cn, formatTime } from "../lib/format";

export function PlayerBar() {
  const current = usePlayer((state) => state.queue[state.index] ?? null);
  const queueLength = usePlayer((state) => state.queue.length);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const buffering = usePlayer((state) => state.buffering);
  const progress = usePlayer((state) => state.progress);
  const duration = usePlayer((state) => state.duration);
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const shuffle = usePlayer((state) => state.shuffle);
  const repeat = usePlayer((state) => state.repeat);

  const toggle = usePlayer((state) => state.toggle);
  const next = usePlayer((state) => state.next);
  const prev = usePlayer((state) => state.prev);
  const seek = usePlayer((state) => state.seek);
  const setVolume = usePlayer((state) => state.setVolume);
  const toggleMute = usePlayer((state) => state.toggleMute);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const cycleRepeat = usePlayer((state) => state.cycleRepeat);

  const queueOpen = useUi((state) => state.queueOpen);
  const toggleQueue = useUi((state) => state.toggleQueue);
  const liked = useLibrary((state) => state.liked);
  const toggleLike = useLibrary((state) => state.toggleLike);

  const total = duration || current?.duration || 0;
  const shownProgress = Math.min(progress, total || progress);
  const percent = total > 0 ? Math.min(100, (shownProgress / total) * 100) : 0;
  const isLiked = current ? liked.some((track) => track.id === current.id) : false;

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <footer className="player">
      {current && (
        <div className="mobile-progress">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}

      <div className="player-left">
        <div className="player-art">
          {current?.artwork ? (
            <img src={current.artwork} alt="" />
          ) : (
            <Music2 size={20} strokeWidth={1.6} />
          )}
        </div>
        <div className="player-meta">
          <span className="player-title">{current?.title ?? "Ничего не играет"}</span>
          <span className="player-artist">
            {current ? current.artist : "Выберите трек"}
          </span>
        </div>
        {current && (
          <button
            type="button"
            className={cn("icon-btn player-like", isLiked && "liked")}
            onClick={() => toggleLike(current)}
            aria-label={isLiked ? "Убрать из любимых" : "Добавить в любимые"}
            title={isLiked ? "Убрать из любимых" : "В любимые"}
          >
            <Heart size={17} fill={isLiked ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            type="button"
            className={cn("icon-btn control", shuffle && "active")}
            onClick={toggleShuffle}
            aria-label="Перемешать"
            aria-pressed={shuffle}
            title="Перемешать"
          >
            <Shuffle size={17} />
          </button>
          <button
            type="button"
            className="icon-btn control"
            onClick={prev}
            disabled={!current}
            aria-label="Предыдущий трек"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button
            type="button"
            className="play-toggle"
            onClick={toggle}
            disabled={!current}
            aria-label={isPlaying ? "Пауза" : "Играть"}
          >
            {buffering && isPlaying ? (
              <span className="player-spinner" />
            ) : isPlaying ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className="icon-btn control"
            onClick={next}
            disabled={!current}
            aria-label="Следующий трек"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button
            type="button"
            className={cn("icon-btn control", repeat !== "off" && "active")}
            onClick={cycleRepeat}
            aria-label={
              repeat === "one" ? "Повтор одного трека" : repeat === "all" ? "Повтор очереди" : "Повтор выключен"
            }
            title={
              repeat === "one" ? "Повтор одного трека" : repeat === "all" ? "Повтор очереди" : "Повтор выключен"
            }
          >
            {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={17} />}
          </button>
        </div>

        <div className="player-timeline">
          <span className="time">{formatTime(shownProgress)}</span>
          <input
            type="range"
            className="range player-range"
            min={0}
            max={Math.max(total, 1)}
            step={0.5}
            value={Math.min(shownProgress, total || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            disabled={!current || total <= 0}
            aria-label="Позиция трека"
            style={{ "--p": `${percent}%` } as CSSProperties}
          />
          <span className="time">{formatTime(total)}</span>
        </div>
      </div>

      <div className="player-right">
        <button
          type="button"
          className={cn("icon-btn control queue-button", queueOpen && "active")}
          onClick={toggleQueue}
          aria-label="Очередь воспроизведения"
          aria-pressed={queueOpen}
          title="Очередь"
        >
          <ListMusic size={18} />
          {queueLength > 0 && <span className="queue-count">{queueLength}</span>}
        </button>
        <button
          type="button"
          className="icon-btn control"
          onClick={toggleMute}
          aria-label={muted ? "Включить звук" : "Выключить звук"}
          title={muted ? "Включить звук" : "Выключить звук"}
        >
          <VolumeIcon size={18} />
        </button>
        <input
          type="range"
          className="range volume-range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Громкость"
          style={{ "--p": `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
        />
      </div>
    </footer>
  );
}
