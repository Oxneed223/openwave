import { Link } from "react-router-dom";
import { Clock3, Library, ListMusic, Plus, Search } from "lucide-react";
import { useLibrary } from "../store/library";
import { useUi } from "../store/ui";
import { usePlayer } from "../store/player";
import { EmptyState, SectionHeader } from "../components/Common";
import { LikedCard, PlaylistCard } from "../components/CollectionCard";
import { TrackList } from "../components/TrackList";
import { tracksLabel } from "../lib/format";

export function LibraryPage() {
  const liked = useLibrary((state) => state.liked);
  const playlists = useLibrary((state) => state.playlists);
  const recent = useLibrary((state) => state.recent);
  const clearRecent = useLibrary((state) => state.clearRecent);
  const openCreatePlaylist = useUi((state) => state.openCreatePlaylist);
  const playTracks = usePlayer((state) => state.playTracks);

  const isEmpty = liked.length === 0 && playlists.length === 0 && recent.length === 0;

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Только ваше</span>
        <h1>Коллекция</h1>
        <p>
          {tracksLabel(liked.length)} в любимых · {playlists.length} плейлистов · всё хранится
          локально на этом устройстве.
        </p>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={Library}
          title="Здесь пока тихо"
          text="Найдите музыку в каталоге, добавляйте треки в любимые и собирайте собственные плейлисты."
          action={
            <div className="state-actions">
              <Link to="/search" className="btn primary">
                <Search size={16} />
                Найти музыку
              </Link>
              <button type="button" className="btn ghost" onClick={openCreatePlaylist}>
                <Plus size={16} />
                Создать плейлист
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="collection-grid">
            <LikedCard count={liked.length} />
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
            <button type="button" className="collection-card create-card" onClick={openCreatePlaylist}>
              <div className="create-art">
                <Plus size={30} />
              </div>
              <span className="collection-name">Новый плейлист</span>
              <span className="collection-caption">Собрать свою подборку</span>
            </button>
          </div>

          {recent.length > 0 && (
            <section className="section">
              <SectionHeader
                title="Недавно слушали"
                subtitle="История последних треков"
                action={
                  <button type="button" className="text-btn" onClick={clearRecent}>
                    Очистить
                  </button>
                }
              />
              <div className="recent-wrap">
                <TrackList tracks={recent.slice(0, 12)} />
              </div>
              {recent.length > 12 && (
                <button
                  type="button"
                  className="btn ghost more-button"
                  onClick={() => playTracks(recent, 12)}
                >
                  Слушать дальше
                </button>
              )}
            </section>
          )}

          {playlists.length === 0 && (
            <div className="library-hint">
              <ListMusic size={18} />
              <span>Плейлистов пока нет — начните с кнопки «Новый плейлист».</span>
            </div>
          )}

          <p className="page-footnote">
            <Clock3 size={13} /> Любимые треки, плейлисты и история не покидают это устройство.
            Приложение не отправляет их на сервер.
          </p>
        </>
      )}
    </div>
  );
}
