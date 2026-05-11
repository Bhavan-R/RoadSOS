import os
import json
from anthropic import AsyncAnthropic

_client = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


SYSTEM_PROMPT = """You are an emergency response prioritisation system for road accidents.
Given a crash situation and nearby emergency services, return ONLY a JSON object with two keys:
- "contacts": the same contacts array reordered by priority for this specific situation
- "reason": one sentence (max 15 words) explaining why the top contact was chosen

Priority logic:
- Injured people → ambulance or hospital first, police second, towing third
- Vehicle blocking road → keep police in top 3 regardless of injury status
- No injury, vehicle stuck → police first, then towing/repair
- Always include all contacts in output, just reorder them

Respond with valid JSON only. No text outside the JSON object."""


def rule_based_triage(injured: bool, blocking: bool, contacts: list[dict]) -> dict:
    ORDERS = {
        "injured": ["ambulance", "hospital", "police", "repair", "towing", "tyre"],
        "blocking": ["police", "ambulance", "hospital", "repair", "towing", "tyre"],
        "stuck": ["police", "repair", "towing", "tyre", "hospital", "ambulance"],
        "default": ["police", "hospital", "ambulance", "repair", "towing", "tyre"],
    }

    if injured:
        order = ORDERS["injured"]
        reason = "Trauma care prioritised · ambulance and hospital listed first"
    elif blocking:
        order = ORDERS["blocking"]
        reason = "Vehicle blocking traffic · police and towing listed first"
    else:
        order = ORDERS["stuck"]
        reason = "No injuries reported · police and repair services listed first"

    def priority(c: dict) -> tuple:
        cat = c.get("category", "")
        idx = order.index(cat) if cat in order else 99
        return (idx, c.get("distance", 9999))

    return {
        "contacts": sorted(contacts, key=priority),
        "reason": reason,
    }


async def prioritize_contacts(injured: bool, blocking: bool, contacts: list[dict]) -> dict:
    if not contacts:
        return {"contacts": [], "reason": "No nearby services found"}

    try:
        situation_parts = []
        if injured:
            situation_parts.append("people are injured and need medical attention")
        if blocking:
            situation_parts.append("the vehicle is blocking the road")
        if not situation_parts:
            situation_parts.append("no injuries, vehicle may need roadside assistance")

        situation = "; ".join(situation_parts)

        summary = [
            {"name": c["name"], "category": c["category"], "distance_km": c["distance"]}
            for c in contacts
        ]

        user_message = f"""Situation: {situation}.

Nearby services (currently sorted by distance only):
{json.dumps(summary, indent=2)}

Full contact data to reorder:
{json.dumps(contacts, indent=2)}"""

        response = await get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        result = json.loads(response.content[0].text)
        if "contacts" not in result or "reason" not in result:
            raise ValueError("Malformed Claude response")
        return result

    except Exception:
        return rule_based_triage(injured, blocking, contacts)
