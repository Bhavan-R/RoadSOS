"""Country code validation tests for the geocoder."""
from services.geocoder import _validate_country_code


class TestValidateCountryCode:
    def test_valid_iso(self):
        assert _validate_country_code("IN") == "IN"
        assert _validate_country_code("US") == "US"
        assert _validate_country_code("DE") == "DE"

    def test_lowercase_normalized(self):
        assert _validate_country_code("in") == "IN"
        assert _validate_country_code("us") == "US"

    def test_whitespace_stripped(self):
        assert _validate_country_code(" IN ") == "IN"

    def test_invalid_returns_none(self):
        assert _validate_country_code(None) is None
        assert _validate_country_code("") is None
        assert _validate_country_code("INDIA") is None  # too long
        assert _validate_country_code("I") is None      # too short
        assert _validate_country_code("12") is None     # not alpha
        assert _validate_country_code("I3") is None     # mixed
