from __future__ import annotations

import asyncio
import html
import logging
from datetime import timedelta, timezone
from typing import Any, Optional

import httpx

from .config import settings
from .models import PointOut, RatesResponse
from .service import RatesService

log = logging.getLogger("rates.bot")
# httpx logs every request URL at INFO - and the URL contains the bot token.
logging.getLogger("httpx").setLevel(logging.WARNING)

CURRENCIES = ("USD", "EUR", "RUB")
FLAGS = {"USD": "🇺🇸", "EUR": "🇪🇺", "RUB": "🇷🇺"}
TOP_N = 5
YEREVAN_TZ = timezone(timedelta(hours=4))

COMMANDS = [
    {"command": "rates", "description": "Лучшие курсы USD / EUR / RUB"},
    {"command": "usd", "description": "Топ обменников по доллару"},
    {"command": "eur", "description": "Топ обменников по евро"},
    {"command": "rub", "description": "Топ обменников по рублю"},
]


class TelegramError(Exception):
    def __init__(self, code: int, description: str):
        super().__init__(f"{code}: {description}")
        self.code = code
        self.description = description


# formatting
def _num(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")  # 384.00 -> 384, 4.60 -> 4.6


def _ranked(points: list[PointOut], cur: str, side: str) -> list[tuple[float, PointOut]]:
    """side="sell": bank sells to you, cheapest first; side="buy": bank buys from you, highest first."""
    rows = []
    for p in points:
        rate = p.rates.get(cur)
        value = getattr(rate, side) if rate else None
        if value:
            rows.append((value, p))
    rows.sort(key=lambda r: r[0], reverse=side == "buy")
    return rows


def _footer(snap: RatesResponse) -> str:
    if snap.source == "seed":
        return "<i>Демо-курсы: Rate.am ещё не ответил, попробуйте через минуту</i>"
    when = snap.updated_at.astimezone(YEREVAN_TZ).strftime("%d.%m %H:%M") if snap.updated_at else "—"
    line = f"🕒 <i>Обновлено {when} (Ереван) · rate.am</i>"
    if snap.stale:
        line += "\n <i>Данные могут быть устаревшими</i>"
    return line


def summary_text(snap: RatesResponse) -> str:
    lines = ["💱 <b>Лучшие курсы в Ереване</b>"]
    for cur in CURRENCIES:
        buy_here = _ranked(snap.points, cur, "sell")
        sell_here = _ranked(snap.points, cur, "buy")
        if not buy_here and not sell_here:
            continue
        lines.append(f"\n{FLAGS[cur]} <b>{cur}</b>")
        if buy_here:
            v, p = buy_here[0]
            lines.append(f"Купить: <b>{_num(v)}</b> ֏ — {html.escape(p.name)}")
        if sell_here:
            v, p = sell_here[0]
            lines.append(f"Продать: <b>{_num(v)}</b> ֏ — {html.escape(p.name)}")
    if len(lines) == 1:
        lines.append("\nКурсов пока нет.")
    lines.append("\n" + _footer(snap))
    return "\n".join(lines)


def currency_text(snap: RatesResponse, cur: str) -> str:
    lines = [f"{FLAGS[cur]} <b>{cur} — топ-{TOP_N}</b>"]
    for side, title in (("sell", "Купить (дешевле всего)"), ("buy", "Продать (дороже всего)")):
        rows = _ranked(snap.points, cur, side)[:TOP_N]
        lines.append(f"\n<b>{title}:</b>")
        if not rows:
            lines.append("нет данных")
        for i, (v, p) in enumerate(rows, 1):
            lines.append(f"{i}. <b>{_num(v)}</b> ֏ — {html.escape(p.name)}")
    lines.append("\n" + _footer(snap))
    return "\n".join(lines)


def keyboard() -> dict:
    rows: list[list[dict]] = [
        [{"text": f"{FLAGS[c]} {c}", "callback_data": f"cur:{c}"} for c in CURRENCIES],
        [
            {"text": "Все валюты", "callback_data": "cur:all"},
            {"text": "Обновить", "callback_data": "refresh"},
        ],
    ]
    if settings.webapp_url:
        rows.append([{"text": "Открыть приложение", "web_app": {"url": settings.webapp_url}}])
    return {"inline_keyboard": rows}


# bot
class Bot:
    def __init__(self, service: RatesService, token: str):
        self.service = service
        self.base = f"https://api.telegram.org/bot{token}/"
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(70, connect=10))

    async def call(self, method: str, **params: Any) -> Any:
        resp = await self.client.post(self.base + method, json=params)
        data = resp.json()
        if not data.get("ok"):
            raise TelegramError(data.get("error_code", resp.status_code), data.get("description", ""))
        return data["result"]

    async def setup(self) -> None:
        try:
            await self.call("deleteWebhook")  # polling does not work while a webhook is set
            await self.call("setMyCommands", commands=COMMANDS)
            if settings.webapp_url:
                await self.call(
                    "setChatMenuButton",
                    menu_button={"type": "web_app", "text": "Курсы", "web_app": {"url": settings.webapp_url}},
                )
            me = await self.call("getMe")
            log.info("Telegram bot @%s started", me.get("username"))
        except TelegramError as e:
            if e.code == 401:
                raise
            log.error("Bot setup failed: %s", e)

    async def run(self) -> None:
        try:
            await self.setup()
        except TelegramError:
            log.error("BOT_TOKEN is invalid (401 Unauthorized) — bot disabled")
            return
        offset = 0
        while True:
            try:
                updates = await self.call(
                    "getUpdates",
                    offset=offset,
                    timeout=50,
                    allowed_updates=["message", "callback_query"],
                )
            except asyncio.CancelledError:
                raise
            except TelegramError as e:
                if e.code == 409:
                    log.error("Another copy of the bot is already polling with this token (409); retrying")
                else:
                    log.error("getUpdates failed: %s", e)
                await asyncio.sleep(10)
                continue
            except Exception as e:  # noqa: BLE001 - network hiccups must not kill the bot
                log.warning("getUpdates network error: %s", type(e).__name__)
                await asyncio.sleep(5)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                try:
                    await self.handle(update)
                except Exception:  # noqa: BLE001
                    log.exception("Failed to handle update %s", update.get("update_id"))

    async def handle(self, update: dict) -> None:
        if "callback_query" in update:
            await self.on_callback(update["callback_query"])
        elif "message" in update:
            await self.on_message(update["message"])

    async def send(self, chat_id: int, text: str) -> None:
        await self.call(
            "sendMessage",
            chat_id=chat_id,
            text=text,
            parse_mode="HTML",
            reply_markup=keyboard(),
            link_preview_options={"is_disabled": True},
        )

    async def on_message(self, msg: dict) -> None:
        chat_id = msg["chat"]["id"]
        text = (msg.get("text") or "").strip()
        cmd = text.split()[0].split("@")[0].lower() if text else ""
        snap = self.service.snapshot()
        if cmd == "/start":
            hello = (
                "Привет! Я показываю курсы <b>USD / EUR / RUB</b> в банках и обменниках Еревана "
                "по данным rate.am.\n\n"
                "/rates — лучшие курсы\n/usd, /eur, /rub — топ по валюте"
            )
            await self.call("sendMessage", chat_id=chat_id, text=hello, parse_mode="HTML")
            await self.send(chat_id, summary_text(snap))
        elif cmd[1:].upper() in CURRENCIES:
            await self.send(chat_id, currency_text(snap, cmd[1:].upper()))
        else:  # /rates, /help and any other text
            await self.send(chat_id, summary_text(snap))

    async def on_callback(self, cq: dict) -> None:
        data = cq.get("data", "")
        msg = cq.get("message")
        if data == "refresh":
            await self.call("answerCallbackQuery", callback_query_id=cq["id"], text="Обновляю курсы…")
            ok = await self.service.refresh(force=True)
            view = "all"
            if not ok and msg:
                await self.call(
                    "sendMessage",
                    chat_id=msg["chat"]["id"],
                    text="Rate.am сейчас не отвечает — показываю последние сохранённые курсы.",
                )
        else:
            await self.call("answerCallbackQuery", callback_query_id=cq["id"])
            view = data.removeprefix("cur:")
        if not msg:
            return
        snap = self.service.snapshot()
        text = currency_text(snap, view) if view in CURRENCIES else summary_text(snap)
        try:
            await self.call(
                "editMessageText",
                chat_id=msg["chat"]["id"],
                message_id=msg["message_id"],
                text=text,
                parse_mode="HTML",
                reply_markup=keyboard(),
                link_preview_options={"is_disabled": True},
            )
        except TelegramError as e:
            if "not modified" not in e.description:
                raise

    async def close(self) -> None:
        await self.client.aclose()


async def run_bot(service: RatesService, token: Optional[str] = None) -> None:
    bot = Bot(service, token or settings.bot_token)
    try:
        await bot.run()
    finally:
        await bot.close()
