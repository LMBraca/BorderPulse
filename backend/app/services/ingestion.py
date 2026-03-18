"""
CBP Border Wait Times ingestion service.

Fetches current wait times from the CBP BWT API, normalizes the data,
deduplicates against recent observations, and stores in TimescaleDB.

Real API endpoint: https://bwt.cbp.gov/api/waittimes
Returns a flat JSON array. Each entry has nested lane groups:
  - passenger_vehicle_lanes.standard_lanes
  - passenger_vehicle_lanes.NEXUS_SENTRI_lanes
  - pedestrian_lanes.standard_lanes
  - commercial_vehicle_lanes.standard_lanes
Each lane dict has: update_time, operational_status, delay_minutes, lanes_open
"""
import httpx
import structlog
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.port import PortOfEntry, LaneType
from app.models.observation import WaitTimeObservation
from app.services.cache import cache_live_wait, set_ingestion_status
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


def parse_wait_minutes(value: str) -> Optional[int]:
    """Parse CBP wait time string to integer minutes. Returns None if unparseable."""
    if not value or value.strip() in ("", "N/A", "no delay", "Lanes Closed", "Update Pending"):
        return None
    try:
        cleaned = value.strip().split()[0]
        return max(0, int(cleaned))
    except (ValueError, IndexError):
        return None


def parse_delay_minutes(value: str) -> Optional[int]:
    """Parse delay_minutes field — returns 0 for 'no delay', int otherwise."""
    if not value or value.strip() in ("", "N/A", "Lanes Closed", "Update Pending"):
        return None
    if value.strip().lower() == "no delay":
        return 0
    try:
        return max(0, int(value.strip()))
    except (ValueError, TypeError):
        return None


def parse_lanes_open(value) -> Optional[int]:
    if value is None or str(value).strip() in ("", "N/A"):
        return None
    try:
        return max(0, int(value))
    except (ValueError, TypeError):
        return None


def is_closed(operational_status: str, lanes_open_str) -> bool:
    """Determine if a lane is closed based on CBP status fields."""
    status = str(operational_status).strip().lower() if operational_status else ""
    if "closed" in status:
        return True
    if lanes_open_str is not None:
        try:
            if int(lanes_open_str) == 0:
                return True
        except (ValueError, TypeError):
            pass
    return False


def parse_cbp_timestamp(date_str: str, time_str: str) -> Optional[datetime]:
    """Parse CBP date and time fields into a datetime.
    CBP format: date='3/18/2026', time='10:22:17'
    """
    if not date_str or not time_str:
        return None
    try:
        combined = f"{date_str.strip()} {time_str.strip()}"
        # CBP uses M/D/YYYY format
        dt = datetime.strptime(combined, "%m/%d/%Y %H:%M:%S")
        return dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


async def fetch_cbp_data() -> Optional[list[dict]]:
    """Fetch current border wait times from CBP API."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                settings.cbp_api_url,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get("data", data.get("port", [data]))
            else:
                logger.error("cbp_api_unexpected_format", type=type(data).__name__)
                return None

    except httpx.HTTPStatusError as e:
        logger.error("cbp_api_http_error", status=e.response.status_code)
        return None
    except httpx.RequestError as e:
        logger.error("cbp_api_request_error", error=str(e))
        return None
    except Exception as e:
        logger.error("cbp_api_unexpected_error", error=str(e))
        return None


async def load_port_map() -> dict[str, int]:
    """Load mapping of CBP port numbers to our internal port IDs."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(PortOfEntry.cbp_port_id, PortOfEntry.id))
        return {row[0]: row[1] for row in result.all()}


