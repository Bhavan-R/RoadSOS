"""Shared helpers for Gemini API integration.

Centralises response parsing so ai_triage and dispatch_service stay in sync.
"""

from __future__ import annotations


def extract_gemini_text(response_json: dict) -> str:
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
