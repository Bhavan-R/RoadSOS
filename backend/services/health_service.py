"""Health, readiness, and operational stats endpoint."""
from __future__ import annotations

import os
import time

from fastapi import APIRouter

from services.cache import geocode_cache, google_cache, overpass_cache

health_router = APIRouter()
_START_TIME = time.monotonic()


@health_router.get("/health", summary="Health, configuration, and cache stats")
async def health():
    uptime = time.monotonic() - _START_TIME
    return {
        "status": "ok",
        "service": "RoadSOS API",
        "uptime_seconds": round(uptime, 1),
        "configured": {
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "google_places": bool(os.getenv("GOOGLE_PLACES_API_KEY")),
        },
        "cache": {
            "overpass": overpass_cache.stats(),
            "google_places": google_cache.stats(),
            "geocode": geocode_cache.stats(),
        },
    }
