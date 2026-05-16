"""GET /offline-pack · serves the bundled 59-country emergency number database.

Sets a long cache header so the Service Worker stores it for a week.
"""

from __future__ import annotations

import json
import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

offline_router = APIRouter()

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "emergency_seed.json")
_CACHED: list[dict] | None = None


def _load_seed() -> list[dict]:
    global _CACHED
    if _CACHED is None:
        with open(_DATA_PATH, encoding="utf-8") as f:
            _CACHED = json.load(f)
    return _CACHED


@offline_router.get("/offline-pack", summary="Bundled 59-country emergency numbers")
async def get_offline_pack():
    data = _load_seed()
    return JSONResponse(
        content=data,
        headers={"Cache-Control": "public, max-age=604800, immutable"},
    )
