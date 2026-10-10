"""Application settings, loaded from environment variables / .env (never hardcode secrets)."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR.parent / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    rate_am_banks_url: str = "https://www.rate.am/en/armenian-dram-exchange-rates/banks"
    rate_am_exchange_points_url: str = (
        "https://www.rate.am/en/armenian-dram-exchange-rates/exchange-points"
    )

    # Rate.am renders its tables on the client, so a headless browser is the main path.
    use_playwright: bool = True
    refresh_interval_seconds: int = 600
    stale_after_seconds: int = 1800
    min_refresh_gap_seconds: int = 20
    request_timeout_seconds: float = 20.0
    scrape_timeout_seconds: float = 75.0

    points_file: Path = BASE_DIR / "data" / "exchange_points.json"
    cache_file: Path = BASE_DIR / "data" / "rates_cache.json"

    # Telegram bot (optional): without a token only the API/Mini App runs
    bot_token: str = ""
    # Public HTTPS URL of the Mini App — adds the "open app" button and the chat menu button
    webapp_url: str = ""

    cors_origins: str = "*"
    log_level: str = "INFO"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()] or ["*"]


settings = Settings()
