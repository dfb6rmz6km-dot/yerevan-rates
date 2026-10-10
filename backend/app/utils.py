import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import quote_plus

_NON_ALNUM = re.compile(r"[^0-9a-zа-яёա-և]+")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize(name: str) -> str:
    """'ACBA Bank CJSC' -> 'acbabankcjsc' — used to match Rate.am names with our aliases."""
    return _NON_ALNUM.sub("", name.lower())


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    # Non-Latin names (Armenian, Russian) would all collapse to the same slug: hash them instead.
    return slug or "point-" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:10]


def google_maps_url(
    *, lat: float | None, lng: float | None, address: str | None, name: str
) -> str:
    """Universal Google Maps link: opens the Maps app on mobile, the website otherwise."""
    if lat is not None and lng is not None:
        query = f"{lat},{lng}"
    elif address:
        query = f"{name}, {address}"
    else:
        query = f"{name}, Yerevan, Armenia"
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"
