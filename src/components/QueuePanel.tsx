import { ListMusic, Music2, Trash2, X } from "lucide-react";
import { usePlayer } from "../store/player";
import { useUi } from "../store/ui";
import { cn, formatTime } from "../lib/format";

export function QueuePanel() {
  const open = useUi((state) => state.queueOpen);
  const setQueueOpen = useUi((state) => state.setQueueOpen);
  const queue = usePlayer((state) => state.queue);
  const index = usePlayer((state) => state.index);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const playQueueIndex = usePlayer((state) => state.playQueueIndex);
  const removeFromQueue = usePlayer((state) => state.removeFromQueue);
  const clearQueue = usePlayer((state) => state.clearQueue);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Закрыть очередь"
        onClick={() => setQueueOpen(false)}
      />
      <aside className="queue-panel" aria-label="Очередь воспроизведения">
        <header className="queue-header">
          <div>
            <h2>Очередь</h2>
            <span>{queue.length ? `${queue.length} в списке` : "Пока пусто"}</span>
          </div>
          <div className="queue-header-actions">
            {queue.length > 0 && (
              <button
                type="button"
                className="icon-btn small"
                onClick={clearQueue}
                aria-label="Очистить очередь"
                title="Очистить очередь"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn small"
              onClick={() => setQueueOpen(false)}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {queue.length === 0 ? (
          <div className="queue-empty">
            <span className="state-icon">
              <ListMusic size={24} />
            </span>
            <p>Включите трек — очередь появится здесь.</p>
          </div>
        ) : (
          <div className="queue-list">
            {queue.map((track, position) => {
              const active = position === index;
              return (
                <div className={cn("queue-item", active && "active")} key={`${track.id}-${position}`}>
                  <button
                    type="button"
                    className="queue-item-main"
                    onClick={() => playQueueIndex(position)}
                  >
                    <span className="queue-art">
                      {track.artwork ? (
                        <img src={track.artwork} alt="" loading="lazy" />
                      ) : (
                        <Music2 size={16} />
                      )}
                    </span>
                    <span className="queue-text">
                      <span className="queue-title">
                        {active && isPlaying && <span className="mini-eq"><i /><i /><i /></span>}
                        {track.title}
                      </span>
                      <span className="queue-artist">{track.artist}</span>
                    </span>
                  </button>
                  <span className="queue-duration">
                    {formatTime(track.duration)}
                  </span>
                  <button
                    type="button"
                    className="icon-btn small queue-remove"
                    onClick={() => removeFromQueue(position)}
                    aria-label={`Убрать ${track.title} из очереди`}
                    title="Убрать из очереди"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
