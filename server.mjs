import { createServer } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const apiOnly = argv.includes("--api-only");

let rootArg = null;
let portArg = null;
for (let index = 0; index < argv.length; index += 1) {
  const value = argv[index];
  if (value === "--port") {
    portArg = argv[index + 1];
    index += 1;
  } else if (!value.startsWith("--")) {
    rootArg = value;
  }
}

const root = resolve(rootArg ?? "dist");
const port = Number(
  portArg ?? process.env.OPENWAVE_API_PORT ?? process.env.PORT ?? (apiOnly ? 47821 : 4173)
);
const host = process.env.HOST ?? "127.0.0.1";

const YTDLP = process.env.OPENWAVE_YTDLP || "yt-dlp";
const SPOTDL_HELPER =
  process.env.OPENWAVE_SPOTDL_HELPER || join(scriptDir, "scripts", "spotdl_search.py");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8"
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, Content-Type"
  );
}

function send(res, status, message) {
  setCors(res);
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(message);
}

function sendJson(res, status, value) {
  setCors(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(value));
}

function shortError(error) {
  return String(error?.message || error || "unknown error").slice(0, 400);
}

function normalize(value, stripDecorations = true) {
  let text = String(value || "").toLowerCase();
  if (stripDecorations) {
    text = text
      .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
      .replace(/\b(?:feat\.?|ft\.?|featuring)\b.*$/i, " ");
  }
  return text.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function artistKey(track) {
  return normalize(track.artist).split(" ")[0] || "";
}

function exactKey(track) {
  return `${normalize(track.title, false)}|${normalize(track.artist, false)}`;
}

function cacheGet(cache, key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(cache, key, value, max = 200) {
  if (cache.size >= max) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function run(command, args, { timeout = 20000, env } = {}) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        windowsHide: true,
        env: { ...process.env, ...env }
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`${command} timed out`));
      }
    }, timeout);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 8_000_000) child.kill();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }
      const tail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-2).join(" ");
      reject(new Error(tail || `${command} exited with code ${code}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Spotify catalog (spotdl worker)
// ---------------------------------------------------------------------------

const spotify = {
  child: null,
  ready: false,
  starting: null,
  active: null,
  latest: null,
  error: null,
  nextId: 1,
  pending: new Map(),
  version: null
};

let pythonCache;

async function findPython() {
  if (pythonCache !== undefined) return pythonCache;
  const candidates = [
    process.env.OPENWAVE_PYTHON,
    "python",
    process.platform === "win32" ? "python3" : "python3",
    "py"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const args =
        candidate === "py"
          ? ["-3", "-c", "import spotdl, sys; sys.stdout.write('ok')"]
          : ["-c", "import spotdl, sys; sys.stdout.write('ok')"];
      await run(candidate, args, { timeout: 25000 });
      pythonCache = candidate;
      return candidate;
    } catch {
      // try the next interpreter
    }
  }

  pythonCache = null;
  return null;
}

function handleSpotifyLine(line, state) {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  if (message.ready === true) {
    state?.resolve?.(true);
    return;
  }
  if (message.ready === false) {
    state?.reject?.(new Error(message.error || "spotdl failed to start"));
    return;
  }

  if (message.id != null && spotify.pending.has(message.id)) {
    const pending = spotify.pending.get(message.id);
    spotify.pending.delete(message.id);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }
}

function rejectPendingSpotify(reason) {
  for (const pending of spotify.pending.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(reason || "spotdl worker stopped"));
  }
  spotify.pending.clear();
}

function cancelStartingSpotify(reason) {
  const state = spotify.starting;
  spotify.starting = null;
  if (!state) return;
  state.cancelled = true;
  state.reject?.(new Error(reason || "spotdl start cancelled"));
  if (state.child && !state.child.killed) {
    try {
      state.child.kill();
    } catch {
      // ignore
    }
  }
}

function stopSpotifyWorker(reason) {
  const child = spotify.child;
  cancelStartingSpotify(reason);
  spotify.child = null;
  spotify.ready = false;
  spotify.active = null;
  if (child && !child.killed) {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
  if (reason) spotify.error = reason;
  rejectPendingSpotify(reason);
}

function startSpotifyWorker(query) {
  if (spotify.ready) return Promise.resolve(true);
  if (spotify.starting?.promise) {
    if (spotify.starting.query === query) return spotify.starting.promise;
    cancelStartingSpotify("superseded by a newer search");
  }

  const state = {
    query,
    cancelled: false,
    child: null,
    resolve: null,
    reject: null,
    promise: null
  };
  spotify.starting = state;

  state.promise = (async () => {
    const python = await findPython();
    if (state.cancelled || spotify.starting !== state) {
      throw new Error("superseded by a newer search");
    }
    if (!python) throw new Error("Python с установленным spotdl не найден");

    await fs.access(SPOTDL_HELPER);
    if (state.cancelled || spotify.starting !== state) {
      throw new Error("superseded by a newer search");
    }

    const child = spawn(python, [SPOTDL_HELPER, "--serve"], {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1"
      }
    });
    state.child = child;
    spotify.child = child;

    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        handleSpotifyLine(line, state);
        newline = buffer.indexOf("\n");
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", () => {
      // spotdl logs to stderr; the JSON protocol lives on stdout.
    });
    child.on("error", (error) => {
      state.reject?.(error);
    });
    child.on("close", () => {
      if (spotify.child !== child) return;
      spotify.child = null;
      spotify.ready = false;
      spotify.active = null;
      if (spotify.starting === state) {
        spotify.starting = null;
        state.reject?.(new Error("spotdl worker exited"));
      }
      rejectPendingSpotify("spotdl worker exited");
    });

    await new Promise((resolveReady, rejectReady) => {
      const timer = setTimeout(
        () => rejectReady(new Error("spotdl не успел запуститься за 45 секунд")),
        45000
      );
      state.resolve = (value) => {
        clearTimeout(timer);
        resolveReady(value);
      };
      state.reject = (error) => {
        clearTimeout(timer);
        rejectReady(error);
      };
    });

    if (state.cancelled || spotify.starting !== state) {
      throw new Error("superseded by a newer search");
    }

    spotify.ready = true;
    spotify.error = null;
    spotify.starting = null;
    return true;
  })().catch((error) => {
    if (spotify.starting === state) {
      spotify.starting = null;
      if (state.child && spotify.child === state.child) {
        spotify.child = null;
        spotify.ready = false;
      }
      if (state.child && !state.child.killed) {
        try {
          state.child.kill();
        } catch {
          // ignore
        }
      }
    }
    throw error;
  });

  return state.promise;
}

async function spotifySearch(query, limit) {
  const ticket = { query };
  spotify.latest = ticket;

  // While a user is typing, only the newest query matters. Restart the worker
  // instead of queueing slow Spotify searches that are already stale.
  if (spotify.active && spotify.active.query !== query) {
    stopSpotifyWorker("superseded by a newer search");
  }

  await startSpotifyWorker(query);
  if (spotify.latest !== ticket) throw new Error("superseded by a newer search");

  const child = spotify.child;
  if (!child) throw new Error("spotdl worker недоступен");

  const id = spotify.nextId;
  spotify.nextId += 1;
  spotify.active = ticket;

  const response = await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      spotify.pending.delete(id);
      if (spotify.active === ticket) spotify.active = null;
      reject(new Error("Spotify не ответил за 30 секунд"));
    }, 30000);

    spotify.pending.set(id, {
      resolve: (value) => {
        if (spotify.active === ticket) spotify.active = null;
        resolvePromise(value);
      },
      reject: (error) => {
        if (spotify.active === ticket) spotify.active = null;
        reject(error);
      },
      timer
    });
    try {
      child.stdin.write(JSON.stringify({ id, query, limit }) + "\n");
    } catch (error) {
      clearTimeout(timer);
      spotify.pending.delete(id);
      if (spotify.active === ticket) spotify.active = null;
      reject(error);
    }
  });

  if (response.error) throw new Error(response.error);
  return Array.isArray(response.tracks) ? response.tracks : [];
}

// ---------------------------------------------------------------------------
// YouTube (yt-dlp)
// ---------------------------------------------------------------------------

const youtubeTracksCache = new Map();
const videoIdCache = new Map();
const audioUrlCache = new Map();
const resolving = new Map();
const resolvingQueries = new Map();

const SEARCH_TTL = 10 * 60 * 1000;
const VIDEO_ID_TTL = 24 * 60 * 60 * 1000;
const AUDIO_TTL = 25 * 60 * 1000;

function pickThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return undefined;
  const sorted = [...thumbnails]
    .filter((item) => item?.url)
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url;
}

function parseYoutubeTitle(rawTitle, channel) {
  let title = String(rawTitle || "").trim();
  title = title.replace(
    /\s*[([][^)\]]*(official\s*(music\s*)?(video|audio|lyric\s*video)|lyrics?|visualizer|audio|video|hd|4k|hq)[^)\]]*[)\]]/gi,
    " "
  );
  title = title.replace(/\s+/g, " ").trim();

  const dash = title.indexOf(" - ");
  if (dash > 0 && dash < 80) {
    const artist = title.slice(0, dash).trim();
    const song = title.slice(dash + 3).trim();
    if (artist && song) return { artist, title: song };
  }

  return { artist: channel || "YouTube", title: title || "Без названия" };
}

function mapYoutubeEntry(entry) {
  if (!entry?.id) return null;
  const parsed = parseYoutubeTitle(entry.title, entry.channel || entry.uploader);
  const duration = Number(entry.duration) || 0;
  if (duration && (duration < 20 || duration > 20 * 60)) return null;
  if (/\b(full album|greatest hits|full concert|playlist|compilation)\b/i.test(parsed.title)) {
    return null;
  }
  return {
    id: `youtube:${entry.id}`,
    source: "youtube",
    title: parsed.title,
    artist: parsed.artist,
    artwork: pickThumbnail(entry.thumbnails),
    duration,
    streamUrl: `/api/music/stream?yt=${encodeURIComponent(entry.id)}`,
    genre: "YouTube",
    permalink: `https://www.youtube.com/watch?v=${entry.id}`
  };
}

