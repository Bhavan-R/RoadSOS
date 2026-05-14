"""Phone number normalization and validation.

OSM data contains phone numbers in many formats: "+91 80 26303050", "080-26303050",
"08026303050", "+91-80 2630 3050 ext.123", "+91 80 26303050; +91 80 26303051".

For the `tel:` link to work reliably we need a single, clean number. We also want
to dedupe contacts that share a phone in different formattings.
"""
from __future__ import annotations

import re
from typing import Optional

try:
    import phonenumbers
    from phonenumbers import NumberParseException, PhoneNumberFormat
    _HAS_PN = True
except ImportError:
    _HAS_PN = False


_EXT_RE = re.compile(r"\s*(?:ext|extension|x)\.?\s*\d+.*$", re.IGNORECASE)
_BASIC_CLEAN_RE = re.compile(r"[^\d+]")


def normalize_phone(raw: Optional[str], default_region: Optional[str] = None) -> Optional[str]:
    """Return a clean, dialable phone string, or None if input is empty.

    If `phonenumbers` is installed and the input parses to a valid number, we
    return its international format. Otherwise we fall back to stripping
    decorative characters.
    """
    if not raw or not isinstance(raw, str):
        return None

    # Remove "ext 123" suffixes — tel: links cannot dial them anyway
    cleaned = _EXT_RE.sub("", raw).strip()
    # If multiple numbers are listed, take the first
    cleaned = re.split(r"[;,/]", cleaned)[0].strip()
    if not cleaned:
        return None

    if _HAS_PN:
        try:
            parsed = phonenumbers.parse(cleaned, default_region)
            if phonenumbers.is_valid_number(parsed):
                return phonenumbers.format_number(parsed, PhoneNumberFormat.INTERNATIONAL)
        except NumberParseException:
            pass

    fallback = _BASIC_CLEAN_RE.sub("", cleaned)
    return fallback or None


def to_tel_href(phone: Optional[str]) -> Optional[str]:
    """Build a tel: URI value (no spaces, plus prefix preserved)."""
    if not phone:
        return None
    digits = _BASIC_CLEAN_RE.sub("", phone)
    return digits or None


def is_dialable(phone: Optional[str]) -> bool:
    """Heuristic check that a phone string is plausible to dial.

    Range 3-15 digits per ITU-T E.164. Short 3-4 digit numbers are kept
    valid because national emergency lines (108, 112, 911, 000) fall in
    that range — losing them would be worse than admitting false positives.
    """
    if not phone:
        return False
    digits = re.sub(r"[^\d]", "", phone)
    return 3 <= len(digits) <= 15


def phones_match(a: Optional[str], b: Optional[str]) -> bool:
    """Two phone strings match if their dialable digits match (last 10 digits)."""
    if not a or not b:
        return False
    da = re.sub(r"[^\d]", "", a)
    db = re.sub(r"[^\d]", "", b)
    if not da or not db:
        return False
    return da[-10:] == db[-10:]
