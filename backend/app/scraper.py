from __future__ import annotations

import logging
import re
from dataclasses import asdict, dataclass, field
from typing import Optional

import httpx
from bs4 import BeautifulSoup, Tag

from .config import settings
from .utils import normalize

log = logging.getLogger("rates.scraper")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0 Safari/537.36"
)
CURRENCIES = ("USD", "EUR", "RUB")
SANITY = {"USD": (200.0, 900.0), "EUR": (200.0, 1100.0), "RUB": (1.0, 20.0)}

# "362." happens on Rate.am (trailing dot), so the fraction may be empty.
NUM_RE = re.compile(r"^\d{1,4}(?:\.\d{0,4})?$")
DASH_TOKENS = {"-", "—", "–", "n/a"}
TIME_RE = re.compile(r"(?:\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?[\s,]*)?\d{1,2}:\d{2}")
LETTER_RE = re.compile(r"[A-Za-zА-Яа-яЁёԱ-Ֆա-և]{2,}")
ORG_LINK_RE = re.compile(r"/(banks?|exchange-points?|organi[sz]ations?|branch(es)?)/[^/?#]+", re.I)
HEADER_WORDS = {
    "bank", "banks", "name", "organization", "exchange point", "exchange points", "usd", "eur",
    "rub", "gbp", "buy", "sell", "date", "branches", "банк", "банки", "покупка", "продажа",
    "обменник", "обменные пункты", "дата", "филиалы",
}


class ScrapeError(Exception):
    pass


@dataclass
class ScrapedOrg:
    name: str
    kind: str
    rates: dict[str, dict[str, float]] = field(default_factory=dict)
    updated_text: Optional[str] = None
    slug: Optional[str] = None  # Rate.am's own id from the organisation link, unique per point

    def to_dict(self) -> dict:
        return asdict(self)


def _num(token: str) -> Optional[float]:
    t = token.replace("\xa0", "").replace(" ", "").replace(",", ".").strip()
    return float(t) if NUM_RE.match(t) else None


def build_org(tokens: list[str], kind: str) -> Optional[ScrapedOrg]:
    """Turn a flat list of text tokens from one row into an organisation with rates."""
    name_idx = -1
    for i, tok in enumerate(tokens):
        t = tok.strip()
        if (
            LETTER_RE.search(t)
            and len(t) <= 80
            and t.lower() not in HEADER_WORDS
            and not TIME_RE.fullmatch(t)
        ):
            name_idx = i
            break
    if name_idx < 0:
        return None

    values: list[Optional[float]] = []
    updated: Optional[str] = None
    for tok in tokens[name_idx + 1:]:
        t = tok.strip()
        v = _num(t)
        if v is not None:
            values.append(v)
        elif t.lower() in DASH_TOKENS:
            values.append(None)
        elif updated is None and TIME_RE.search(t):
            updated = TIME_RE.search(t).group(0).strip()  # type: ignore[union-attr]

    if len(values) < 6:
        return None

    rates: dict[str, dict[str, float]] = {}
    for i, cur in enumerate(CURRENCIES):
        buy, sell = values[2 * i], values[2 * i + 1]
        lo, hi = SANITY[cur]
        pair: dict[str, float] = {}
        if buy is not None and lo <= buy <= hi:
            pair["buy"] = buy
        if sell is not None and lo <= sell <= hi:
            pair["sell"] = sell
        if pair:
            rates[cur] = pair
    if "USD" not in rates:
        return None
    return ScrapedOrg(name=tokens[name_idx].strip(), kind=kind, rates=rates, updated_text=updated)


def _tokens(node: Tag) -> list[str]:
    return [s for s in node.stripped_strings if s]


def _cell_value(text: str, cur: str) -> Optional[float]:
    v = _num(text)
    lo, hi = SANITY[cur]
    return v if v is not None and lo <= v <= hi else None


def _currency(header_text: str) -> str:
    code = header_text.strip().upper()
    return "RUB" if code == "RUR" else code


