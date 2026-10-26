import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Playlist, Track } from "../types";
import { uid } from "../lib/id";

interface LibraryState {
  liked: Track[];
  playlists: Playlist[];
  recent: Track[];
  searches: string[];

  toggleLike: (track: Track) => void;
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => boolean;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;

  pushRecent: (track: Track) => void;
  clearRecent: () => void;
  addSearch: (query: string) => void;
  clearSearches: () => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      liked: [],
      playlists: [],
      recent: [],
      searches: [],

      toggleLike: (track) => {
        const { liked } = get();
        const exists = liked.some((item) => item.id === track.id);
        set({ liked: exists ? liked.filter((item) => item.id !== track.id) : [track, ...liked] });
      },

      createPlaylist: (name) => {
        const id = uid("pl");
        const playlist: Playlist = {
          id,
          name: name.trim() || "Новый плейлист",
          createdAt: Date.now(),
          tracks: []
        };
        set({ playlists: [playlist, ...get().playlists] });
        return id;
      },

      renamePlaylist: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set({
          playlists: get().playlists.map((playlist) =>
            playlist.id === id ? { ...playlist, name: trimmed } : playlist
          )
        });
      },

      deletePlaylist: (id) => {
        set({ playlists: get().playlists.filter((playlist) => playlist.id !== id) });
      },

      addToPlaylist: (playlistId, track) => {
        const playlist = get().playlists.find((item) => item.id === playlistId);
        if (!playlist) return false;
        if (playlist.tracks.some((item) => item.id === track.id)) return false;
        set({
          playlists: get().playlists.map((item) =>
            item.id === playlistId ? { ...item, tracks: [...item.tracks, track] } : item
          )
        });
        return true;
      },

      removeFromPlaylist: (playlistId, trackId) => {
        set({
          playlists: get().playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, tracks: playlist.tracks.filter((track) => track.id !== trackId) }
              : playlist
          )
        });
      },

      pushRecent: (track) => {
        const recent = get().recent.filter((item) => item.id !== track.id);
        set({ recent: [track, ...recent].slice(0, 50) });
      },

      clearRecent: () => set({ recent: [] }),

      addSearch: (query) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        const searches = get().searches.filter(
          (item) => item.toLowerCase() !== trimmed.toLowerCase()
        );
        set({ searches: [trimmed, ...searches].slice(0, 8) });
      },

      clearSearches: () => set({ searches: [] })
    }),
    {
      name: "openwave.library.v1",
      version: 2,
      partialize: (state) => ({
        liked: state.liked,
        playlists: state.playlists,
        recent: state.recent,
        searches: state.searches
      }),
      // Radio was removed from OpenWave; drop old stations from saved data.
      migrate: (persisted) => {
        const state = persisted as {
          liked?: Track[];
          recent?: Track[];
          playlists?: Playlist[];
          searches?: string[];
        };
        const keepTracks = (tracks?: Track[]) =>
          (tracks ?? []).filter((track) => !track.id.startsWith("radio:"));
        return {
          ...state,
          liked: keepTracks(state.liked),
          recent: keepTracks(state.recent),
          playlists: (state.playlists ?? []).map((playlist) => ({
            ...playlist,
            tracks: keepTracks(playlist.tracks)
          }))
        };
      }
    }
  )
);
