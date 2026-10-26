import { Link } from "react-router-dom";
import type { Playlist } from "../types";
import { Mosaic } from "./Common";
import { tracksLabel } from "../lib/format";
import { gradientFor } from "../lib/colors";
import { ListMusic } from "lucide-react";

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link to={`/playlist/${playlist.id}`} className="collection-card">
      <Mosaic
        tracks={playlist.tracks}
        seed={playlist.id}
        icon={<ListMusic size={34} strokeWidth={1.4} />}
      />
      <span className="collection-name">{playlist.name}</span>
      <span className="collection-caption">{tracksLabel(playlist.tracks.length)}</span>
    </Link>
  );
}

export function LikedCard({ count }: { count: number }) {
  return (
    <Link to="/liked" className="collection-card">
      <div className="liked-art" style={{ background: gradientFor("liked-songs") }}>
        <span className="liked-glyph">♥</span>
      </div>
      <span className="collection-name">Любимые треки</span>
      <span className="collection-caption">{tracksLabel(count)}</span>
    </Link>
  );
}
