"""Tests for the pure parsing logic of overpass_service.

We test the parsing/classification logic with hand-crafted OSM response
fragments — no network calls.
"""
from services.overpass_service import (
    haversine,
    classify_element,
    parse_element,
    _dedupe_by_name,
    build_overpass_query,
)


class TestHaversine:
    def test_zero_distance(self):
        assert haversine(12.9716, 77.5946, 12.9716, 77.5946) == 0.0

    def test_bengaluru_to_mumbai_approx_840km(self):
        d = haversine(12.9716, 77.5946, 19.0760, 72.8777)
        assert 800 < d < 900

    def test_one_degree_lat_is_about_111km(self):
        d = haversine(0.0, 0.0, 1.0, 0.0)
        assert 110 < d < 112


class TestClassifyElement:
    def test_hospital(self):
        assert classify_element({"amenity": "hospital"}) == "hospital"

    def test_clinic_is_hospital_category(self):
        assert classify_element({"amenity": "clinic"}) == "hospital"

    def test_police(self):
        assert classify_element({"amenity": "police"}) == "police"

    def test_ambulance_station(self):
        assert classify_element({"emergency": "ambulance_station"}) == "ambulance"

    def test_fire_station_is_ambulance_category(self):
        assert classify_element({"amenity": "fire_station"}) == "ambulance"

    def test_car_repair(self):
        assert classify_element({"shop": "car_repair"}) == "repair"

    def test_tyres(self):
        assert classify_element({"shop": "tyres"}) == "tyre"

    def test_towing_recovery_service(self):
        assert classify_element({"service:vehicle:recovery": "yes"}) == "towing"

    def test_towing_tow_service(self):
        assert classify_element({"service:vehicle:tow": "yes"}) == "towing"

    def test_vehicle_recovery_amenity(self):
        assert classify_element({"amenity": "vehicle_recovery"}) == "towing"

    def test_car_showroom(self):
        assert classify_element({"shop": "car"}) == "showroom"

    def test_car_parts(self):
        assert classify_element({"shop": "car_parts"}) == "showroom"

    def test_unknown(self):
        assert classify_element({"amenity": "cafe"}) is None

    def test_no_tags(self):
        assert classify_element({}) is None


class TestParseElement:
    def test_minimal_node(self):
        element = {
            "id": 12345,
            "lat": 12.98,
            "lon": 77.60,
            "tags": {"amenity": "hospital", "name": "Apollo"},
        }
        result = parse_element(element, 12.97, 77.59)
        assert result is not None
        assert result["id"] == "osm_12345"
        assert result["name"] == "Apollo"
        assert result["category"] == "hospital"
        assert result["source"] == "OpenStreetMap"
        assert result["distance"] > 0
        assert result["isOpen"] is None
        assert result["phone"] is None

    def test_way_with_center(self):
        element = {
            "id": 999,
            "type": "way",
            "center": {"lat": 12.98, "lon": 77.60},
            "tags": {"amenity": "police", "name": "City Police"},
        }
        result = parse_element(element, 12.97, 77.59)
        assert result is not None
        assert result["category"] == "police"

    def test_name_fallback(self):
        element = {
            "id": 1,
            "lat": 12.98,
            "lon": 77.60,
            "tags": {"amenity": "hospital"},  # no name
        }
        result = parse_element(element, 12.97, 77.59)
        assert result is not None
        assert "Hospital" in result["name"]

    def test_phone_normalization(self):
        element = {
            "id": 1,
            "lat": 12.98,
            "lon": 77.60,
            "tags": {
                "amenity": "hospital",
                "name": "X",
                "phone": "+91-80-26303050",
            },
        }
        result = parse_element(element, 12.97, 77.59)
        assert result["phone"] is not None
        # Either international-formatted or basic-cleaned
        digits = "".join(c for c in result["phone"] if c.isdigit())
        assert digits.endswith("26303050")

    def test_opening_hours_24_7(self):
        element = {
            "id": 1,
            "lat": 12.98,
            "lon": 77.60,
            "tags": {
                "amenity": "hospital",
                "name": "X",
                "opening_hours": "24/7",
            },
        }
        result = parse_element(element, 12.97, 77.59)
        assert result["isOpen"] is True

    def test_no_coordinates_returns_none(self):
        element = {"id": 1, "tags": {"amenity": "hospital", "name": "X"}}
        assert parse_element(element, 12.97, 77.59) is None

    def test_non_emergency_tag_returns_none(self):
        element = {
            "id": 1,
            "lat": 12.98,
            "lon": 77.60,
            "tags": {"amenity": "cafe", "name": "Coffee Day"},
        }
        assert parse_element(element, 12.97, 77.59) is None


class TestDedupeByName:
    def test_removes_case_insensitive_duplicates(self):
        items = [
            {"name": "Apollo Hospital"},
            {"name": "apollo hospital"},
            {"name": "  APOLLO HOSPITAL  "},
            {"name": "City Hospital"},
        ]
        result = _dedupe_by_name(items)
        assert len(result) == 2


class TestBuildOverpassQuery:
    def test_query_contains_coordinates(self):
        q = build_overpass_query(12.9716, 77.5946, 5000)
        assert "12.9716" in q
        assert "77.5946" in q
        assert "5000" in q

    def test_query_includes_all_required_categories(self):
        q = build_overpass_query(0, 0, 5000)
        # Rulebook explicitly lists: police, hospitals, ambulance, towing,
        # puncture (tyre), and showrooms. All must be in the query.
        required = [
            "hospital",
            "police",
            "ambulance_station",
            "fire_station",
            "car_repair",
            "tyres",
            "service:vehicle:recovery",
            "service:vehicle:tow",
            "vehicle_recovery",
            "shop\"=\"car",  # showroom
        ]
        for tag_value in required:
            assert tag_value in q, f"missing {tag_value} in Overpass query"
