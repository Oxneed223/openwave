import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RepeatMode, Track } from "../types";
import { useLibrary } from "./library";
import { useUi } from "./ui";
import { clamp } from "../lib/format";
import { prefetchStream, resolveStreamUrl } from "../api/music";

const audio: HTMLAudioElement | null =
  typeof window !== "undefined" && typeof Audio !== "undefined" ? new Audio() : null;

if (audio) {
  audio.preload = "metadata";
}

let initialized = false;
let loadedKey: string | null = null;

function primaryArtist(value: string): string {
  return value.split(/,|&|\bfeat\b|\bft\b/i)[0].trim().toLowerCase();
}

/**
 * Warm up the next track and another track by the current artist before they
 * are requested. Resolution is the slow part of YouTube playback, so this
 * makes the following track start almost instantly.
 */
function prefetchAround(queue: Track[], index: number): void {
  const current = queue[index];
  if (!current) return;

  const artist = primaryArtist(current.artist);
  const candidates: Track[] = [];

  const sameArtist = queue
    .slice(index + 1)
    .concat(queue.slice(0, index))
    .find((track) => artist && primaryArtist(track.artist) === artist);
  if (sameArtist) candidates.push(sameArtist);

  const next = queue[index + 1];
  if (next) candidates.push(next);
  if (queue[index + 2]) candidates.push(queue[index + 2]);

  // A single-track queue opened from the collection can still preload another
  // song by the same artist from the listening history.
  if (!sameArtist && artist) {
    const library = useLibrary.getState();
    const historyMatch = [...library.recent, ...library.liked].find(
      (track) => track.id !== current.id && primaryArtist(track.artist) === artist
    );
    if (historyMatch) candidates.push(historyMatch);
  }

  const seen = new Set<string>();
  for (const track of candidates) {
    if (!track.streamUrl || seen.has(track.streamUrl)) continue;
    seen.add(track.streamUrl);
    prefetchStream(track.streamUrl);
    if (seen.size >= 2) break;
  }
}

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  buffering: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;

  playTracks: (tracks: Track[], startIndex?: number) => void;
  playTrack: (track: Track) => void;
  playQueueIndex: (index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => {
      const applyVolume = () => {
        if (!audio) return;
        const { volume, muted } = get();
        audio.volume = clamp(volume, 0, 1);
        audio.muted = muted;
      };

      const updateMediaSession = (track: Track) => {
        if (!("mediaSession" in navigator)) return;
        if (typeof MediaMetadata !== "undefined") {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: "OpenWave",
            artwork: track.artwork
              ? [{ src: track.artwork, sizes: "480x480", type: "image/jpeg" }]
              : []
          });
        }
      };

      const loadAt = (at: number, autoplay: boolean) => {
        const track = get().queue[at];
        if (!track || !audio) return;

        loadedKey = track.id;
        set({
          index: at,
          progress: 0,
          duration: track.duration || 0,
          isPlaying: autoplay,
          buffering: autoplay
        });

        audio.pause();
        audio.src = resolveStreamUrl(track.streamUrl);
        audio.load();
        applyVolume();
        useLibrary.getState().pushRecent(track);
        updateMediaSession(track);
        prefetchAround(get().queue, at);

        if (autoplay) {
          const promise = audio.play();
          if (promise) {
            promise.catch(() => {
              if (loadedKey === track.id) set({ isPlaying: false, buffering: false });
            });
          }
        }
      };

      return {
        queue: [],
        index: 0,
        isPlaying: false,
        buffering: false,
        progress: 0,
        duration: 0,
        volume: 1,
        muted: false,
        shuffle: false,
        repeat: "off",

        playTracks: (tracks, startIndex = 0) => {
          const playable = tracks.filter(Boolean);
          if (!playable.length) return;
          const at = clamp(startIndex, 0, playable.length - 1);
          set({ queue: playable, index: at });
          loadAt(at, true);
        },

        playTrack: (track) => {
          const current = get().queue[get().index];
          if (current && current.id === track.id && get().queue.length === 1) {
            get().toggle();
            return;
          }
          set({ queue: [track], index: 0 });
          loadAt(0, true);
        },

        playQueueIndex: (index) => {
          const state = get();
          if (index === state.index) {
            state.toggle();
            return;
          }
          loadAt(index, true);
        },

        toggle: () => {
          if (!audio) return;
          const { queue, index, isPlaying } = get();
          const track = queue[index];
          if (!track) return;

          if (isPlaying) {
            audio.pause();
            set({ isPlaying: false });
            return;
          }

          if (loadedKey !== track.id || audio.error) {
            loadAt(index, true);
            return;
          }

          if (
            audio.ended ||
            (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.25)
          ) {
            audio.currentTime = 0;
          }

          set({ buffering: true });
          const promise = audio.play();
          if (promise) {
            promise.catch(() => set({ isPlaying: false, buffering: false }));
          }
        },

        next: () => {
          const { queue, index, shuffle, repeat } = get();
          if (!queue.length) return;

          if (shuffle && queue.length > 1) {
            let candidate = index;
            while (candidate === index) {
              candidate = Math.floor(Math.random() * queue.length);
            }
            loadAt(candidate, true);
            return;
          }

          if (index + 1 < queue.length) {
            loadAt(index + 1, true);
            return;
          }

          if (repeat === "all") {
            loadAt(0, true);
            return;
          }

          audio?.pause();
          set({ isPlaying: false, buffering: false });
        },

        prev: () => {
          const { index } = get();
          if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            set({ progress: 0 });
            return;
          }
          if (index > 0) {
            loadAt(index - 1, true);
            return;
          }
          if (audio) {
            audio.currentTime = 0;
            set({ progress: 0 });
          }
        },

        seek: (seconds) => {
          const track = get().queue[get().index];
          if (!audio || !track) return;
          const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : track.duration;
          const value = clamp(seconds, 0, max || 0);
          audio.currentTime = value;
          set({ progress: value });
        },

        setVolume: (volume) => {
          const value = clamp(volume, 0, 1);
          if (audio) {
            audio.volume = value;
            audio.muted = value === 0;
          }
          set({ volume: value, muted: value === 0 });
        },

        toggleMute: () => {
          const muted = !get().muted;
          if (audio) audio.muted = muted;
          set({ muted });
        },

        toggleShuffle: () => set({ shuffle: !get().shuffle }),

        cycleRepeat: () =>
          set({
            repeat: get().repeat === "off" ? "all" : get().repeat === "all" ? "one" : "off"
          }),

        addToQueue: (track) => {
          if (!get().queue.length) {
            get().playTrack(track);
            return;
          }
          set({ queue: [...get().queue, track] });
          prefetchAround(get().queue, get().index);
          useUi.getState().toast("Добавлено в очередь", "success");
        },

        playNext: (track) => {
          if (!get().queue.length) {
            get().playTrack(track);
            return;
          }
          const { queue, index } = get();
          const nextQueue = [...queue];
          nextQueue.splice(index + 1, 0, track);
          set({ queue: nextQueue });
          prefetchAround(get().queue, get().index);
          useUi.getState().toast("Прозвучит следующим", "success");
        },

        removeFromQueue: (at) => {
          const state = get();
          const wasPlaying = state.isPlaying;
          const queue = [...state.queue];
          if (at < 0 || at >= queue.length) return;
          const removedCurrent = at === state.index;
          queue.splice(at, 1);

          if (!queue.length) {
            get().clearQueue();
            return;
          }

          if (at < state.index) {
            set({ queue, index: state.index - 1 });
            return;
          }

          if (removedCurrent) {
            const nextIndex = Math.min(at, queue.length - 1);
            set({ queue, index: nextIndex });
            loadAt(nextIndex, wasPlaying);
            return;
          }

          set({ queue });
        },

        clearQueue: () => {
          if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
          }
          loadedKey = null;
          set({
            queue: [],
            index: 0,
            isPlaying: false,
            buffering: false,
            progress: 0,
            duration: 0
          });
        }
      };
    },
    {
      name: "openwave.player.v1",
      version: 2,
      partialize: (state) => ({
        queue: state.queue,
        index: state.index,
        volume: state.volume,
        muted: state.muted,
        shuffle: state.shuffle,
        repeat: state.repeat
      }),
      // Radio was removed from OpenWave; drop old stations from the queue.
      migrate: (persisted) => {
        const state = persisted as {
          queue?: Track[];
          index?: number;
          volume?: number;
          muted?: boolean;
          shuffle?: boolean;
          repeat?: RepeatMode;
        };
        const queue = (state.queue ?? []).filter(
          (track) => !track.id.startsWith("radio:")
        );
        return {
          ...state,
          queue,
          index: Math.min(Math.max(state.index ?? 0, 0), Math.max(queue.length - 1, 0))
        };
      },
      onRehydrateStorage: () => (state) => {
        if (audio && state) {
          audio.volume = clamp(state.volume ?? 1, 0, 1);
          audio.muted = Boolean(state.muted);
        }
      }
    }
  )
);

