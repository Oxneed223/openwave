"""Spotify catalog search for OpenWave, powered by the spotdl library.

Two modes:
  --check          verify that spotdl can be imported and print its version
  --serve          long-running JSON-lines worker used by server.mjs
  <query> [limit]  one-shot search, prints JSON (handy for debugging)

spotdl 4.6+ can talk to Spotify anonymously through spotipyfree, so no
credentials are required. If SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are
set, the official Spotify Web API is used instead.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def init_spotify() -> None:
    from spotdl.utils.spotify import SpotifyClient

    client_id = os.environ.get("SPOTIFY_CLIENT_ID", "")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET", "")
    official = bool(client_id and client_secret)

    SpotifyClient.init(
        client_id=client_id,
        client_secret=client_secret,
        no_cache=True,
        headless=True,
        max_retries=2,
        use_official_api=official,
    )


def map_track(item: dict[str, Any]) -> dict[str, Any] | None:
    track_id = item.get("id")
    name = (item.get("name") or "").strip()
    if not track_id or not name:
        return None

    artists = [a.get("name", "").strip() for a in item.get("artists") or []]
    artists = [a for a in artists if a]
    album = item.get("album") or {}
    images = album.get("images") or []
    cover = ""
    for image in images:
        if image.get("url"):
            cover = image["url"]
            break

    duration_ms = item.get("duration_ms") or 0
    external = (item.get("external_urls") or {}).get("spotify")

    return {
        "id": track_id,
        "name": name,
        "artists": artists,
        "album": (album.get("name") or "").strip(),
        "cover": cover,
        "duration": round(duration_ms / 1000) if duration_ms else 0,
        "url": external,
    }


def search(query: str, limit: int = 25) -> dict[str, Any]:
    from spotdl.utils.spotify import SpotifyClient

    client = SpotifyClient()
    # spotipyfree ignores the limit argument and returns up to 100 items,
    # so we slice the result ourselves.
    raw = client.search(query, type="track", limit=max(limit, 20))
    items = ((raw or {}).get("tracks") or {}).get("items") or []

    tracks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        mapped = map_track(item)
        if not mapped or mapped["id"] in seen:
            continue
        seen.add(mapped["id"])
        tracks.append(mapped)
        if len(tracks) >= limit:
            break

    return {"tracks": tracks, "total": len(items)}


def serve() -> None:
    init_spotify()
    emit({"ready": True})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request: dict[str, Any] | None = None
        try:
            request = json.loads(line)
            result = search(
                str(request.get("query", "")),
                int(request.get("limit", 25)),
            )
            result["id"] = request.get("id")
            emit(result)
        except Exception as error:  # noqa: BLE001 - report every failure to the caller
            emit(
                {
                    "id": request.get("id") if isinstance(request, dict) else None,
                    "tracks": [],
                    "error": str(error)[:400],
                }
            )


def main() -> int:
    # Keep spotdl's own logging away from the JSON channel.
    logging.getLogger().setLevel(logging.ERROR)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdin.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    args = sys.argv[1:]
    if "--check" in args:
        try:
            import spotdl

            emit({"ok": True, "version": getattr(spotdl, "__version__", None)})
            return 0
        except Exception as error:  # noqa: BLE001
            emit({"ok": False, "error": str(error)[:400]})
            return 1

    if "--serve" in args:
        try:
            serve()
            return 0
        except BrokenPipeError:
            return 0
        except Exception as error:  # noqa: BLE001
            emit({"ready": False, "error": str(error)[:400]})
            return 1

    if not args:
        emit({"tracks": [], "error": "empty query"})
        return 1

    try:
        init_spotify()
        emit(search(args[0], int(args[1]) if len(args) > 1 else 25))
        return 0
    except Exception as error:  # noqa: BLE001
        emit({"tracks": [], "error": str(error)[:400]})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
