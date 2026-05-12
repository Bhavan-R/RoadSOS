"""POST /triage router · invokes AI triage and stamps the reason on the top card."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.ai_triage import prioritize_contacts

triage_router = APIRouter()


class TriageRequest(BaseModel):
    injured: bool = Field(..., description="True if anyone is injured")
    blocking: bool = Field(..., description="True if the vehicle is blocking traffic")
    contacts: list[dict] = Field(default_factory=list, description="Contact list from /search")


@triage_router.post("/triage", summary="Prioritise contacts by situation")
async def triage_crash(data: TriageRequest):
    result = await prioritize_contacts(data.injured, data.blocking, data.contacts)
    if result["contacts"]:
        result["contacts"][0] = {**result["contacts"][0], "aiReason": result["reason"]}
    return result