async def load_lane_type_map() -> dict[str, int]:
    """Load mapping of lane type codes to IDs."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(LaneType.code, LaneType.id))
        return {row[0]: row[1] for row in result.all()}


def normalize_cbp_record(record: dict, port_map: dict, lane_map: dict) -> list[dict]:
    """
    Normalize a single CBP API record into our observation format.

    Real API structure per record:
        port_number: "250401"
        border: "Mexican Border"
        port_name: "San Ysidro"
        date: "3/18/2026"
        time: "10:22:17"
        passenger_vehicle_lanes:
            standard_lanes: {delay_minutes, lanes_open, operational_status, update_time}
            NEXUS_SENTRI_lanes: {delay_minutes, lanes_open, operational_status, update_time}
            ready_lanes: ...
        pedestrian_lanes:
            standard_lanes: ...
            ready_lanes: ...
        commercial_vehicle_lanes:
            standard_lanes: ...
            FAST_lanes: ...
    """
    observations = []

    port_number = str(record.get("port_number", "")).strip()
    if port_number not in port_map:
        return observations

    port_id = port_map[port_number]

    # Parse timestamp from separate date + time fields
    cbp_updated = parse_cbp_timestamp(
        record.get("date", ""),
        record.get("time", ""),
    )

    now = datetime.now(timezone.utc)

    # Map our lane codes to the correct nested path in the CBP response
    # SENTRI (NEXUS_SENTRI_lanes) and Ready Lane (ready_lanes) are separate programs
    lane_configs = [
        ("standard_vehicle", record.get("passenger_vehicle_lanes", {}), "standard_lanes"),
        ("sentri", record.get("passenger_vehicle_lanes", {}), "NEXUS_SENTRI_lanes"),
        ("ready_lane", record.get("passenger_vehicle_lanes", {}), "ready_lanes"),
        ("pedestrian", record.get("pedestrian_lanes", {}), "standard_lanes"),
        ("commercial", record.get("commercial_vehicle_lanes", {}), "standard_lanes"),
    ]

    for lane_code, parent_group, sub_key in lane_configs:
        lane_type_id = lane_map.get(lane_code)
        if lane_type_id is None:
            continue

        if not isinstance(parent_group, dict):
            continue

        lane_data = parent_group.get(sub_key, {})
        if not isinstance(lane_data, dict):
            continue

        operational_status = str(lane_data.get("operational_status", ""))
        delay_str = str(lane_data.get("delay_minutes", ""))
        lanes_open_str = lane_data.get("lanes_open", "")

        # Skip lanes with no data at all
        if operational_status.strip() in ("N/A", "Update Pending", ""):
            continue

        closed = is_closed(operational_status, lanes_open_str)
        wait_min = parse_delay_minutes(delay_str)
        lanes_open = parse_lanes_open(lanes_open_str)

        # "no delay" with 0 delay_minutes means 0 wait
        if not closed and wait_min is None and "no delay" in operational_status.lower():
            wait_min = 0

        observations.append({
            "observed_at": now,
            "port_id": port_id,
            "lane_type_id": lane_type_id,
            "wait_minutes": None if closed else wait_min,
            "delay_minutes": None,
            "lanes_open": lanes_open,
            "is_closed": closed,
            "source": "cbp_api",
            "cbp_updated_at": cbp_updated,
        })

    return observations


async def store_observations(observations: list[dict]) -> int:
    """Store normalized observations, deduplicating against recent data."""
    if not observations:
        return 0

    stored = 0
    async with AsyncSessionLocal() as session:
        for obs in observations:
            # Deduplicate: skip if we already have this port+lane+cbp_timestamp
            if obs["cbp_updated_at"]:
                existing = await session.execute(
                    select(WaitTimeObservation).where(
                        and_(
                            WaitTimeObservation.port_id == obs["port_id"],
                            WaitTimeObservation.lane_type_id == obs["lane_type_id"],
                            WaitTimeObservation.cbp_updated_at == obs["cbp_updated_at"],
                        )
                    ).limit(1)
                )
                if existing.scalar_one_or_none():
                    continue

            session.add(WaitTimeObservation(**obs))
            stored += 1

            # Update live cache (graceful — won't crash if Redis is down)
            await cache_live_wait(obs["port_id"], obs["lane_type_id"], {
                "waitMinutes": obs["wait_minutes"],
                "lanesOpen": obs["lanes_open"],
                "isClosed": obs["is_closed"],
                "updatedAt": obs["observed_at"].isoformat(),
                "cbpUpdatedAt": obs["cbp_updated_at"].isoformat() if obs["cbp_updated_at"] else None,
            })

        await session.commit()

    return stored


async def run_ingestion():
    """Main ingestion entry point. Called by the scheduler."""
    log = logger.bind(service="ingestion")
    log.info("ingestion_started")

    try:
        raw_data = await fetch_cbp_data()
        if raw_data is None:
            log.warning("ingestion_fetch_failed")
            await set_ingestion_status(success=False, record_count=0)
            return

        port_map = await load_port_map()
        lane_map = await load_lane_type_map()

        log.info("ingestion_maps_loaded", ports=len(port_map), lanes=len(lane_map))

        # TODO: could also support Canadian border crossings eventually
        mx_records = [r for r in raw_data if r.get("border") == "Mexican Border"]
        log.info("ingestion_filtered", total=len(raw_data), mexican_border=len(mx_records))

        all_observations = []
        for record in mx_records:
            observations = normalize_cbp_record(record, port_map, lane_map)
            all_observations.extend(observations)

        stored = await store_observations(all_observations)
        log.info(
            "ingestion_complete",
            raw_records=len(mx_records),
            observations=len(all_observations),
            stored=stored,
        )
        await set_ingestion_status(success=True, record_count=stored)

    except Exception as e:
        log.error("ingestion_error", error=str(e))
        await set_ingestion_status(success=False, record_count=0)
        raise
