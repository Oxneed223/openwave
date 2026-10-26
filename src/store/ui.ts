import { create } from "zustand";
import type { Track, ToastMessage } from "../types";

type PlaylistDialog =
  | { mode: "create" }
  | { mode: "rename"; id: string; name: string }
  | null;

interface UiState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  toggleQueue: () => void;

  addToPlaylistTrack: Track | null;
  openAddToPlaylist: (track: Track) => void;
  closeAddToPlaylist: () => void;

  playlistDialog: PlaylistDialog;
  openCreatePlaylist: () => void;
  openRenamePlaylist: (id: string, name: string) => void;
  closePlaylistDialog: () => void;

  toasts: ToastMessage[];
  toast: (message: string, tone?: ToastMessage["tone"]) => void;
  dismissToast: (id: number) => void;
}

let toastCounter = 0;

export const useUi = create<UiState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  queueOpen: false,
  setQueueOpen: (open) => set({ queueOpen: open }),
  toggleQueue: () => set((state) => ({ queueOpen: !state.queueOpen })),

  addToPlaylistTrack: null,
  openAddToPlaylist: (track) => set({ addToPlaylistTrack: track }),
  closeAddToPlaylist: () => set({ addToPlaylistTrack: null }),

  playlistDialog: null,
  openCreatePlaylist: () => set({ playlistDialog: { mode: "create" } }),
  openRenamePlaylist: (id, name) => set({ playlistDialog: { mode: "rename", id, name } }),
  closePlaylistDialog: () => set({ playlistDialog: null }),

  toasts: [],
  toast: (message, tone = "info") => {
    const id = ++toastCounter;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }].slice(-4) }));
    window.setTimeout(() => get().dismissToast(id), 3800);
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));
