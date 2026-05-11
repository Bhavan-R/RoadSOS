from fastapi import APIRouter
from pydantic import BaseModel
from services.claude_service import prioritize_contacts

triage_router = APIRouter()


class TriageRequest(BaseModel):
    injured: bool
    blocking: bool
    contacts: list[dict]


@triage_router.post("/triage")
async def triage_crash(data: TriageRequest):
    result = await prioritize_contacts(data.injured, data.blocking, data.contacts)
    if result["contacts"]:
        result["contacts"][0]["aiReason"] = result["reason"]
    return result