def parse_split_table(soup: BeautifulSoup, kind: str) -> list[ScrapedOrg]:
    table = soup.select_one(".rateTable")
    if table is None:
        return []
    parts = table.find_all(recursive=False)
    if len(parts) < 2:
        return []
    header, body = parts[0], parts[-1]
    currencies = [_currency(next(g.stripped_strings, "")) for g in header.find_all(recursive=False)]
    if not set(CURRENCIES) <= set(currencies):
        log.warning("Rate.am %s: unexpected currency columns %s", kind, currencies)

    # Smallest ancestor holding both blocks; organisation links inside it are the name rows.
    container: Optional[Tag] = table
    links: list[Tag] = []
    while container is not None and not links:
        container = container.parent
        if container is not None:
            links = [a for a in container.find_all("a", href=True) if ORG_LINK_RE.search(a["href"])]
    # The banks table is server-rendered on non-cash rates: refuse it, Playwright switches to cash.
    # Same lookup as SELECT_CASH_JS: the nearest toggle above the table, not the converter's.
    cash: Optional[Tag] = None
    node: Optional[Tag] = table
    while node is not None and cash is None:
        node = node.parent
        cash = node.select_one("input[type=radio][value=CASH]") if node is not None else None
    if cash is not None and not cash.has_attr("checked"):
        log.info("Rate.am %s table shows non-cash rates, need the cash view", kind)
        return []

    # Greyed-out rows (text-N60) below a separator are points that stopped updating: skip them.
    def active(row: Optional[Tag]) -> bool:
        classes = (row.get("class") or []) if row is not None else []
        return "h-12" in classes and "text-N60" not in classes

    all_links = links
    links = [a for a in links if active(a.find_parent("div", class_="h-12"))]
    rows = [
        r for r in body.find_all(recursive=False) if active(r) and "flex" in (r.get("class") or [])
    ]
    if not links or len(rows) != len(links):  # misaligned columns would mean wrong rates
        log.warning("Rate.am %s table: %d names vs %d rate rows, columns misaligned, skipping",
                    kind, len(links), len(rows))
        return []

    orgs: list[ScrapedOrg] = []
    rejected = 0
    for link, row in zip(links, rows):
        name = next((s.strip() for s in link.find_all(string=True, recursive=False) if s.strip()), "")
        if not name:
            log.warning("Rate.am %s: row without a name (%s), skipped", kind, link.get("href"))
            continue
        when = link.find("p")
        raw: dict[str, list[str]] = {}
        rates: dict[str, dict[str, float]] = {}
        for cur, group in zip(currencies, row.find_all(recursive=False)):
            cells = [c.get_text(strip=True) for c in group.find_all(recursive=False)]
            raw[cur] = cells
            if cur not in SANITY or len(cells) < 2:
                continue
            pair: dict[str, float] = {}
            for side, text in (("buy", cells[0]), ("sell", cells[1])):
                v = _cell_value(text, cur)
                if v is not None:
                    pair[side] = v
                elif text and text.lower() not in DASH_TOKENS:
                    rejected += 1
                    log.warning("Rate.am %s: %s %s %s = %r is not a valid rate, ignored",
                                kind, name, cur, side, text)
            if pair:
                rates[cur] = pair
        log.debug("Rate.am %s row: %s raw=%s parsed=%s", kind, name, raw, rates)
        if rates:
            orgs.append(
                ScrapedOrg(
                    name=name,
                    kind=kind,
                    rates=rates,
                    updated_text=" ".join(when.get_text().split()) if when else None,
                    slug=link["href"].rstrip("/").rsplit("/", 1)[-1] or None,
                )
            )
    stale = len(all_links) - len(links)
    log.info("Rate.am %s table: columns %s, %d rows, %d with rates, %d stale skipped, %d bad cells",
             kind, currencies, len(rows), len(orgs), stale, rejected)
    return orgs


