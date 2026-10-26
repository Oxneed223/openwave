import { useEffect, useRef, useState } from "react";
import { ListMusic, Plus, X } from "lucide-react";
import { useLibrary } from "../store/library";
import { useUi } from "../store/ui";
import { tracksLabel } from "../lib/format";
import { gradientFor } from "../lib/colors";

export function AddToPlaylistModal() {
  const track = useUi((state) => state.addToPlaylistTrack);
  const close = useUi((state) => state.closeAddToPlaylist);
  const toast = useUi((state) => state.toast);
  const playlists = useLibrary((state) => state.playlists);
  const addToPlaylist = useLibrary((state) => state.addToPlaylist);
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (track) setName("");
  }, [track]);

  useEffect(() => {
    if (!track) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [track, close]);

  if (!track) return null;

  const add = (playlistId: string, playlistName: string) => {
    const added = addToPlaylist(playlistId, track);
    if (added) toast(`Добавлено в «${playlistName}»`, "success");
    else toast("Этот трек уже есть в плейлисте", "info");
    close();
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = createPlaylist(trimmed);
    addToPlaylist(id, track);
    toast(`Создан плейлист «${trimmed}»`, "success");
    close();
  };

  return (
    <div className="modal-backdrop" onClick={close} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Добавить в плейлист"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2>Добавить в плейлист</h2>
            <p className="modal-sub">{track.title}</p>
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label="Закрыть">
            <X size={19} />
          </button>
        </header>

        <div className="playlist-picker">
          {playlists.map((playlist) => (
            <button
              type="button"
              className="picker-row"
              key={playlist.id}
              onClick={() => add(playlist.id, playlist.name)}
            >
              <span
                className="picker-art"
                style={{ background: gradientFor(playlist.id) }}
              >
                <ListMusic size={16} />
              </span>
              <span className="picker-text">
                <span className="picker-name">{playlist.name}</span>
                <span className="picker-meta">{tracksLabel(playlist.tracks.length)}</span>
              </span>
              <Plus size={17} />
            </button>
          ))}
          {playlists.length === 0 && (
            <p className="picker-empty">Плейлистов ещё нет. Создайте первый ниже.</p>
          )}
        </div>

        <form className="playlist-create" onSubmit={handleCreate}>
          <input
            ref={inputRef}
            className="text-input"
            placeholder="Название нового плейлиста"
            value={name}
            maxLength={80}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            aria-label="Название нового плейлиста"
          />
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            Создать
          </button>
        </form>
      </div>
    </div>
  );
}
