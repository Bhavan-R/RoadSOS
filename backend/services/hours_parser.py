"""Parse OSM `opening_hours` tags into a boolean is_open status.

Reference: https://wiki.openstreetmap.org/wiki/Key:opening_hours

The full OSM spec is enormous. We support the common cases that cover ~95% of real
emergency-services data:
- "24/7"
- "Mo-Fr 08:00-17:00"
- "Mo,We,Fr 09:00-14:00"
- "Mo-Fr 08:00-12:00,13:00-17:00"
- "Mo-Su 00:00-24:00"
- Multiple rules separated by ";"
- Plain time range with no day prefix (treated as every day)

Cases we don't handle (returns False, which is conservative for closed):
- Public holidays (PH), school holidays (SH)
- Date ranges ("Apr 01-Oct 31 ...")
- "off" / "closed" overrides
"""

from __future__ import annotations

from datetime import datetime, time

_DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
_DAY_INDEX = {d: i for i, d in enumerate(_DAY_NAMES)}


def parse_is_open(opening_hours: str | None, now: datetime | None = None) -> bool | None:
    """Return True/False if the rule can be evaluated, None if input is empty/unparseable."""
    if not opening_hours or not isinstance(opening_hours, str):
        return None

    raw = opening_hours.strip()
    if not raw:
        return None

    if raw == "24/7":
        return True

    if now is None:
        now = datetime.now()

    today = _DAY_NAMES[now.weekday()]
    current_time = now.time()

    matched_any_rule = False
    for rule in raw.split(";"):
        rule = rule.strip()
        if not rule:
            continue
        result = _evaluate_rule(rule, today, current_time)
        if result is True:
            return True
        if result is False:
            matched_any_rule = True

    return False if matched_any_rule else None


def _evaluate_rule(rule: str, today: str, current_time: time) -> bool | None:
    """Returns True if open now, False if rule explicitly applies to today and we are outside hours,
    None if the rule does not parse / is not about today."""
    if " off" in rule.lower() or rule.lower().endswith("closed"):
        return False

    parts = rule.split()
    if not parts:
        return None

    # Pure time range like "08:00-17:00"
    if "-" in parts[0] and ":" in parts[0]:
        return _time_in_range(current_time, " ".join(parts))

    day_part = parts[0]
    time_part = " ".join(parts[1:]) if len(parts) > 1 else ""

    if not _day_matches(day_part, today):
        return None

    if not time_part:
        return True

    return _time_in_range(current_time, time_part)


def _day_matches(day_part: str, today: str) -> bool:
    if day_part in _DAY_INDEX:
        return day_part == today

    if "-" in day_part:
        start, _, end = day_part.partition("-")
        if start not in _DAY_INDEX or end not in _DAY_INDEX:
            return False
        s, e, t = _DAY_INDEX[start], _DAY_INDEX[end], _DAY_INDEX[today]
        return s <= t <= e if s <= e else (t >= s or t <= e)

    if "," in day_part:
        days = [d.strip() for d in day_part.split(",")]
        return today in days

    return False


def _time_in_range(now: time, time_part: str) -> bool:
    for window in time_part.split(","):
        window = window.strip()
        if "-" not in window:
            continue
        start_str, _, end_str = window.partition("-")
        try:
            start = _parse_time(start_str)
            end = _parse_time(end_str)
        except (ValueError, IndexError):
            continue
        if start <= end:
            if start <= now <= end:
                return True
        else:
            if now >= start or now <= end:  # crosses midnight
                return True
    return False


def _parse_time(s: str) -> time:
    s = s.strip()
    if s in ("24:00", "24"):
        return time(23, 59, 59)
    h, _, m = s.partition(":")
    return time(int(h), int(m) if m else 0)