async function youtubeSearch(query, limit) {
  const key = `${query.toLowerCase()}::${limit}`;
  const cached = cacheGet(youtubeTracksCache, key, SEARCH_TTL);
  if (cached) return cached;

  const output = await run(
    YTDLP,
    [
      `ytsearch${limit}:${query}`,
      "--flat-playlist",
      "--dump-single-json",
      "--no-warnings",
      "--no-progress",
      "--socket-timeout",
      "15",
      "--extractor-retries",
      "1"
    ],
    { timeout: 30000 }
  );

  let data;
  try {
    data = JSON.parse(output);
  } catch {
    throw new Error("yt-dlp вернул некорректный JSON");
  }

  const tracks = (data.entries || []).map(mapYoutubeEntry).filter(Boolean);
  cacheSet(youtubeTracksCache, key, tracks);
  return tracks;
}

async function resolveVideoId(query) {
  const key = query.toLowerCase();
  const cached = cacheGet(videoIdCache, key, VIDEO_ID_TTL);
  if (cached) return cached;
  if (resolvingQueries.has(key)) return resolvingQueries.get(key);

  const promise = (async () => {
    const output = await run(
      YTDLP,
      [
        `ytsearch1:${query}`,
        "--flat-playlist",
        "--dump-single-json",
        "--no-warnings",
        "--no-progress",
        "--socket-timeout",
        "15"
      ],
      { timeout: 25000 }
    );

    let data;
    try {
      data = JSON.parse(output);
    } catch {
      throw new Error("Не удалось разобрать ответ yt-dlp");
    }
    const id = data.entries?.[0]?.id;
    if (!id) throw new Error("Трек не найден на YouTube");
    cacheSet(videoIdCache, key, id, 1000);
    return id;
  })().finally(() => {
    resolvingQueries.delete(key);
  });

  resolvingQueries.set(key, promise);
  return promise;
}

