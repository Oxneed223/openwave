import type { Track } from "../types";

const API_BASE = "https://api.audius.co/v1";
const APP_NAME = "OpenWave";

export const AUDIUS_GENRES = [
  "Electronic",
  "Hip-Hop/Rap",
  "Lo-Fi",
  "Rock",
  "Pop",
  "Jazz",
  "Ambient",
  "R&B/Soul",
  "Alternative",
  "Classical",
  "Experimental",
  "Soundtrack"
] as const;

interface AudiusUser {
  name?: string;
  handle?: string;
  is_deactivated?: boolean;
}

interface AudiusTrack {
  id: string;
  title?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  artwork?: Record<string, string> | null;
  user?: AudiusUser;
  permalink?: string;
  is_streamable?: boolean;
  is_available?: boolean;
  is_delete?: boolean;
}

interface AudiusEnvelope<T> {
  data: T;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal,
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Audius request failed: ${response.status}`);
  }
  const body = (await response.json()) as AudiusEnvelope<T>;
  return body.data;
}

function artworkOf(track: AudiusTrack): string | undefined {
  const artwork = track.artwork;
  if (!artwork) return undefined;
  return artwork["480x480"] || artwork["1000x1000"] || artwork["150x150"] || artwork["144x144"];
}

function toTrack(track: AudiusTrack): Track | null {
  if (!track || !track.id) return null;
  if (track.is_delete || track.is_available === false || track.is_streamable === false) return null;
  return {
    id: `audius:${track.id}`,
    source: "audius",
    title: track.title?.trim() || "Без названия",
    artist: track.user?.name?.trim() || track.user?.handle?.trim() || "Audius",
    artwork: artworkOf(track),
    duration: track.duration ?? 0,
    streamUrl: `${API_BASE}/tracks/${encodeURIComponent(track.id)}/stream?app_name=${APP_NAME}`,
    genre: track.genre || undefined,
    permalink: track.permalink ? `https://audius.co${track.permalink}` : undefined
  };
}

function mapTracks(items: AudiusTrack[] | undefined): Track[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: Track[] = [];
  for (const item of items) {
    const track = toTrack(item);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    result.push(track);
  }
  return result;
}

export async function fetchTrending(genre?: string | null, signal?: AbortSignal): Promise<Track[]> {
  const params = new URLSearchParams({ app_name: APP_NAME, time: "week", limit: "40" });
  if (genre) params.set("genre", genre);
  const data = await request<AudiusTrack[]>(`/tracks/trending?${params.toString()}`, signal);
  return mapTracks(data);
}

export async function searchTracks(query: string, signal?: AbortSignal): Promise<Track[]> {
  const params = new URLSearchParams({ app_name: APP_NAME, query, limit: "40" });
  const data = await request<AudiusTrack[]>(`/tracks/search?${params.toString()}`, signal);
  return mapTracks(data);
}
