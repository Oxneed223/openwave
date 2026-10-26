import { NavLink, Link } from "react-router-dom";
import { AudioLines, Heart, Home, Library, Plus, Search } from "lucide-react";
import { useLibrary } from "../store/library";
import { useUi } from "../store/ui";
import { cn } from "../lib/format";
import { gradientFor } from "../lib/colors";

const NAV_ITEMS = [
  { to: "/", label: "Главная", icon: Home, end: true },
  { to: "/search", label: "Поиск", icon: Search, end: false },
  { to: "/library", label: "Коллекция", icon: Library, end: false }
];

export function Sidebar() {
  const playlists = useLibrary((state) => state.playlists);
  const openCreatePlaylist = useUi((state) => state.openCreatePlaylist);
  const sidebarOpen = useUi((state) => state.sidebarOpen);
  const setSidebarOpen = useUi((state) => state.setSidebarOpen);

  const close = () => setSidebarOpen(false);

  return (
    <>
      <aside className={cn("sidebar", sidebarOpen && "is-open")}>
        <Link to="/" className="brand" onClick={close} aria-label="OpenWave — на главную">
          <span className="brand-mark">
            <AudioLines size={20} strokeWidth={2.4} />
          </span>
          <span className="brand-name">OpenWave</span>
        </Link>

        <nav className="nav" aria-label="Основная навигация">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn("nav-link", isActive && "active")}
              onClick={close}
            >
              <item.icon size={20} strokeWidth={1.9} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span>Плейлисты</span>
            <button
              type="button"
              className="icon-btn small"
              onClick={openCreatePlaylist}
              aria-label="Создать плейлист"
              title="Создать плейлист"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="playlist-nav">
            <NavLink
              to="/liked"
              className={({ isActive }) => cn("playlist-link", isActive && "active")}
              onClick={close}
            >
              <span className="playlist-dot liked">
                <Heart size={11} fill="currentColor" />
              </span>
              <span className="ellipsis">Любимые треки</span>
            </NavLink>

            {playlists.map((playlist) => (
              <NavLink
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className={({ isActive }) => cn("playlist-link", isActive && "active")}
                onClick={close}
                title={playlist.name}
              >
                <span
                  className="playlist-dot"
                  style={{ background: gradientFor(playlist.id) }}
                />
                <span className="ellipsis">{playlist.name}</span>
              </NavLink>
            ))}

            {playlists.length === 0 && (
              <p className="sidebar-hint">
                Создайте первый плейлист — он сохранится на этом устройстве.
              </p>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-note">
            <span className="live-dot" />
            Музыка без рекламы
          </div>
          <div className="sidebar-sub">Spotify · YouTube · Audius</div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={close}
        />
      )}
    </>
  );
}
