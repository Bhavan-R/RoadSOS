from datetime import datetime

from services.hours_parser import parse_is_open


class TestParseIsOpen:
    def test_none_input(self):
        assert parse_is_open(None) is None

    def test_empty_string(self):
        assert parse_is_open("") is None

    def test_24_7(self):
        assert parse_is_open("24/7") is True

    def test_monday_open(self):
        # Monday at 10:00
        now = datetime(2026, 5, 11, 10, 0)  # Mon
        assert parse_is_open("Mo-Fr 08:00-17:00", now) is True

    def test_monday_closed_too_early(self):
        now = datetime(2026, 5, 11, 7, 0)  # Mon 07:00
        assert parse_is_open("Mo-Fr 08:00-17:00", now) is False

    def test_saturday_outside_weekday_rule(self):
        now = datetime(2026, 5, 16, 10, 0)  # Saturday
        assert parse_is_open("Mo-Fr 08:00-17:00", now) is None

    def test_split_window(self):
        now = datetime(2026, 5, 11, 13, 30)  # Mon 13:30 (lunch break)
        # Window: 08:00-12:00 + 14:00-17:00 → closed at 13:30
        assert parse_is_open("Mo-Fr 08:00-12:00,14:00-17:00", now) is False

    def test_split_window_open(self):
        now = datetime(2026, 5, 11, 15, 0)  # Mon 15:00
        assert parse_is_open("Mo-Fr 08:00-12:00,14:00-17:00", now) is True

    def test_multiple_rules(self):
        # Mo-Fr business + Sa morning only
        rule = "Mo-Fr 09:00-18:00; Sa 09:00-13:00"
        sat_morning = datetime(2026, 5, 16, 10, 0)
        sat_afternoon = datetime(2026, 5, 16, 15, 0)
        assert parse_is_open(rule, sat_morning) is True
        assert parse_is_open(rule, sat_afternoon) is False

    def test_day_list(self):
        # Open Mon, Wed, Fri
        now_wed = datetime(2026, 5, 13, 10, 0)
        now_tue = datetime(2026, 5, 12, 10, 0)
        assert parse_is_open("Mo,We,Fr 08:00-17:00", now_wed) is True
        assert parse_is_open("Mo,We,Fr 08:00-17:00", now_tue) is None

    def test_garbage_input(self):
        # Should not crash; returns None or False
        result = parse_is_open("this is not valid OSM hours")
        assert result in (None, False)
