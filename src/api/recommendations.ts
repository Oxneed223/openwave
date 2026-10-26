import type { Track } from "../types";
import { fetchTrending, searchTracks } from "./audius";
import { searchMusic } from "./music";

const MAX_RESULTS = 12;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(?:feat\.?|ft\.?|featuring)\b.*$/i, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function primaryArtist(value: string): string {
  return value.split(/,|&|\bfeat\b|\bft\b/i)[0].trim();
}

export function trackKey(track: Track): string {
  return `${normalize(track.title)}|${normalize(primaryArtist(track.artist))}`;
}

function cleanArtist(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*-\s*topic\b/g, "")
    .replace(/\bvevo\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function artistMatches(track: Track, seed: string): boolean {
  const artist = cleanArtist(track.artist);
  const target = cleanArtist(seed);
  if (!artist || !target) return false;
  return artist === target || artist.startsWith(`${target} `) || artist.includes(target);
}

interface SeedInfo {
  artists: string[];
  genre?: string;
  reason: string;
}

function buildSeeds(recent: Track[], liked: Track[]): SeedInfo {
  const scores = new Map<string, { name: string; score: number }>();
  const addArtist = (track: Track, weight: number) => {
    const name = primaryArtist(track.artist);
    const key = name.toLowerCase();
    if (
      !name ||
      key === "youtube" ||
      key === "spotify" ||
      key === "unknown" ||
      key === "various" ||
      key === "various artists"
    ) {
      return;
    }
    const entry = scores.get(key) ?? { name, score: 0 };
    entry.score += weight;
    scores.set(key, entry);
  };

  const history = recent.slice(0, 40);
  history.forEach((track, index) => {
    const recency = 1 + (history.length - index) / history.length;
    addArtist(track, recency);
  });
  liked.forEach((track) => addArtist(track, 2.5));

  const artists = [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.name);

  const genreScores = new Map<string, number>();
  for (const track of [...history, ...liked]) {
    const genre = track.genre?.trim();
    if (!genre || /^(youtube|spotify)$/i.test(genre)) continue;
    genreScores.set(genre, (genreScores.get(genre) ?? 0) + 1);
  }
  const genre = [...genreScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const reasonParts: string[] = [];
  if (artists.length) {
    reasonParts.push(`На основе прослушиваний: ${artists.slice(0, 2).join(", ")}`);
  }
  if (genre) reasonParts.push(`жанр ${genre}`);

  return { artists, genre, reason: reasonParts.join(" · ") };
}

/** Changes only when the top artists or genre change, not on every play. */
export function recommendationSignature(recent: Track[], liked: Track[]): string {
  const { artists, genre } = buildSeeds(recent, liked);
  return `${artists.join("|")}::${genre ?? ""}`;
}

interface LoadOptions {
  recent: Track[];
  liked: Track[];
  signal?: AbortSignal;
  onUpdate?: (tracks: Track[], reason: string) => void;
}

export async function loadRecommendations({
  recent,
  liked,
  signal,
  onUpdate
}: LoadOptions): Promise<{ tracks: Track[]; reason: string }> {
  const { artists, genre, reason } = buildSeeds(recent, liked);
  if (!artists.length && !genre) {
    return { tracks: [], reason: "" };
  }

  const known = new Set([...recent, ...liked].map(trackKey));
  const knownIds = new Set([...recent, ...liked].map((track) => track.id));

  // One group per seed plus a genre group, merged round-robin so a single
  // artist cannot occupy the whole block.
  const groups: Track[][] = artists.map(() => []);
  const groupSeen: Array<Set<string>> = artists.map(() => new Set());
  const genreGroup: Track[] = [];
  const genreSeen = new Set<string>();

  const pushToGroup = (
    group: Track[],
    seen: Set<string>,
    tracks: Track[],
    limit = 8
  ) => {
    for (const track of tracks) {
      if (group.length >= limit) break;
      if (!track || knownIds.has(track.id)) continue;
      if (track.duration && (track.duration < 45 || track.duration > 20 * 60)) continue;
      const key = trackKey(track);
      if (!key || seen.has(key) || known.has(key)) continue;
      seen.add(key);
      group.push(track);
    }
  };

  const merge = (): Track[] => {
    const merged: Track[] = [];
    const seen = new Set(known);
    const active = [...groups, genreGroup].filter((group) => group.length > 0);

    let index = 0;
    while (merged.length < MAX_RESULTS && active.some((group) => index < group.length)) {
      for (const group of active) {
        const track = group[index];
        if (!track) continue;
        const key = trackKey(track);
        if (!key || seen.has(key) || knownIds.has(track.id)) continue;
        seen.add(key);
        merged.push(track);
        if (merged.length >= MAX_RESULTS) break;
      }
      index += 1;
    }
    return merged;
  };

  let latest: Track[] = [];
  const emit = () => {
    latest = merge();
    if (!signal?.aborted) onUpdate?.(latest, reason);
  };

  const artistTasks: Array<Promise<void>> = [];

  // More songs by the artists the listener already plays.
  artists.forEach((artist, index) => {
    artistTasks.push(
      searchTracks(artist, signal)
        .then((tracks) => {
          pushToGroup(
            groups[index],
            groupSeen[index],
            tracks.filter((track) => artistMatches(track, artist))
          );
          emit();
        })
        .catch(() => undefined)
    );
  });

  // YouTube covers mainstream artists that Audius does not have.
  artists.slice(0, 2).forEach((artist, index) => {
    artistTasks.push(
      searchMusic(artist, { signal, sources: "youtube" })
        .then((result) => {
          if (!result.api) return;
          pushToGroup(
            groups[index],
            groupSeen[index],
            result.tracks.filter((track) => artistMatches(track, artist))
          );
          emit();
        })
        .catch(() => undefined)
    );
  });

  await Promise.allSettled(artistTasks);

  // If there are still too few songs, mix in the favourite genre.
  if (latest.length < 8 && genre && !signal?.aborted) {
    try {
      const trending = await fetchTrending(genre, signal);
      pushToGroup(genreGroup, genreSeen, trending, 6);
      emit();
    } catch {
      // Recommendations are best-effort.
    }
  }

  emit();
  return { tracks: latest, reason };
}
