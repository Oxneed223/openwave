import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, Music2, Play, Search, Sparkles } from "lucide-react";
import type { Track } from "../types";
import { AUDIUS_GENRES, fetchTrending } from "../api/audius";
import {
  loadRecommendations,
  recommendationSignature,
  trackKey
} from "../api/recommendations";
import { prefetchStream } from "../api/music";
import { usePlayer } from "../store/player";
import { useLibrary } from "../store/library";
import { Chip, EmptyState, ErrorState, SectionHeader, SkeletonGrid } from "../components/Common";
import { TrackCard } from "../components/TrackCard";
import { PlaylistCard } from "../components/CollectionCard";
import { greeting } from "../lib/format";

export function HomePage() {
  const [genre, setGenre] = useState<string | null>(null);
  const [trending, setTrending] = useState<Track[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [recommendationReason, setRecommendationReason] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationRefresh, setRecommendationRefresh] = useState(0);

  const playTracks = usePlayer((state) => state.playTracks);
  const playTrack = usePlayer((state) => state.playTrack);
  const liked = useLibrary((state) => state.liked);
  const playlists = useLibrary((state) => state.playlists);
  const recent = useLibrary((state) => state.recent);

  const historyRef = useRef({ recent, liked });
  historyRef.current = { recent, liked };
  const recSignature = useMemo(
    () => recommendationSignature(recent, liked),
    [recent, liked]
  );

  useEffect(() => {
    const controller = new AbortController();
    setTrendingLoading(true);
    setTrendingError(false);
    fetchTrending(genre, controller.signal)
      .then((tracks) => {
        if (!controller.signal.aborted) setTrending(tracks);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTrendingError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTrendingLoading(false);
      });
    return () => controller.abort();
  }, [genre, retry]);

  useEffect(() => {
    if (!recSignature) {
      setRecommendations([]);
      setRecommendationReason("");
      setRecommendationLoading(false);
      return;
    }

    const controller = new AbortController();
    setRecommendationLoading(true);

    // Debounce so a few quick plays do not start several recommendation loads.
    const timer = window.setTimeout(() => {
      loadRecommendations({
        recent: historyRef.current.recent,
        liked: historyRef.current.liked,
        signal: controller.signal,
        onUpdate: (tracks, reason) => {
          if (controller.signal.aborted) return;
          setRecommendations(tracks);
          setRecommendationReason(reason);
          setRecommendationLoading(false);
        }
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setRecommendations(result.tracks);
          setRecommendationReason(result.reason);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!controller.signal.aborted) setRecommendationLoading(false);
        });
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [recSignature, recommendationRefresh]);

  const visibleRecommendations = useMemo(() => {
    if (!recent.length && !liked.length) return recommendations;
    const known = new Set([...recent, ...liked].map(trackKey));
    return recommendations.filter((track) => !known.has(trackKey(track)));
  }, [recommendations, recent, liked]);

  useEffect(() => {
    for (const track of visibleRecommendations.slice(0, 2)) {
      prefetchStream(track.streamUrl);
    }
  }, [visibleRecommendations]);

  const heroStyle = trending[0]?.artwork
    ? {
        backgroundImage: `linear-gradient(100deg, rgba(7,7,11,.96) 12%, rgba(7,7,11,.72) 52%, rgba(7,7,11,.25) 100%), url("${trending[0].artwork}")`
      }
    : undefined;

  return (
    <div className="page">
      <section className="hero" style={heroStyle}>
        <div className="hero-content">
          <span className="hero-badge">
            <Sparkles size={13} />
            Без рекламы и подписки
          </span>
          <h1>{greeting()}. Это OpenWave.</h1>
          <p>
            Поиск по всему каталогу Spotify и YouTube плюс открытые треки Audius. Никаких роликов
            между песнями.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => trending.length && playTracks(trending, 0)}
              disabled={!trending.length}
            >
              <Play size={17} fill="currentColor" />
              Слушать тренды
            </button>
            <Link to="/search" className="btn ghost">
              <Search size={17} />
              Найти трек
            </Link>
          </div>
        </div>
      </section>

      {(liked.length > 0 || recent[0] || playlists[0]) && (
        <div className="quick-grid">
          {liked.length > 0 && (
            <Link to="/liked" className="quick-tile">
              <span className="quick-art liked">
                <Heart size={20} fill="currentColor" />
              </span>
              <span className="quick-text">
                <strong>Любимые треки</strong>
                <span>{liked.length} в коллекции</span>
              </span>
            </Link>
          )}
          {recent[0] && (
            <button type="button" className="quick-tile" onClick={() => playTrack(recent[0])}>
              <span className="quick-art">
                {recent[0].artwork ? (
                  <img src={recent[0].artwork} alt="" />
                ) : (
                  <Music2 size={19} />
                )}
              </span>
              <span className="quick-text">
                <strong>{recent[0].title}</strong>
                <span>{recent[0].artist}</span>
              </span>
            </button>
          )}
          {playlists[0] && (
            <Link to={`/playlist/${playlists[0].id}`} className="quick-tile">
              <span className="quick-art playlist-art">
                <Music2 size={19} />
              </span>
              <span className="quick-text">
                <strong>{playlists[0].name}</strong>
                <span>{playlists[0].tracks.length} треков</span>
              </span>
              <span className="quick-link">
                <ArrowRight size={17} />
              </span>
            </Link>
          )}
        </div>
      )}

      {(recommendationLoading || visibleRecommendations.length > 0) && (
        <section className="section">
          <SectionHeader
            title="Для вас"
            subtitle={recommendationReason || "На основе прослушанных треков"}
            action={
              <button
                type="button"
                className="text-btn"
                onClick={() => setRecommendationRefresh((value) => value + 1)}
              >
                Обновить
              </button>
            }
          />
          {recommendationLoading && visibleRecommendations.length === 0 ? (
            <SkeletonGrid count={6} />
          ) : (
            <div className="track-grid">
              {visibleRecommendations.map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onPlay={() => playTracks(visibleRecommendations, index)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="section">
        <SectionHeader
          title="В тренде"
          subtitle="Что слушают на Audius на этой неделе"
          action={
            <span className="section-hint">
              <span className="live-dot" /> обновляется
            </span>
          }
        />
        <div className="chip-row">
          <Chip active={genre === null} onClick={() => setGenre(null)}>
            Все жанры
          </Chip>
          {AUDIUS_GENRES.map((item) => (
            <Chip key={item} active={genre === item} onClick={() => setGenre(item)}>
              {item}
            </Chip>
          ))}
        </div>

        {trendingLoading ? (
          <SkeletonGrid count={10} />
        ) : trendingError ? (
          <ErrorState
            message="Audius не ответил. Проверьте интернет и попробуйте снова."
            onRetry={() => setRetry((value) => value + 1)}
          />
        ) : trending.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="В этом жанре пока пусто"
            text="Попробуйте другой жанр или вернитесь ко всем трекам."
            action={
              <button type="button" className="btn ghost" onClick={() => setGenre(null)}>
                Все жанры
              </button>
            }
          />
        ) : (
          <div className="track-grid">
            {trending.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                onPlay={() => playTracks(trending, index)}
              />
            ))}
          </div>
        )}
      </section>

      {playlists.length > 0 && (
        <section className="section">
          <SectionHeader title="Ваши плейлисты" />
          <div className="collection-grid">
            {playlists.slice(0, 5).map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </section>
      )}

      <p className="page-footnote">
        Spotify используется для поиска и метаданных, аудио приходит с YouTube через yt-dlp, треки
        Audius — из открытой платформы. OpenWave ничего не скачивает и не показывает рекламу.
      </p>
    </div>
  );
}
