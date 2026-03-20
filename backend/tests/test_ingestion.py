"""Tests for the CBP ingestion service."""
import pytest
from app.services.ingestion import (
    parse_wait_minutes,
    parse_lanes_open,
    is_closed,
    normalize_cbp_record,
)


class TestParseWaitMinutes:
    def test_normal_integer(self):
        assert parse_wait_minutes("45") == 45

    def test_with_min_suffix(self):
        assert parse_wait_minutes("30 min") == 30

    def test_zero(self):
        assert parse_wait_minutes("0") == 0

    def test_na(self):
        assert parse_wait_minutes("N/A") is None

    def test_empty(self):
        assert parse_wait_minutes("") is None

    def test_none(self):
        assert parse_wait_minutes(None) is None

    def test_no_delay(self):
        assert parse_wait_minutes("no delay") is None

    def test_lanes_closed(self):
        assert parse_wait_minutes("Lanes Closed") is None

    def test_negative_clamps_to_zero(self):
        assert parse_wait_minutes("-5") == 0


class TestParseLanesOpen:
    def test_normal(self):
        assert parse_lanes_open(4) == 4

    def test_string_number(self):
        assert parse_lanes_open("3") == 3

    def test_none(self):
        assert parse_lanes_open(None) is None

    def test_invalid(self):
        assert parse_lanes_open("abc") is None


class TestIsClosed:
    def test_closed_string(self):
        assert is_closed("Lanes Closed", None) is True

    def test_zero_lanes(self):
        assert is_closed("0", 0) is True

    def test_normal(self):
        assert is_closed("30", 4) is False


class TestNormalizeCbpRecord:
    @pytest.fixture
    def port_map(self):
        return {"250401": 1}  # San Ysidro

    @pytest.fixture
    def lane_map(self):
        return {
            "standard_vehicle": 1,
            "sentri": 2,
            "ready_lane": 3,
            "pedestrian": 4,
            "pedestrian_ready": 5,
            "commercial": 6,
        }

    def test_known_port_produces_observations(self, port_map, lane_map):
        record = {
            "port_number": "250401",
            "date": "3/18/2026",
            "time": "10:22:17",
            "passenger_vehicle_lanes": {
                "standard_lanes": {
                    "delay_minutes": "45",
                    "lanes_open": "6",
                    "operational_status": "45",
                },
                "NEXUS_SENTRI_lanes": {
                    "delay_minutes": "10",
                    "lanes_open": "2",
                    "operational_status": "10",
                },
            },
            "pedestrian_lanes": {
                "standard_lanes": {
                    "delay_minutes": "15",
                    "lanes_open": "3",
                    "operational_status": "15",
                },
            },
        }
        observations = normalize_cbp_record(record, port_map, lane_map)
        assert len(observations) >= 3
        vehicle_obs = [o for o in observations if o["lane_type_id"] == 1]
        assert len(vehicle_obs) == 1
        assert vehicle_obs[0]["wait_minutes"] == 45
        assert vehicle_obs[0]["port_id"] == 1

    def test_unknown_port_returns_empty(self, port_map, lane_map):
        record = {"port_number": "999999"}
        assert normalize_cbp_record(record, port_map, lane_map) == []

    def test_closed_lanes(self, port_map, lane_map):
        record = {
            "port_number": "250401",
            "passenger_vehicle_lanes": {
                "standard_lanes": {
                    "delay_minutes": "Lanes Closed",
                    "lanes_open": "0",
                    "operational_status": "Lanes Closed",
                },
            },
        }
        observations = normalize_cbp_record(record, port_map, lane_map)
        vehicle_obs = [o for o in observations if o["lane_type_id"] == 1]
        assert len(vehicle_obs) == 1
        assert vehicle_obs[0]["is_closed"] is True
        assert vehicle_obs[0]["wait_minutes"] is None

    def test_empty_lane_data_skipped(self, port_map, lane_map):
        record = {
            "port_number": "250401",
            "passenger_vehicle_lanes": {},
        }
        observations = normalize_cbp_record(record, port_map, lane_map)
        vehicle_obs = [o for o in observations if o["lane_type_id"] == 1]
        assert len(vehicle_obs) == 0

    def test_pedestrian_ready_lane(self, port_map, lane_map):
        record = {
            "port_number": "250401",
            "pedestrian_lanes": {
                "standard_lanes": {
                    "delay_minutes": "20",
                    "lanes_open": "4",
                    "operational_status": "20",
                },
                "ready_lanes": {
                    "delay_minutes": "5",
                    "lanes_open": "2",
                    "operational_status": "5",
                },
            },
        }
        observations = normalize_cbp_record(record, port_map, lane_map)
        ped_obs = [o for o in observations if o["lane_type_id"] == 4]
        ped_ready_obs = [o for o in observations if o["lane_type_id"] == 5]
        assert len(ped_obs) == 1
        assert ped_obs[0]["wait_minutes"] == 20
        assert len(ped_ready_obs) == 1
        assert ped_ready_obs[0]["wait_minutes"] == 5
