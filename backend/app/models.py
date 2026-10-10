from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Currency = Literal["USD", "EUR", "RUB"]


class Rate(BaseModel):
    buy: Optional[float] = None
    sell: Optional[float] = None


class Address(BaseModel):
    ru: str = ""
    en: str = ""


class ExchangePoint(BaseModel):
    """A point described manually in data/exchange_points.json."""

    id: str
    name: str
    type: Literal["bank", "exchange"] = "bank"
    address: Optional[Address] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    maps_url: Optional[str] = None
    phone: Optional[str] = None
    aliases: list[str] = Field(default_factory=list)
    seed_rates: dict[str, Rate] = Field(default_factory=dict)


class PointOut(BaseModel):
    id: str
    name: str
    type: Literal["bank", "exchange"]
    address: Optional[Address] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    maps_url: str
    phone: Optional[str] = None
    rates: dict[str, Rate] = Field(default_factory=dict)
    rate_updated_at: Optional[str] = None
    known: bool = True


class RatesResponse(BaseModel):
    source: Literal["live", "cache", "seed"]
    stale: bool
    updated_at: Optional[datetime] = None
    fetched_at: datetime
    error: Optional[str] = None
    points: list[PointOut]
