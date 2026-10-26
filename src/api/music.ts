import type { Track } from "../types";

/**
 * OpenWave music service.
 *
 * The service is a small local Node process (server.mjs) that talks to
 * yt-dlp (YouTube search + audio) and spotdl (Spotify catalog search).
 * In web builds it is served from the same origin; in the desktop build the
 * Tauri shell starts it on a fixed localhost port.
 */

const REMOTE_BASE = "http://127.0.0.1:47821";

export interface MusicToolStatus {
  available: boolean;
  version?: string | null;
  ready?: boolean;
  error?: string | null;
}

export interface MusicHealth {
  ok: boolean;
  port?: number;
  base?: string;
  tools: {
    ytdlp: MusicToolStatus;
    spotdl: MusicToolStatus;
  };
}

export interface MusicSourceStatus {
  ok: boolean;
  count: number;
  error?: string;
}

export interface MusicSearchResult {
  tracks: Track[];
  sources: {
    spotify?: MusicSourceStatus;
    youtube?: MusicSourceStatus;
  };
  api: boolean;
  error?: string;
}

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

let apiBase = isTauri() ? REMOTE_BASE : "";
let health: MusicHealth | null = null;
let initPromise: Promise<MusicHealth | null> | null = null;
let failedUntil = 0;

function delay(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

async function probe(base: string): Promise<MusicHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${base}/api/music/health`, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as MusicHealth;
    if (!data?.ok) return null;
    return { ...data, base };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detects the local music service once. Returns null when it is not running
 * (for example a static web build without Node or Python installed).
 */
export function initMusicApi(): Promise<MusicHealth | null> {
  if (initPromise) return initPromise;

  // Do not re-probe on every keystroke when the service is not installed.
  if (failedUntil > Date.now()) return Promise.resolve(null);

  initPromise = (async () => {
    const local = await probe("");
    if (local) {
      apiBase = "";
      health = local;
      return local;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const remote = await probe(REMOTE_BASE);
      if (remote) {
        apiBase = REMOTE_BASE;
        health = remote;
        return remote;
      }
      await delay(attempt === 4 ? 0 : 500);
    }

    initPromise = null;
    failedUntil = Date.now() + 15_000;
    return null;
  })();

  return initPromise;
}

export function getMusicHealth(): MusicHealth | null {
  return health;
}

export function musicApiAvailable(): boolean {
  return health !== null;
}

/**
 * Converts a stored stream URL into something the audio element can load.
 * Absolute Audius URLs are returned untouched; local service paths get
 * the desktop origin prepended.
 */
export function resolveStreamUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  return `${apiBase}${url}`;
}

export type MusicSources = "all" | "spotify" | "youtube";

export interface SearchMusicOptions {
  signal?: AbortSignal;
  sources?: MusicSources;
}

const PREFETCH_TTL = 15 * 60 * 1000;
const prefetched = new Map<string, number>();
const prefetching = new Set<string>();

/**
 * Warms the local service cache for a track (resolves the YouTube video and
 * the direct audio URL) so the actual playback starts without yt-dlp delay.
 * Only local service URLs are handled; Audius links stream directly.
 */
export function prefetchStream(streamUrl: string): void {
  if (!streamUrl || /^(https?:|blob:|data:)/i.test(streamUrl)) return;
  const question = streamUrl.indexOf("?");
  if (question === -1) return;
  const query = streamUrl.slice(question + 1);
  if (!query || prefetching.has(query) || prefetching.size >= 6) return;
  const lastPrefetch = prefetched.get(query);
  if (lastPrefetch && Date.now() - lastPrefetch < PREFETCH_TTL) return;

  prefetching.add(query);
  void initMusicApi()
    .then(async (detected) => {
      if (!detected) {
        prefetching.delete(query);
        return;
      }
      try {
        const response = await fetch(`${apiBase}/api/music/prefetch?${query}`, {
          headers: { Accept: "application/json" }
        });
        if (response.ok) {
          if (prefetched.size > 200) prefetched.clear();
          prefetched.set(query, Date.now());
        }
      } catch {
        // A prefetch is best-effort; playback will resolve on demand.
      } finally {
        prefetching.delete(query);
      }
    })
    .catch(() => {
      prefetching.delete(query);
    });
}

export async function searchMusic(
  query: string,
  options: SearchMusicOptions = {}
): Promise<MusicSearchResult> {
  const detected = await initMusicApi();
  if (!detected) {
    return {
      tracks: [],
      sources: {},
      api: false,
      error: "Локальный музыкальный сервис не запущен"
    };
  }

  const params = new URLSearchParams({
    q: query,
    limit: "30",
    sources: options.sources ?? "all"
  });
  const response = await fetch(`${apiBase}/api/music/search?${params.toString()}`, {
    signal: options.signal,
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Music search failed: ${response.status}`);
  }

  const data = (await response.json()) as Omit<MusicSearchResult, "api">;
  return { ...data, api: true };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function keyOf(track: Track): string {
  return `${normalize(track.title)}|${normalize(track.artist).split(" ")[0] || ""}`;
}

/** Adds Audius results that are not already present in the main list. */
export function mergeTrackSources(primary: Track[], secondary: Track[]): Track[] {
  const seen = new Set(primary.map(keyOf));
  const result = [...primary];
  for (const track of secondary) {
    const key = keyOf(track);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(track);
  }
  return result;
}
