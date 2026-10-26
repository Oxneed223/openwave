import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ListMusic, Pencil, Play, Search, Shuffle, Trash2 } from "lucide-react";
import { useLibrary } from "../store/library";
import { usePlayer } from "../store/player";
import { useUi } from "../store/ui";
import { CollectionHeader, EmptyState, Mosaic } from "../components/Common";
import { TrackList } from "../components/TrackList";
import { cn, formatTotal, totalDuration, tracksLabel } from "../lib/format";

export function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const playlist = useLibrary((state) =>
    state.playlists.find((item) => item.id === id)
  );
  const deletePlaylist = useLibrary((state) => state.deletePlaylist);
  const removeFromPlaylist = useLibrary((state) => state.removeFromPlaylist);
  const openRenamePlaylist = useUi((state) => state.openRenamePlaylist);
  const toast = useUi((state) => state.toast);
  const playTracks = usePlayer((state) => state.playTracks);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [id]);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = window.setTimeout(() => setConfirmDelete(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmDelete]);

  if (!playlist) {
    return (
      <div className="page">
        <EmptyState
          icon={ListMusic}
          title="Плейлист не найден"
          text="Возможно, он был удалён. Загляните в коллекцию или создайте новый."
          action={
            <Link to="/library" className="btn primary">
              <ListMusic size={16} />
              В коллекцию
            </Link>
          }
        />
      </div>
    );
  }

  const tracks = playlist.tracks;
  const total = totalDuration(tracks);

  const playAll = () => {
    if (tracks.length) playTracks(tracks, 0);
  };

  const playShuffled = () => {
    if (!tracks.length) return;
    if (!usePlayer.getState().shuffle) toggleShuffle();
    playTracks(tracks, Math.floor(Math.random() * tracks.length));
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deletePlaylist(playlist.id);
    toast(`Плейлист «${playlist.name}» удалён`, "success");
    navigate("/library");
  };

  return (
    <div className="page">
      <CollectionHeader
        eyebrow="Плейлист"
        title={playlist.name}
        art={
          <Mosaic
            tracks={tracks}
            seed={playlist.id}
            icon={<ListMusic size={52} strokeWidth={1.3} />}
            className="header-art"
          />
        }
        meta={
          <>
            <span>{tracksLabel(tracks.length)}</span>
            {total > 0 && <span> · {formatTotal(total)}</span>}
            <span> · сохранён локально</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="play-fab"
              onClick={playAll}
              disabled={!tracks.length}
              aria-label="Слушать плейлист"
            >
              <Play size={22} fill="currentColor" />
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={playShuffled}
              disabled={!tracks.length}
            >
              <Shuffle size={17} />
              Перемешать
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => openRenamePlaylist(playlist.id, playlist.name)}
            >
              <Pencil size={16} />
              Переименовать
            </button>
            <button
              type="button"
              className={cn("btn", confirmDelete ? "danger" : "ghost")}
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              {confirmDelete ? "Удалить?" : "Удалить"}
            </button>
          </>
        }
      />

      {tracks.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="В плейлисте пока пусто"
          text="Найдите трек в поиске и нажмите «+» на карточке, чтобы добавить его сюда."
          action={
            <Link to="/search" className="btn primary">
              <Search size={16} />
              Найти треки
            </Link>
          }
        />
      ) : (
        <div className="list-section">
          <TrackList
            tracks={tracks}
            onRemove={(track) => {
              removeFromPlaylist(playlist.id, track.id);
              toast(`«${track.title}» убран из плейлиста`, "info");
            }}
          />
        </div>
      )}

      <p className="page-footnote">
        Плейлист хранится в браузере или приложении на этом устройстве. Его можно переименовать
        или удалить в любой момент.
      </p>
    </div>
  );
}
