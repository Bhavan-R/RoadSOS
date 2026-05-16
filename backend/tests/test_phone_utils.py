from services.phone_utils import (
    is_dialable,
    normalize_phone,
    phones_match,
    to_tel_href,
)


class TestNormalizePhone:
    def test_none_input(self):
        assert normalize_phone(None) is None

    def test_empty_string(self):
        assert normalize_phone("") is None

    def test_whitespace_only(self):
        assert normalize_phone("   ") is None

    def test_basic_indian_number(self):
        result = normalize_phone("+91 80 26303050", "IN")
        # Either phonenumbers-formatted or basic-cleaned
        assert result is not None
        assert "9180" in result or "+9180" in result.replace(" ", "")

    def test_drops_extension(self):
        result = normalize_phone("+91 80 26303050 ext 123", "IN")
        assert result is not None
        assert "123" not in result.split()[-1] or "ext" not in result.lower()

    def test_first_of_multiple(self):
        result = normalize_phone("+91 80 26303050; +91 80 26303051", "IN")
        assert result is not None
        # Last digit should be 0, not 1
        digits = [c for c in result if c.isdigit()]
        assert digits[-1] == "0"

    def test_non_string_input(self):
        assert normalize_phone(12345) is None  # type: ignore


class TestToTelHref:
    def test_strips_decoration(self):
        assert to_tel_href("+91 80 2630-3050") == "+918026303050"

    def test_none(self):
        assert to_tel_href(None) is None


class TestIsDialable:
    def test_short_emergency_number(self):
        assert is_dialable("108") is True

    def test_normal_number(self):
        assert is_dialable("+91 80 26303050") is True

    def test_too_short(self):
        assert is_dialable("12") is False

    def test_too_long(self):
        assert is_dialable("1234567890123456") is False

    def test_none(self):
        assert is_dialable(None) is False


class TestPhonesMatch:
    def test_same_number_different_format(self):
        assert phones_match("+91-80-26303050", "918026303050") is True

    def test_different_numbers(self):
        assert phones_match("+91 80 26303050", "+91 80 26303051") is False

    def test_none_input(self):
        assert phones_match(None, "+91 80 26303050") is False
        assert phones_match("+91 80 26303050", None) is False
