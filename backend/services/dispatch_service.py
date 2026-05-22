"""POST /dispatch-summary · spoken summary the user can read to a dispatcher.

When the user is on a call with 112, instead of fumbling through a description,
they read this short, factual, dispatcher-friendly summary.

AI-generated via Gemini 2.0 Flash when API is configured, deterministic template
otherwise. Either path returns the same response shape so the UI never branches.
"""

from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.gemini_utils import extract_gemini_text

logger = logging.getLogger(__name__)

dispatch_router = APIRouter()

MODEL = "gemini-2.0-flash"
MAX_TOKENS = 300
TIMEOUT_S = 12.0

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
)

SYSTEM_PROMPT = """You are RoadSOS Dispatch Helper.

Produce a short factual summary (3 short sentences, max 60 words total) that the caller
can read out loud to an emergency dispatcher on the phone.

Required structure:
1. Open with "Road accident at [LANDMARK]."
2. State injury status.
3. State vehicle position (blocking / not blocking road).
4. State GPS coordinates precisely.
5. End with "Calling from RoadSOS."

Return ONLY the spoken summary text. No quotes. No markdown. Use period-separated
sentences with clear pauses. Avoid abbreviations except "GPS"."""


class DispatchRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    landmark: str | None = None
    injured: bool = False
    blocking: bool = False


def _template_summary(req: DispatchRequest) -> str:
    landmark = req.landmark or f"GPS coordinates {req.lat:.5f}, {req.lon:.5f}"
    injury = "One or more people are injured" if req.injured else "No injuries reported"
    blocking = "vehicle is blocking the road" if req.blocking else "vehicle is clear of the road"
    return (
        f"Road accident at {landmark}. {injury}; the {blocking}. "
        f"GPS coordinates {req.lat:.5f}, {req.lon:.5f}. Calling from RoadSOS."
    )


@dispatch_router.post("/dispatch-summary", summary="Generate a dispatcher-friendly spoken summary")
async def dispatch_summary(req: DispatchRequest):
    fallback = _template_summary(req)
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return {"summary": fallback, "source": "template"}

    try:
        payload_data = {
            "landmark": req.landmark or f"{req.lat:.5f}, {req.lon:.5f}",
            "injured": req.injured,
            "blocking_road": req.blocking,
            "lat": req.lat,
            "lon": req.lon,
        }
        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"Situation: {json.dumps(payload_data)}"}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": MAX_TOKENS,
            },
        }

        url = GEMINI_URL.format(model=MODEL, key=api_key)
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            response_json = r.json()

        summary = extract_gemini_text(response_json)
        if not summary:
            raise ValueError("Empty AI summary")
        return {"summary": summary, "source": "ai"}
    except Exception as exc:
        logger.warning(f"Dispatch summary AI failed ({type(exc).__name__}) · template fallback")
        return {"summary": fallback, "source": "template"}