def parse_html(html: str, kind: str) -> list[ScrapedOrg]:
    soup = BeautifulSoup(html, "lxml")
    found: dict[str, ScrapedOrg] = {}

    def add(org: Optional[ScrapedOrg]) -> None:
        if org:
            found.setdefault(normalize(org.name), org)

    # 0. Current Rate.am layout (split name/rate columns). When it is present, the generic
    # heuristics below would only pick up junk (headers, averages), so they are not tried.
    if soup.select_one(".rateTable") is not None:
        for org in parse_split_table(soup, kind):
            add(org)
        return list(found.values())

    # 1. Classic tables and ARIA grids.
    for row in soup.select("tr, [role=row]"):
        cells = row.find_all(["td", "th", "div"], recursive=False) or [row]
        tokens: list[str] = []
        for c in cells:
            tokens.extend(_tokens(c))
        add(build_org(tokens, kind))

    # 2. Div-based layouts: climb from an organisation link to the smallest container with rates.
    if not found:
        for a in soup.find_all("a", href=True):
            if not ORG_LINK_RE.search(a["href"]):
                continue
            node: Optional[Tag] = a
            for _ in range(7):
                node = node.parent if node is not None else None
                if node is None:
                    break
                tokens = _tokens(node)
                if sum(1 for t in tokens if _num(t) is not None) >= 6:
                    add(build_org(tokens, kind))
                    break

    return list(found.values())


async def _fetch_http(client: httpx.AsyncClient, url: str) -> str:
    r = await client.get(url)
    r.raise_for_status()
    return r.text


# Clicks the Cash radio of the rates table itself (the currency converter has its own one).
SELECT_CASH_JS = r"""() => {
  let n = document.querySelector('.rateTable');
  while (n && !n.querySelector('input[type=radio][value=CASH]')) n = n.parentElement;
  if (!n) return 'no-toggle';
  const input = n.querySelector('input[type=radio][value=CASH]');
  if (input.checked) return 'already';
  input.closest('label').click();
  return 'clicked';
}"""


async def _render_playwright(url: str) -> str:
    from playwright.async_api import async_playwright  # imported lazily: optional dependency

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            page = await browser.new_page(user_agent=USER_AGENT, locale="en-US")
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            try:
                await page.wait_for_selector(".rateTable", timeout=25_000)
                await page.wait_for_timeout(1500)
                # The banks table opens on non-cash rates; we want cash.
                if await page.evaluate(SELECT_CASH_JS) == "clicked":
                    await page.wait_for_timeout(2500)
            except Exception:  # noqa: BLE001 — still try to parse whatever rendered
                log.warning("Playwright: rates did not appear in time on %s", url)
            return await page.content()
        finally:
            await browser.close()


async def scrape_all() -> list[ScrapedOrg]:
    sources = [
        (settings.rate_am_banks_url, "bank"),
        (settings.rate_am_exchange_points_url, "exchange"),
    ]
    found: dict[str, ScrapedOrg] = {}
    errors: list[str] = []

    async with httpx.AsyncClient(
        timeout=settings.request_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
    ) as client:
        for url, kind in sources:
            orgs: list[ScrapedOrg] = []
            try:
                orgs = parse_html(await _fetch_http(client, url), kind)
            except Exception as e:  # noqa: BLE001
                errors.append(f"{kind}/http: {type(e).__name__}: {e}")
            if not orgs and settings.use_playwright:
                try:
                    orgs = parse_html(await _render_playwright(url), kind)
                except Exception as e:  # noqa: BLE001
                    errors.append(f"{kind}/playwright: {type(e).__name__}: {e}")
            log.info("Rate.am %s: %d organisations parsed", kind, len(orgs))
            for o in orgs[:3]:  # a sample of what was actually read; LOG_LEVEL=DEBUG shows every row
                log.info("  sample %s: %s (%s)", kind, o.rates, o.name)
            for o in orgs:
                found.setdefault(normalize(o.name), o)

    if not found:
        raise ScrapeError("; ".join(errors) or "no rates found in Rate.am markup")
    return list(found.values())
