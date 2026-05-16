"""Tests for the search orchestrator's defensive logic.

These tests verify that the orchestrator never crashes on bad input, and that
the response shape is always valid even when upstreams fail or return junk.
"""

from services.search_service import deduplicate


class TestDeduplicate:
    def test_empty_input(self):
        assert deduplicate([]) == []

    def test_drops_invalid_dict(self):
        result = deduplicate(
            [
                {"name": "Apollo Hospital", "phone": None},
                "not a dict",
                123,
                None,
            ]
        )
        assert len(result) == 1

    def test_drops_empty_name(self):
        result = deduplicate(
            [
                {"name": "", "phone": None},
                {"name": "   ", "phone": None},
                {"name": "Real Hospital", "phone": None},
            ]
        )
        assert len(result) == 1
        assert result[0]["name"] == "Real Hospital"

    def test_case_insensitive_name_dedup(self):
        result = deduplicate(
            [
                {"name": "Apollo Hospital", "phone": None},
                {"name": "apollo hospital", "phone": None},
                {"name": "  APOLLO HOSPITAL  ", "phone": None},
            ]
        )
        assert len(result) == 1

    def test_phone_dedup_across_different_names(self):
        # Same hospital tagged twice with different names but same phone
        result = deduplicate(
            [
                {"name": "Apollo Bengaluru", "phone": "+91 80 26303050"},
                {"name": "Apollo Hospital BTM", "phone": "918026303050"},
            ]
        )
        assert len(result) == 1

    def test_keeps_distinct_contacts(self):
        result = deduplicate(
            [
                {"name": "Apollo Hospital", "phone": "+91 80 26303050"},
                {"name": "Manipal Hospital", "phone": "+91 80 22227777"},
            ]
        )
        assert len(result) == 2
