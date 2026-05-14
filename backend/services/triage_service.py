"""POST /triage router · invokes AI triage and stamps the reason on the top card.

Reliability hardening:
- Strict request validation — empty contacts list returns empty result, not 500
- All exceptions absorbed by rule-based fallback inside prioritize_contacts
- Rate-limited per IP
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from services.ai_triage import prioritize_contacts
from services.rate_limiter import get_client_ip, triage_limiter

logger = logging.getLogger(__name__)

triage_router = APIRouter()


class TriageRequest(BaseModel):
    injured: bool = Field(..., description="True if anyone is injured")
    blocking: bool = Field(..., description="True if the vehicle is blocking traffic")
    contacts: list[dict] = Field(default_factory=list, description="Contact list from /search")


async def _check_rate_limit(request: Request) -> None:
    await triage_limiter.check(get_client_ip(request))


@triage_router.post(
    "/triage",
    summary="Prioritise contacts by situation",
    description=(
        "Reorders the contact list using Anthropic Claude Haiku 4.5 based on "
        "whether anyone is injured and whether the vehicle is blocking traffic. "
        "If the AI call fails or returns malformed output, the system falls "
        "back to a deterministic rule-based prioritisation matrix — the "
        "frontend never sees a difference in response shape."
    ),
)
async def triage_crash(
    data: TriageRequest,
    _: None = Depends(_check_rate_limit),
):
    # Defensive: empty contacts must return a valid empty response, not crash
    if not data.contacts:
        return {"contacts": [], "reason": "No contacts to prioritise."}

    try:
        result = await prioritize_contacts(data.injured, data.blocking, data.contacts)
    except Exception as exc:
        # prioritize_contacts has its own fallback chain, but ultra-defensive
        # in case something unexpected escapes (e.g. malformed contact dicts)
        logger.warning("Triage failure absorbed: %s: %s", type(exc).__name__, exc)
        return {
            "contacts": data.contacts,
            "reason": "Sorted by distance (AI temporarily unavailable).",
        }

    # Stamp the AI reason on the top card so the frontend can show the banner
    if result.get("contacts"):
        result["contacts"][0] = {**result["contacts"][0], "aiReason": result.get("reason", "")}
    return result
