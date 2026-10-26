import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { MobileNav, MobileTopbar } from "./components/Navigation";
import { PlayerBar } from "./components/PlayerBar";
import { QueuePanel } from "./components/QueuePanel";
import { AddToPlaylistModal } from "./components/AddToPlaylistModal";
import { PlaylistDialog } from "./components/PlaylistDialog";
import { Toasts } from "./components/Toasts";
import { HomePage } from "./pages/HomePage";
import { SearchPage } from "./pages/SearchPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LikedPage } from "./pages/LikedPage";
import { PlaylistPage } from "./pages/PlaylistPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { initPlayer } from "./store/player";
import { initMusicApi } from "./api/music";

function Shell() {
  const location = useLocation();

  useEffect(() => {
    document.getElementById("main")?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-wrap">
        <MobileTopbar />
        <main className="main" id="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/liked" element={<LikedPage />} />
            <Route path="/playlist/:id" element={<PlaylistPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
      <PlayerBar />
      <MobileNav />
      <QueuePanel />
      <AddToPlaylistModal />
      <PlaylistDialog />
      <Toasts />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initPlayer();
    // Warm up the local yt-dlp / spotdl service in the background.
    void initMusicApi();
  }, []);

  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