async function resolveAudioUrl(videoId, force = false) {
  if (!force) {
    const cached = cacheGet(audioUrlCache, videoId, AUDIO_TTL);
    if (cached) return cached;
  }

  if (!force && resolving.has(videoId)) return resolving.get(videoId);

  const promise = (async () => {
    const output = await run(
      YTDLP,
      [
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--socket-timeout",
        "20",
        "-f",
        "bestaudio[ext=m4a]/bestaudio/best",
        "-g",
        `https://www.youtube.com/watch?v=${videoId}`
      ],
      { timeout: 35000 }
    );

    const url = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith("http"));
    if (!url) throw new Error("yt-dlp не выдал ссылку на аудио");
    cacheSet(audioUrlCache, videoId, url, 500);
    return url;
  })().finally(() => {
    resolving.delete(videoId);
  });

  resolving.set(videoId, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Search + health
// ---------------------------------------------------------------------------

const healthCache = { at: 0, value: null };

async function getHealth() {
  if (healthCache.value && Date.now() - healthCache.at < 60_000) {
    return healthCache.value;
  }

  let ytdlp = { available: false, error: "not checked" };
  try {
    const version = (await run(YTDLP, ["--version"], { timeout: 12000 })).trim();
    ytdlp = { available: true, version };
  } catch (error) {
    ytdlp = { available: false, error: shortError(error) };
  }

  const python = await findPython();
  const helperExists = await fs
    .access(SPOTDL_HELPER)
    .then(() => true)
    .catch(() => false);

  const spotdl = {
    available: Boolean(python && helperExists),
    version: spotify.version,
    ready: spotify.ready,
    error: python ? (helperExists ? spotify.error : "spotdl_search.py не найден") : "Python не найден"
  };

  if (spotdl.available && !spotify.ready && !spotify.starting) {
    startSpotifyWorker().catch((error) => {
      spotify.error = shortError(error);
    });
  }

  const value = {
    ok: Boolean(ytdlp.available || spotdl.available),
    port,
    platforms: { win32: process.platform === "win32", platform: process.platform },
    tools: { ytdlp, spotdl }
  };
  healthCache.value = value;
  healthCache.at = Date.now();
  return value;
}

function spotifyTrack(item) {
  const artist = item.artists?.join(", ") || "Spotify";
  const searchQuery = `${item.artists?.[0] || ""} ${item.name}`.trim();
  return {
    id: `spotify:${item.id}`,
    source: "spotify",
    title: item.name,
    artist,
    artwork: item.cover || undefined,
    duration: Number(item.duration) || 0,
    streamUrl: `/api/music/stream?q=${encodeURIComponent(searchQuery)}`,
    album: item.album || undefined,
    permalink: item.url || undefined
  };
}

function dedupeList(tracks) {
  const seen = new Set();
  const result = [];
  for (const track of tracks) {
    if (!track) continue;
    const key = exactKey(track);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(track);
  }
  return result;
}

function mergeMusicSources(spotifyTracks, youtubeTracks) {
  const spotifyList = dedupeList(spotifyTracks);
  const spotifyCore = new Set(
    spotifyList.map((track) => `${normalize(track.title)}|${artistKey(track)}`)
  );

  // YouTube is a fallback source: drop videos that Spotify already covers.
  const youtubeList = dedupeList(youtubeTracks).filter(
    (track) => !spotifyCore.has(`${normalize(track.title)}|${artistKey(track)}`)
  );

  return [...spotifyList, ...youtubeList];
}

const searchCache = new Map();

async function musicSearch(query, limit, mode = "all") {
  const wantSpotify = mode !== "youtube";
  const wantYoutube = mode !== "spotify";
  const key = `${query.toLowerCase()}::${limit}::${mode}`;
  const cached = cacheGet(searchCache, key, SEARCH_TTL);
  if (cached) return cached;

  const [spotifyResult, youtubeResult] = await Promise.allSettled([
    wantSpotify
      ? spotifySearch(query, limit).then((items) => items.map(spotifyTrack))
      : Promise.resolve([]),
    wantYoutube ? youtubeSearch(query, Math.min(Math.max(limit, 10), 20)) : Promise.resolve([])
  ]);

  const spotifyTracks = spotifyResult.status === "fulfilled" ? spotifyResult.value : [];
  const youtubeTracks = youtubeResult.status === "fulfilled" ? youtubeResult.value : [];

  const tracks =
    mode === "all"
      ? mergeMusicSources(spotifyTracks, youtubeTracks)
      : [...spotifyTracks, ...youtubeTracks];

  const sources = {};
  if (wantSpotify) {
    sources.spotify = {
      ok: spotifyResult.status === "fulfilled",
      count: spotifyTracks.length,
      error: spotifyResult.status === "rejected" ? shortError(spotifyResult.reason) : undefined
    };
  }
  if (wantYoutube) {
    sources.youtube = {
      ok: youtubeResult.status === "fulfilled",
      count: youtubeTracks.length,
      error: youtubeResult.status === "rejected" ? shortError(youtubeResult.reason) : undefined
    };
  }

  const value = { query, tracks, sources };
  cacheSet(searchCache, key, value, 100);
  return value;
}

// ---------------------------------------------------------------------------
// Audio proxy
// ---------------------------------------------------------------------------

async function proxyAudio(req, res, videoId) {
  let upstream = null;
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const audioUrl = await resolveAudioUrl(videoId, attempt > 0);
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept-Encoding": "identity"
      };
      if (req.headers.range) headers.Range = req.headers.range;

      upstream = await fetch(audioUrl, { headers, redirect: "follow" });
      if (upstream.status === 403 || upstream.status === 410) {
        audioUrlCache.delete(videoId);
        lastError = new Error(`YouTube ответил ${upstream.status}`);
        try {
          await upstream.body?.cancel();
        } catch {
          // ignore
        }
        upstream = null;
        continue;
      }
      break;
    } catch (error) {
      lastError = error;
      await sleep(400);
    }
  }

  if (!upstream) {
    send(res, 502, `Не удалось получить аудио: ${shortError(lastError)}`);
    return;
  }

  if (!upstream.ok && upstream.status !== 206) {
    try {
      await upstream.body?.cancel();
    } catch {
      // ignore
    }
    send(res, 502, `YouTube ответил ${upstream.status}`);
    return;
  }

  setCors(res);
  const headers = {
    "Content-Type": upstream.headers.get("content-type") || "audio/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store"
  };
  const length = upstream.headers.get("content-length");
  const range = upstream.headers.get("content-range");
  if (length) headers["Content-Length"] = length;
  if (range) headers["Content-Range"] = range;

  res.writeHead(upstream.status, headers);

  if (req.method === "HEAD") {
    res.end();
    try {
      await upstream.body?.cancel();
    } catch {
      // ignore
    }
    return;
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  const stream = Readable.fromWeb(upstream.body);
  stream.on("error", () => {
    if (!res.destroyed) res.destroy();
  });
  res.on("close", () => {
    stream.destroy();
  });
  stream.pipe(res);
}