export function initPlayer(): void {
  if (!audio || initialized) return;
  initialized = true;

  audio.addEventListener("timeupdate", () => {
    const state = usePlayer.getState();
    if (!state.queue.length) return;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    usePlayer.setState({
      progress: audio.currentTime || 0,
      duration: duration || state.queue[state.index]?.duration || 0
    });
  });

  audio.addEventListener("loadedmetadata", () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (duration) usePlayer.setState({ duration });
  });

  audio.addEventListener("play", () => usePlayer.setState({ isPlaying: true }));
  audio.addEventListener("playing", () =>
    usePlayer.setState({ isPlaying: true, buffering: false })
  );
  audio.addEventListener("waiting", () => usePlayer.setState({ buffering: true }));
  audio.addEventListener("canplay", () => usePlayer.setState({ buffering: false }));

  audio.addEventListener("ended", () => {
    const state = usePlayer.getState();
    const track = state.queue[state.index];
    if (!track) return;

    if (state.repeat === "one") {
      audio.currentTime = 0;
      const promise = audio.play();
      if (promise) promise.catch(() => usePlayer.setState({ isPlaying: false }));
      return;
    }

    const hasNext =
      state.index < state.queue.length - 1 || state.repeat === "all" || state.shuffle;
    if (hasNext && state.queue.length > 1) {
      state.next();
      return;
    }

    usePlayer.setState({
      isPlaying: false,
      buffering: false,
      progress: track.duration || 0
    });
  });

  audio.addEventListener("error", () => {
    const state = usePlayer.getState();
    const track = state.queue[state.index];
    if (!track || !audio.currentSrc) return;
    usePlayer.setState({ isPlaying: false, buffering: false });
    useUi.getState().toast("Не удалось воспроизвести трек.", "error");
  });

  audio.volume = clamp(usePlayer.getState().volume, 0, 1);
  audio.muted = usePlayer.getState().muted;

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => usePlayer.getState().toggle());
      navigator.mediaSession.setActionHandler("pause", () => {
        if (usePlayer.getState().isPlaying) usePlayer.getState().toggle();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () =>
        usePlayer.getState().prev()
      );
      navigator.mediaSession.setActionHandler("nexttrack", () => usePlayer.getState().next());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) usePlayer.getState().seek(details.seekTime);
      });
    } catch {
      // Some webviews do not support all media session actions.
    }
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    ) {
      return;
    }

    const state = usePlayer.getState();

    if (event.code === "Space" && !target?.closest("button, a")) {
      event.preventDefault();
      state.toggle();
    } else if (event.code === "ArrowRight" && event.shiftKey) {
      event.preventDefault();
      state.next();
    } else if (event.code === "ArrowLeft" && event.shiftKey) {
      event.preventDefault();
      state.prev();
    } else if (event.code === "KeyM") {
      state.toggleMute();
    }
  });
}
