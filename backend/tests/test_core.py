import asyncio

import pytest

from app import service as service_mod
from app.config import settings
from app.scraper import ScrapeError, parse_html
from app.service import RatesService

TABLE_HTML = """
<table>
  <tr><th>Bank</th><th>Date</th><th>USD</th><th></th><th>EUR</th><th></th><th>RUB</th><th></th></tr>
  <tr><td>1</td><td><a href="/en/bank/ameriabank">Ameriabank</a></td><td>07.10.2026, 14:05</td>
      <td>384</td><td>388</td><td>445</td><td>454</td><td>4.6</td><td>4.95</td></tr>
  <tr><td>2</td><td><a href="/en/bank/acba">ACBA Bank</a></td><td>13:58</td>
      <td>383.5</td><td>388.5</td><td>—</td><td>—</td><td>4.55</td><td>4.97</td></tr>
  <tr><td>3</td><td>Broken row</td><td>1</td><td>2</td></tr>
</table>
"""

DIV_HTML = """
<div class="list">
  <div class="row"><a href="/en/exchange-points/mega-change">Mega Change</a>
     <span>15:10</span><span>385</span><span>387</span><span>447</span><span>452</span>
     <span>4.7</span><span>4.85</span></div>
</div>
"""


def test_parse_table():
    orgs = {o.name: o for o in parse_html(TABLE_HTML, "bank")}
    assert set(orgs) == {"Ameriabank", "ACBA Bank"}
    assert orgs["Ameriabank"].rates["USD"] == {"buy": 384.0, "sell": 388.0}
    assert orgs["Ameriabank"].updated_text == "07.10.2026, 14:05"
    assert "EUR" not in orgs["ACBA Bank"].rates  # dashes -> missing, not shifted
    assert orgs["ACBA Bank"].rates["RUB"]["sell"] == 4.97


def test_parse_div_layout():
    orgs = parse_html(DIV_HTML, "exchange")
    assert len(orgs) == 1 and orgs[0].rates["RUB"] == {"buy": 4.7, "sell": 4.85}


def test_fallbacks(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "cache_file", tmp_path / "cache.json")

    async def boom():
        raise ScrapeError("rate.am down")

    svc = RatesService()
    monkeypatch.setattr(service_mod, "scrape_all", boom)

    # 1) never reached -> seed, no exception
    assert asyncio.run(svc.refresh(force=True)) is False
    snap = svc.snapshot()
    assert snap.source == "seed" and snap.stale and snap.points

    # 2) one good scrape -> live and cached to disk
    async def ok():
        return parse_html(TABLE_HTML, "bank")

    monkeypatch.setattr(service_mod, "scrape_all", ok)
    svc._last_attempt = None
    assert asyncio.run(svc.refresh(force=True)) is True
    snap = svc.snapshot()
    assert snap.source == "live" and not snap.stale
    amer = next(p for p in snap.points if p.id == "ameriabank")
    assert amer.rates["USD"].buy == 384 and "google.com/maps" in amer.maps_url

    # 3) site goes down, process restarts -> cached data, flagged stale, error exposed
    monkeypatch.setattr(service_mod, "scrape_all", boom)
    svc2 = RatesService()
    svc2.load_cache()
    asyncio.run(svc2.refresh(force=True))
    snap = svc2.snapshot()
    assert snap.source == "cache" and snap.stale and "rate.am down" in snap.error
    assert next(p for p in snap.points if p.id == "ameriabank").rates["USD"].sell == 388


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__]))


SPLIT_HTML = """
<div>
  <div class="names">
    <div class="w-full grow">
      <div class="relative w-full h-12 flex"><span><a href="/en/bank/ameriabank">Ameriabank<p>7<!-- --> Oct, 20:00</p></a></span></div>
      <div class="relative w-full h-12 flex"><span><a href="/en/bank/mellat-bank">Mellat Bank<p>19:30</p></a></span></div>
    </div>
    <div class="w-full rounded-bl-xl">
      <div class="relative w-full text-N60 h-12 flex"><span><a href="/en/bank/old">Old Point</a></span></div>
    </div>
  </div>
  <div>
    <div class="rateTable">
      <div><div>USD<span>EUR</span></div><div>EUR</div><div>RUR</div></div>
      <div></div>
      <div>
        <div class="flex h-12 bg-white">
          <div><div>384</div><div>388</div></div><div><div>445</div><div>454</div></div><div><div>4.6</div><div>4.95</div></div>
        </div>
        <div class="flex h-12 bg-white">
          <div><div></div><div></div></div><div><div>400</div><div>413</div></div><div><div>4</div><div>4.5</div></div>
        </div>
        <div class="text-center h-12"></div>
        <div class="flex bg-white text-N60 h-12">
          <div><div>1</div><div>2</div></div><div><div></div><div></div></div><div><div></div><div></div></div>
        </div>
        <div class="group flex h-10"><div><div>384.5</div><div>388.5</div></div></div>
      </div>
    </div>
  </div>
</div>
"""


def test_parse_split_layout():
    orgs = {o.name: o for o in parse_html(SPLIT_HTML, "bank")}
    assert set(orgs) == {"Ameriabank", "Mellat Bank"}  # greyed-out stale point skipped
    assert orgs["Ameriabank"].rates == {
        "USD": {"buy": 384.0, "sell": 388.0},
        "EUR": {"buy": 445.0, "sell": 454.0},
        "RUB": {"buy": 4.6, "sell": 4.95},
    }
    assert orgs["Ameriabank"].updated_text == "7 Oct, 20:00"
    assert "USD" not in orgs["Mellat Bank"].rates  # empty cells -> missing, not shifted
    assert orgs["Mellat Bank"].rates["EUR"] == {"buy": 400.0, "sell": 413.0}


def test_split_layout_rejects_non_cash_view():
    toggle = '<label><input type="radio" value="CLEARING" checked></label><label><input type="radio" value="CASH"></label>'
    assert parse_html(toggle + SPLIT_HTML, "bank") == []
    cash = '<label><input type="radio" value="CLEARING"></label><label><input type="radio" value="CASH" checked></label>'
    assert len(parse_html(cash + SPLIT_HTML, "bank")) == 2


def test_rate_with_trailing_dot():
    html = SPLIT_HTML.replace("<div>388</div>", "<div>388.</div>")
    orgs = {o.name: o for o in parse_html(html, "bank")}
    assert orgs["Ameriabank"].rates["USD"] == {"buy": 384.0, "sell": 388.0}


def test_point_ids_unique_for_non_latin_names():
    html = SPLIT_HTML.replace("/en/bank/ameriabank\">Ameriabank", "/en/exchange-point/zovq-1\">ԶՈՎՔ Գայի պոստ")
    html = html.replace("/en/bank/mellat-bank\">Mellat Bank", "/en/exchange-point/arev-2\">ՉԱՐԲԱԽ ԱՐԵՎ")
    orgs = parse_html(html, "exchange")
    assert [o.slug for o in orgs] == ["zovq-1", "arev-2"]

    svc = RatesService()
    svc._orgs = [o.to_dict() for o in orgs]
    svc._updated_at = svc._last_attempt = None
    ids = [p.id for p in svc.snapshot().points]
    assert "ext-zovq-1" in ids and "ext-arev-2" in ids
    assert len(ids) == len(set(ids))
