import json
import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse

offline_router = APIRouter()

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "emergency_seed.json")


def _load_seed() -> list[dict]:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@offline_router.get("/offline-pack")
async def get_offline_pack():
    data = _load_seed()
    return JSONResponse(content=data)