async function handleMusicApi(req, res, url) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  const route = url.pathname;

  if (route === "/api/music/health") {
    sendJson(res, 200, await getHealth());
    return true;
  }

  if (route === "/api/music/search") {
    const query = (url.searchParams.get("q") || "").trim();
    if (query.length < 2) {
      sendJson(res, 400, { error: "Слишком короткий запрос" });
      return true;
    }
    const rawLimit = Number(url.searchParams.get("limit") || 25);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 25, 5), 50);
    const requested = url.searchParams.get("sources");
    const mode = requested === "spotify" || requested === "youtube" ? requested : "all";
    try {
      sendJson(res, 200, await musicSearch(query, limit, mode));
    } catch (error) {
      sendJson(res, 500, { error: shortError(error), tracks: [], sources: {} });
    }
    return true;
  }

  if (route === "/api/music/prefetch") {
    let videoId = (url.searchParams.get("yt") || "").trim();
    const query = (url.searchParams.get("q") || "").trim();

    try {
      if (!videoId && query) videoId = await resolveVideoId(query);
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        sendJson(res, 400, { ok: false, error: "Некорректный идентификатор трека" });
        return true;
      }
      await resolveAudioUrl(videoId);
      sendJson(res, 200, { ok: true, videoId });
    } catch (error) {
      sendJson(res, 502, { ok: false, videoId: videoId || null, error: shortError(error) });
    }
    return true;
  }

  if (route === "/api/music/stream") {
    let videoId = (url.searchParams.get("yt") || "").trim();
    const query = (url.searchParams.get("q") || "").trim();

    if (!videoId && query) {
      try {
        videoId = await resolveVideoId(query);
      } catch (error) {
        send(res, 502, `Не удалось найти трек: ${shortError(error)}`);
        return true;
      }
    }

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      send(res, 400, "Некорректный идентификатор трека");
      return true;
    }

    await proxyAudio(req, res, videoId);
    return true;
  }

  sendJson(res, 404, { error: "Метод API не найден" });
  return true;
}

