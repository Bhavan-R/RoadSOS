"""Tests for the rule-based fallback in ai_triage.

We don't test the Gemini API call here — that requires a live API key and
network. The fallback is the safety net that guarantees a working response
shape even if the model is unreachable, errors, or returns malformed JSON.
If the fallback is correct, the API call merely improves the ordering —
it doesn't change correctness.
"""

from services.ai_triage import (
    _extract_gemini_text,
    _validate_ai_result,
    rule_based_triage,
)

CONTACTS = [
    {"id": "1", "name": "Apollo Hospital", "category": "hospital", "distance": 2.3},
    {"id": "2", "name": "BTM Police Station", "category": "police", "distance": 0.8},
    {"id": "3", "name": "108 Ambulance", "category": "ambulance", "distance": 1.5},
    {"id": "4", "name": "Singh Garage", "category": "repair", "distance": 0.3},
    {"id": "5", "name": "Wheels Tyre Shop", "category": "tyre", "distance": 0.5},
]


class TestRuleBasedTriage:
    def test_injured_and_blocking_puts_ambulance_first(self):
        result = rule_based_triage(injured=True, blocking=True, contacts=CONTACTS)
        assert result["contacts"][0]["category"] == "ambulance"
        assert "trauma" in result["reason"].lower() or "blocked" in result["reason"].lower()

    def test_injured_only_puts_ambulance_first(self):
        result = rule_based_triage(injured=True, blocking=False, contacts=CONTACTS)
        assert result["contacts"][0]["category"] == "ambulance"

    def test_blocking_only_puts_police_first(self):
        result = rule_based_triage(injured=False, blocking=True, contacts=CONTACTS)
        assert result["contacts"][0]["category"] == "police"

    def test_neither_puts_repair_first(self):
        result = rule_based_triage(injured=False, blocking=False, contacts=CONTACTS)
        assert result["contacts"][0]["category"] in ("repair", "tyre")

    def test_preserves_all_contacts(self):
        result = rule_based_triage(injured=True, blocking=True, contacts=CONTACTS)
        assert len(result["contacts"]) == len(CONTACTS)
        ids = {c["id"] for c in result["contacts"]}
        assert ids == {c["id"] for c in CONTACTS}

    def test_empty_contacts(self):
        # rule_based_triage is called from prioritize_contacts which short-circuits,
        # but tested directly here it should still work.
        result = rule_based_triage(injured=True, blocking=True, contacts=[])
        assert result["contacts"] == []

    def test_reason_present_and_non_empty(self):
        result = rule_based_triage(injured=True, blocking=False, contacts=CONTACTS)
        assert isinstance(result["reason"], str)
        assert len(result["reason"]) > 0

    def test_distance_tiebreaker_within_tier(self):
        # Two hospitals at different distances should be ordered by distance
        contacts = [
            {"id": "a", "name": "Far Hospital", "category": "hospital", "distance": 5.0},
            {"id": "b", "name": "Near Hospital", "category": "hospital", "distance": 1.0},
        ]
        result = rule_based_triage(injured=True, blocking=False, contacts=contacts)
        assert result["contacts"][0]["id"] == "b"


class TestValidateAiResult:
    def test_valid(self):
        original_count = 3
        result = {
            "contacts": [{"id": str(i)} for i in range(3)],
            "reason": "test reason",
        }
        assert _validate_ai_result(result, original_count) == result

    def test_missing_contacts_key(self):
        assert _validate_ai_result({"reason": "x"}, 3) is None

    def test_missing_reason_key(self):
        assert _validate_ai_result({"contacts": [1, 2, 3]}, 3) is None

    def test_wrong_count(self):
        result = {"contacts": [1, 2], "reason": "x"}
        assert _validate_ai_result(result, 3) is None

    def test_not_a_dict(self):
        assert _validate_ai_result("not a dict", 3) is None
        assert _validate_ai_result([1, 2, 3], 3) is None

    def test_empty_reason(self):
        result = {"contacts": [{"id": "x"}], "reason": ""}
        assert _validate_ai_result(result, 1) is None


class TestExtractGeminiText:
    """Gemini wraps the model's response in a nested envelope; we have to
    dig text out of candidates[0].content.parts[0].text and tolerate every
    way the envelope can be incomplete."""

    def test_happy_path(self):
        response = {"candidates": [{"content": {"parts": [{"text": "  hello world  "}]}}]}
        assert _extract_gemini_text(response) == "hello world"

    def test_no_candidates(self):
        assert _extract_gemini_text({"candidates": []}) == ""
        assert _extract_gemini_text({}) == ""

    def test_no_content(self):
        assert _extract_gemini_text({"candidates": [{}]}) == ""

    def test_no_parts(self):
        response = {"candidates": [{"content": {"parts": []}}]}
        assert _extract_gemini_text(response) == ""

    def test_no_text_field(self):
        response = {"candidates": [{"content": {"parts": [{}]}}]}
        assert _extract_gemini_text(response) == ""

    def test_explicit_none_values(self):
        # Defensive: real API responses can carry explicit nulls.
        response = {"candidates": [{"content": {"parts": [{"text": None}]}}]}
        assert _extract_gemini_text(response) == ""
