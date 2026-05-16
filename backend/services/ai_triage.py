"""AI-driven contact prioritisation.

Uses Google's Gemini 2.0 Flash for situation-aware reordering. Always falls
back to a deterministic rule-based ordering if the API is unreachable, errors,
or returns malformed output. The fallback produces the same response shape so
the frontend never sees a difference.

Why fallback matters: emergency software cannot have its core feature dependent
on a 3rd-party API.

Why Gemini Flash: free tier (60 RPM, 1500 RPD on 2.0-flash, 15 RPM on 1.5-flash),
low latency, JSON-mode supported, no billing required to start.
"""

from __future__ import annotations

import json
import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

# Gemini 2.0 Flash — current free-tier default with the highest free quota.
MODEL = "gemini-2.0-flash"
MAX_TOKENS = 2048
TIMEOUT_S = 15.0

# REST endpoint (no SDK dependency — keeps requirements lean and matches our
# existing httpx-everywhere style).
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
)

SYSTEM_PROMPT = """You are RoadSOS Triage — an emergency dispatcher AI for road accidents.

Your only job: take a crash situation and a list of nearby emergency services,
return a JSON object that reorders the services by priority for that specific
situation.

OUTPUT REQUIREMENTS (strict):
- Return ONLY a JSON object. No prose. No markdown fences. No commentary.
- The object MUST have exactly two keys: "contacts" and "reason".
- "contacts" MUST be the same array of objects you were given, with all fields
  preserved verbatim, just reordered. Never invent contacts. Never drop them.
- "reason" MUST be a single sentence, maximum 18 words, plain English,
  explaining why the top contact was chosen for this situation.

PRIORITY RULES (in strict order):
1. Injured + vehicle blocking road  → ambulance → hospital → police → towing → repair
2. Injured + no road block          → ambulance → hospital → police → repair
3. Not injured + blocking road      → police → towing → repair → tyre
4. Not injured + no block           → repair → tyre → police → towing

Within a priority tier, the closer service wins."""


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def rule_based_triage(injured: bool, blocking: bool, contacts: list[dict]) -> dict:
    """Deterministic ordering used as fallback and as a baseline for tests."""
    if injured and blocking:
        order = ["ambulance", "hospital", "police", "towing", "repair", "tyre"]
        reason = "Trauma care plus blocked road · ambulance, hospital, police listed first"
    elif injured:
        order = ["ambulance", "hospital", "police", "repair", "towing", "tyre"]
        reason = "Trauma care prioritised · ambulance and hospital listed first"
    elif blocking:
        order = ["police", "towing", "ambulance", "hospital", "repair", "tyre"]
        reason = "Vehicle blocking traffic · police and towing listed first"
    else:
        order = ["repair", "tyre", "police", "towing", "hospital", "ambulance"]
        reason = "No injuries reported · roadside repair services listed first"

    def priority(c: dict) -> tuple:
        cat = c.get("category", "")
        idx = order.index(cat) if cat in order else 99
        return (idx, c.get("distance", 9999))

    return {
        "contacts": sorted(contacts, key=priority),
        "reason": reason,
    }


def _validate_ai_result(result: object, original_count: int) -> dict | None:
    """Return the result if it matches the contract, else None."""
    if not isinstance(result, dict):
        return None
    if "contacts" not in result or "reason" not in result:
        return None
    if not isinstance(result["contacts"], list):
        return None
    if not isinstance(result["reason"], str) or not result["reason"].strip():
        return None
    if len(result["contacts"]) != original_count:
        return None
    return result


def _extract_gemini_text(response_json: dict) -> str:
    """Pull the model's text response out of Gemini's nested envelope.

    Gemini returns:
      { "candidates": [
          { "content": { "parts": [ { "text": "..." } ] } }
      ] }
    """
    candidates = response_json.get("candidates") or []
    if not candidates:
        return ""
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    if not parts:
        return ""
    return (parts[0].get("text") or "").strip()


async def prioritize_contacts(injured: bool, blocking: bool, contacts: list[dict]) -> dict:
    if not contacts:
        return {"contacts": [], "reason": "No nearby services found"}

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.info("GEMINI_API_KEY not set — using rule-based triage")
        return rule_based_triage(injured, blocking, contacts)

    try:
        situation = []
        if injured:
            situation.append("PEOPLE ARE INJURED and need medical attention")
        if blocking:
            situation.append("THE VEHICLE IS BLOCKING THE ROAD")
        if not situation:
            situation.append("no injuries, vehicle may need roadside assistance")
        situation_text = "; ".join(situation)

        summary = [
            {
                "name": c.get("name", "?"),
                "category": c.get("category", "?"),
                "distance_km": c.get("distance", "?"),
            }
            for c in contacts
        ]

        user_message = (
            f"SITUATION: {situation_text}.\n\n"
            f"Services found nearby (currently sorted by distance only):\n"
            f"{json.dumps(summary, indent=2)}\n\n"
            f"Full contact data to reorder (return ALL of these, "
            f"just in the priority order you decide):\n"
            f"{json.dumps(contacts, indent=2)}"
        )

        # Gemini puts the system prompt in `systemInstruction`, not in messages.
        # JSON mode is opt-in via responseMimeType.
        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [
                {"role": "user", "parts": [{"text": user_message}]},
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": MAX_TOKENS,
                "responseMimeType": "application/json",
            },
        }

        url = GEMINI_URL.format(model=MODEL, key=api_key)
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            response_json = r.json()

        raw = _extract_gemini_text(response_json)
        if not raw:
            logger.warning("AI returned empty response · using rule-based fallback")
            return rule_based_triage(injured, blocking, contacts)

        cleaned = _FENCE_RE.sub("", raw).strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("AI returned non-JSON · using rule-based fallback")
            return rule_based_triage(injured, blocking, contacts)

        validated = _validate_ai_result(parsed, len(contacts))
        if validated is None:
            logger.warning("AI returned malformed response · using rule-based fallback")
            return rule_based_triage(injured, blocking, contacts)

        return validated

    except Exception as exc:
        logger.warning(f"AI triage call failed ({type(exc).__name__}) · using rule-based fallback")
        return rule_based_triage(injured, blocking, contacts)
