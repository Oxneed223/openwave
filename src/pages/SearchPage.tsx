import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Music2, Search, X } from "lucide-react";
import type { Track } from "../types";
import { AUDIUS_GENRES, searchTracks } from "../api/audius";
import { mergeTrackSources, prefetchStream, searchMusic } from "../api/music";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useLibrary } from "../store/library";
import { EmptyState, ErrorState, SectionHeader, SkeletonList } from "../components/Common";
import { TrackList } from "../components/TrackList";
import { gradientFor } from "../lib/colors";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const qParam = params.get("q") ?? "";
  const [query, setQuery] = useState(qParam);
  const debounced = useDebouncedValue(query.trim(), 450);

  const [audiusTracks, setAudiusTracks] = useState<Track[]>([]);
  const [youtubeTracks, setYoutubeTracks] = useState<Track[]>([]);
  const [spotifyTracks, setSpotifyTracks] = useState<Track[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [spotifyPending, setSpotifyPending] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);
  const [spotifyOffline, setSpotifyOffline] = useState(false);
  const [youtubeOffline, setYoutubeOffline] = useState(false);

  const searches = useLibrary((state) => state.searches);
  const addSearch = useLibrary((state) => state.addSearch);
  const clearSearches = useLibrary((state) => state.clearSearches);
  const lastParam = useRef(qParam);

  const tracks = useMemo(
    () => mergeTrackSources([...spotifyTracks, ...youtubeTracks], audiusTracks),
    [spotifyTracks, youtubeTracks, audiusTracks]
  );

  useEffect(() => {
    setQuery(qParam);
  }, [qParam]);

  useEffect(() => {
    // The URL was changed from outside (history, a link, the address bar).
    // Wait for the input to catch up instead of immediately reverting it.
    if (lastParam.current !== qParam) {
      lastParam.current = qParam;
      return;
    }
    if (debounced === qParam) return;
    if (debounced.length >= 2) setParams({ q: debounced }, { replace: true });
    else if (debounced.length === 0) setParams({}, { replace: true });
  }, [debounced, qParam, setParams]);

  useEffect(() => {
    if (debounced.length < 2) {
      setAudiusTracks([]);
      setYoutubeTracks([]);
      setSpotifyTracks([]);
      setSpotifyPending(false);
      setLoading(false);
      setError(false);
      setApiOffline(false);
      setSpotifyOffline(false);
      setYoutubeOffline(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    let pending = 3;
    let failures = 0;

    setLoading(true);
    setError(false);
    setSpotifyPending(true);
    setAudiusTracks([]);
    setYoutubeTracks([]);
    setSpotifyTracks([]);
    setApiOffline(false);
    setSpotifyOffline(false);
    setYoutubeOffline(false);

    const settle = () => {
      pending -= 1;
      if (!active || pending > 0) return;
      setLoading(false);
      if (failures === 3) setError(true);
    };

    // Audius is usually the fastest source, so the first tracks appear
    // almost immediately. YouTube and Spotify are appended as they arrive.
    searchTracks(debounced, controller.signal).then(
      (items) => {
        if (active) setAudiusTracks(items);
        settle();
      },
      () => {
        if (active) failures += 1;
        settle();
      }
    );

    searchMusic(debounced, { signal: controller.signal, sources: "youtube" }).then(
      (result) => {
        if (!active) return;
        setYoutubeTracks(result.tracks);
        setApiOffline(!result.api);
        if (!result.api || result.sources.youtube?.ok === false) {
          failures += 1;
          setYoutubeOffline(result.api);
        }
        settle();
      },
      () => {
        if (active) {
          failures += 1;
          setApiOffline(true);
        }
        settle();
      }
    );

    searchMusic(debounced, { signal: controller.signal, sources: "spotify" }).then(
      (result) => {
        if (!active) return;
        setSpotifyTracks(result.tracks);
        setSpotifyPending(false);
        if (!result.api || result.sources.spotify?.ok === false) {
          failures += 1;
          setSpotifyOffline(result.api);
        } else if (result.tracks.length > 0) {
          setError(false);
        }
        settle();
      },
      () => {
        if (!active) return;
        failures += 1;
        setSpotifyPending(false);
        setSpotifyOffline(true);
        settle();
      }
    );

    return () => {
      active = false;
      controller.abort();
    };
  }, [debounced, retry]);

  // Warm the top results as soon as they appear so the first click starts
  // playing without waiting for yt-dlp to resolve the stream.
  useEffect(() => {
    for (const track of [...spotifyTracks, ...youtubeTracks].slice(0, 2)) {
      prefetchStream(track.streamUrl);
    }
  }, [spotifyTracks, youtubeTracks]);

  const spotifyCount = tracks.filter((track) => track.source === "spotify").length;
  const youtubeCount = tracks.filter((track) => track.source === "youtube").length;
  const audiusCount = tracks.filter((track) => track.source === "audius").length;
  const showSourceNote =
    !loading && (apiOffline || youtubeOffline || (spotifyOffline && !spotifyPending));
  const showSkeleton = loading && tracks.length === 0;

  const applySearch = (value: string) => {
    const trimmed = value.trim();
    setQuery(trimmed);
    if (trimmed.length >= 2) {
      setParams({ q: trimmed });
      addSearch(trimmed);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    applySearch(query);
  };

  const hasQuery = debounced.length >= 2;

  return (
    <div className="page">
      <header className="page-header">
        <span className="eyebrow">Каталог</span>
        <h1>Поиск</h1>
        <p>Spotify, YouTube и Audius — один поиск по всем трекам.</p>
      </header>

      <form className="search-bar" onSubmit={handleSubmit} role="search">
        <Search size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Трек или исполнитель"
          aria-label="Поиск треков"
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="icon-btn small"
            onClick={() => {
              setQuery("");
              setParams({}, { replace: true });
            }}
            aria-label="Очистить поиск"
          >
            <X size={17} />
          </button>
        )}
      </form>

      {!hasQuery ? (
        <>
          {searches.length > 0 && (
            <section className="section">
              <SectionHeader
                title="Недавние запросы"
                action={
                  <button type="button" className="text-btn" onClick={clearSearches}>
                    Очистить
                  </button>
                }
              />
              <div className="chip-row">
                {searches.map((item) => (
                  <button
                    type="button"
                    className="chip recent-chip"
                    key={item}
                    onClick={() => applySearch(item)}
                  >
                    <Clock3 size={14} />
                    {item}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="section">
            <SectionHeader
              title="Жанры"
              subtitle="Начните с направления — треки подберутся автоматически"
            />
            <div className="genre-grid">
              {AUDIUS_GENRES.map((item) => (
                <button
                  type="button"
                  className="genre-card"
                  key={item}
                  style={{ background: gradientFor(item) }}
                  onClick={() => applySearch(item)}
                >
                  <span>{item}</span>
                  <Music2 size={34} strokeWidth={1.4} />
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="result-heading">
            <span>Треки</span>
            <span className="result-heading-count">
              {loading && tracks.length === 0 ? "…" : tracks.length}
            </span>
            {loading && tracks.length > 0 && (
              <span className="result-heading-pulse">добавляем ещё…</span>
            )}
          </div>

          {showSourceNote && (
            <p className="search-note">
              {apiOffline
                ? "Локальный музыкальный сервис не запущен: показаны только треки Audius. Для Spotify и YouTube запустите Node и установите yt-dlp и spotdl."
                : youtubeOffline
                  ? "YouTube временно не отвечает — показаны Spotify и Audius."
                  : "Spotify-каталог сейчас недоступен — ищем по YouTube и Audius."}
            </p>
          )}

          {(tracks.length > 0 || spotifyPending) && (
            <div className="source-summary" aria-label="Источники результатов">
              {spotifyCount > 0 && (
                <span className="source-pill spotify">Spotify {spotifyCount}</span>
              )}
              {spotifyPending && <span className="source-pill spotify pending">Spotify · ищем…</span>}
              {youtubeCount > 0 && (
                <span className="source-pill youtube">YouTube {youtubeCount}</span>
              )}
              {audiusCount > 0 && (
                <span className="source-pill audius">Audius {audiusCount}</span>
              )}
              {loading && !spotifyPending && tracks.length > 0 && (
                <span className="source-pill pending">Ещё…</span>
              )}
            </div>
          )}

          {error ? (
            <ErrorState
              message="Не удалось выполнить поиск. Проверьте соединение и повторите попытку."
              onRetry={() => setRetry((value) => value + 1)}
            />
          ) : showSkeleton ? (
            <SkeletonList rows={6} />
          ) : tracks.length === 0 ? (
            spotifyPending ? (
              <SkeletonList rows={3} />
            ) : (
              <EmptyState
                icon={Music2}
                title="Треки не найдены"
                text={`По запросу «${debounced}» ничего не нашлось. Попробуйте другое название или исполнителя.`}
              />
            )
          ) : (
            <div className="track-list-wrap">
              <TrackList tracks={tracks} />
            </div>
          )}
        </>
      )}

      {hasQuery && (
        <p className="page-footnote">
          Нашли трек? Нажмите на «+», чтобы сохранить его в плейлист. Spotify даёт каталог и
          обложки, YouTube — аудиопоток, Audius — открытые треки.
        </p>
      )}
    </div>
  );
}
