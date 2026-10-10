import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .bot import run_bot
from .config import settings
from .models import ExchangePoint, RatesResponse
from .service import RatesService

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("rates.api")

service = RatesService()


async def _refresh_loop() -> None:
    while True:
        try:
            await service.refresh()
        except Exception:  # noqa: BLE001 — the loop must never die
            log.exception("Unexpected error in refresh loop")
        await asyncio.sleep(settings.refresh_interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    service.load_cache()
    task = asyncio.create_task(_refresh_loop())
    bot_task = asyncio.create_task(run_bot(service)) if settings.bot_token else None
    yield
    task.cancel()
    if bot_task:
        bot_task.cancel()


app = FastAPI(title="Yerevan Rates API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Temporarily unavailable"})


@app.get("/api/health")
async def health() -> dict:
    snap = service.snapshot()
    return {"status": "ok", "source": snap.source, "stale": snap.stale, "updated_at": snap.updated_at}


@app.get("/api/rates", response_model=RatesResponse)
async def get_rates() -> RatesResponse:
    """Instant: always answers from memory (live → cache → seed)."""
    return service.snapshot()


@app.post("/api/rates/refresh", response_model=RatesResponse)
async def refresh_rates() -> RatesResponse:
    """Manual refresh. If Rate.am is down the previous snapshot is returned with `error` set."""
    await service.refresh(force=True)
    return service.snapshot()


@app.get("/api/points", response_model=list[ExchangePoint])
async def get_points() -> list[ExchangePoint]:
    return service.repo.points
