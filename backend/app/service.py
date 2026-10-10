from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import settings
from .models import Address, ExchangePoint, PointOut, Rate, RatesResponse
from .scraper import scrape_all
from .utils import google_maps_url, normalize, slugify, utcnow

log = logging.getLogger("rates.service")


class PointsRepository:
    """Reads data/exchange_points.json and hot-reloads it when the file changes."""

    def __init__(self, path: Path):
        self.path = path
        self._mtime: Optional[float] = None
        self._points: list[ExchangePoint] = []
        self._seed_updated_at: Optional[datetime] = None
        self._index: list[tuple[str, ExchangePoint]] = []

    def _load_if_changed(self) -> None:
        try:
            mtime = self.path.stat().st_mtime
            if mtime == self._mtime:
                return
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            points = [ExchangePoint.model_validate(p) for p in raw.get("points", [])]
            seed_at = raw.get("seed_updated_at")
            self._points = points
            self._seed_updated_at = datetime.fromisoformat(seed_at) if seed_at else None
            self._index = [
                (normalize(alias), p) for p in points for alias in [p.name, *p.aliases] if alias
            ]
            self._mtime = mtime
            log.info("Loaded %d exchange points from %s", len(points), self.path.name)
        except Exception:  # noqa: BLE001 — keep the previous good version
            log.exception("Failed to load %s, keeping previous version", self.path)

    @property
    def points(self) -> list[ExchangePoint]:
        self._load_if_changed()
        return self._points

    @property
    def seed_updated_at(self) -> Optional[datetime]:
        self._load_if_changed()
        return self._seed_updated_at

    def match(self, scraped_name: str) -> Optional[ExchangePoint]:
        self._load_if_changed()
        key = normalize(scraped_name)
        if not key:
            return None
        for alias, point in self._index:
            if alias == key:
                return point
        for alias, point in self._index:  # fuzzy: "ameriabank" vs "ameriabankcjsc"
            if len(alias) >= 4 and (key.startswith(alias) or alias.startswith(key)):
                return point
        return None


def _to_out(point: ExchangePoint, rates: dict[str, Rate], updated: Optional[str]) -> PointOut:
    address_en = point.address.en if point.address else None
    return PointOut(
        id=point.id,
        name=point.name,
        type=point.type,
        address=point.address,
        lat=point.lat,
        lng=point.lng,
        maps_url=point.maps_url
        or google_maps_url(lat=point.lat, lng=point.lng, address=address_en, name=point.name),
        phone=point.phone,
        rates=rates,
        rate_updated_at=updated,
        known=True,
    )


class RatesService:
    def __init__(self) -> None:
        self.repo = PointsRepository(settings.points_file)
        self._lock = asyncio.Lock()
        self._orgs: Optional[list[dict]] = None
        self._updated_at: Optional[datetime] = None
        self._last_attempt: Optional[datetime] = None
        self._last_error: Optional[str] = None
        self._live_this_run = False

    # persistence
    def load_cache(self) -> None:
        path = settings.cache_file
        if not path.exists():
            log.info("No rates cache yet (%s)", path.name)
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            self._orgs = raw["orgs"]
            self._updated_at = datetime.fromisoformat(raw["updated_at"])
            log.info("Restored %d organisations from cache (%s)", len(self._orgs), self._updated_at)
        except Exception:  # noqa: BLE001
            log.exception("Rates cache is corrupted, ignoring it")

    def _save_cache(self) -> None:
        path = settings.cache_file
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            payload = {"updated_at": self._updated_at.isoformat(), "orgs": self._orgs}  # type: ignore[union-attr]
            tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            os.replace(tmp, path)  # atomic
        except Exception:  # noqa: BLE001
            log.exception("Could not write rates cache")

    # scraping
    async def refresh(self, force: bool = False) -> bool:
        """Scrape Rate.am. Never raises. Returns True when fresh data was obtained."""
        called_at = utcnow()
        async with self._lock:
            # Another request already refreshed while we were waiting for the lock.
            if self._last_attempt and self._last_attempt >= called_at:
                return self._last_error is None
            gap = settings.min_refresh_gap_seconds if not force else 5
            if self._last_attempt and (called_at - self._last_attempt).total_seconds() < gap:
                return self._last_error is None

            self._last_attempt = utcnow()
            try:
                orgs = await asyncio.wait_for(scrape_all(), timeout=settings.scrape_timeout_seconds)
                self._orgs = [o.to_dict() for o in orgs]
                self._updated_at = utcnow()
                self._last_error = None
                self._live_this_run = True
                self._save_cache()
                log.info("Rate.am refresh OK: %d organisations", len(orgs))
                return True
            except Exception as e:  # noqa: BLE001
                msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
                self._last_error = msg[:400]
                log.error("Rate.am refresh failed, serving cached data: %s", self._last_error)
                return False

    # response
    def snapshot(self) -> RatesResponse:
        now = utcnow()
        points = self.repo.points

        if self._orgs is None:
            out = [
                _to_out(p, p.seed_rates, None) for p in points if p.seed_rates
            ]
            return RatesResponse(
                source="seed",
                stale=True,
                updated_at=self.repo.seed_updated_at,
                fetched_at=now,
                error=self._last_error or "Rate.am has not been reached yet",
                points=out,
            )

        by_point: dict[str, PointOut] = {}
        extras: list[PointOut] = []
        for org in self._orgs:
            rates = {cur: Rate(**v) for cur, v in org.get("rates", {}).items()}
            point = self.repo.match(org["name"])
            if point:
                if point.id not in by_point:
                    by_point[point.id] = _to_out(point, rates, org.get("updated_text"))
                continue
            extras.append(
                PointOut(
                    id=f"ext-{org.get('slug') or slugify(org['name'])}",
                    name=org["name"],
                    type="exchange" if org.get("kind") == "exchange" else "bank",
                    address=None,
                    maps_url=google_maps_url(lat=None, lng=None, address=None, name=org["name"]),
                    rates=rates,
                    rate_updated_at=org.get("updated_text"),
                    known=False,
                )
            )

        # Points from JSON that Rate.am did not list right now: keep them (favourites!) without rates.
        missing = [_to_out(p, {}, None) for p in points if p.id not in by_point]

        # ids are React keys and favourite ids on the frontend: they must be unique.
        seen: set[str] = set(by_point)
        unique_extras: list[PointOut] = []
        for point in extras:
            if point.id in seen:
                log.warning("Duplicate point id %s (%s), skipped", point.id, point.name)
                continue
            seen.add(point.id)
            unique_extras.append(point)
        extras = unique_extras

        age = (now - self._updated_at).total_seconds() if self._updated_at else 1e9
        stale = age > settings.stale_after_seconds or self._last_error is not None
        source = "live" if self._live_this_run and self._last_error is None else "cache"
        return RatesResponse(
            source=source,
            stale=stale,
            updated_at=self._updated_at,
            fetched_at=now,
            error=self._last_error,
            points=[*by_point.values(), *extras, *missing],
        )


__all__ = ["RatesService", "Address"]
