import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLibrary } from "../store/library";
import { useUi } from "../store/ui";

export function PlaylistDialog() {
  const dialog = useUi((state) => state.playlistDialog);
  const close = useUi((state) => state.closePlaylistDialog);
  const toast = useUi((state) => state.toast);
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const renamePlaylist = useLibrary((state) => state.renamePlaylist);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dialog) return;
    setName(dialog.mode === "rename" ? dialog.name : "");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  if (!dialog) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (dialog.mode === "create") {
      const id = createPlaylist(trimmed);
      close();
      toast(`Плейлист «${trimmed}» создан`, "success");
      navigate(`/playlist/${id}`);
    } else {
      renamePlaylist(dialog.id, trimmed);
      close();
      toast("Название обновлено", "success");
    }
  };

  return (
    <div className="modal-backdrop" onClick={close} role="presentation">
      <div
        className="modal modal-small"
        role="dialog"
        aria-modal="true"
        aria-label={dialog.mode === "create" ? "Новый плейлист" : "Переименовать плейлист"}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{dialog.mode === "create" ? "Новый плейлист" : "Переименовать"}</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Закрыть">
            <X size={19} />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="dialog-form">
          <input
            ref={inputRef}
            className="text-input"
            value={name}
            maxLength={80}
            placeholder="Название плейлиста"
            onChange={(event) => setName(event.target.value)}
            aria-label="Название плейлиста"
          />
          <div className="dialog-actions">
            <button type="button" className="btn ghost" onClick={close}>
              Отмена
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>
              {dialog.mode === "create" ? "Создать" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