// ---------------------------------------------------------------------------
// Static files + HTTP server
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  if (!req.url) return send(res, 400, "Bad request");
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    return send(res, 405, "Method not allowed");
  }

  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return send(res, 400, "Bad request");
  }

  if (url.pathname.startsWith("/api/music/")) {
    try {
      const handled = await handleMusicApi(req, res, url);
      if (handled) return;
    } catch (error) {
      if (!res.headersSent) send(res, 500, shortError(error));
      return;
    }
  }

  if (apiOnly) {
    return send(res, 404, "Not found");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, "Bad request");
  }

  if (pathname.endsWith("/")) pathname += "index.html";

  let file = resolve(join(root, `.${pathname}`));
  if (file !== root && !file.startsWith(root + sep)) {
    return send(res, 403, "Forbidden");
  }

  try {
    const info = await fs.stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
  } catch {
    // SPA fallback for client-side routes.
    if (req.headers.accept?.includes("text/html")) {
      file = join(root, "index.html");
    } else {
      return send(res, 404, "Not found");
    }
  }

  try {
    const info = await fs.stat(file);
    const isAsset = pathname.startsWith("/assets/");
    res.writeHead(200, {
      "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "no-cache"
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, "Not found");
  }
});

server.listen(port, host, () => {
  const shownHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(
    apiOnly
      ? `OpenWave music API: http://${shownHost}:${port}/api/music/health`
      : `OpenWave web: http://${shownHost}:${port}`
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

// When launched by the desktop app, stop together with it.
const parentPid = Number(process.env.OPENWAVE_PARENT_PID || 0);
if (parentPid) {
  const timer = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 5000);
  timer.unref();
}

function shutdown() {
  stopSpotifyWorker();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
