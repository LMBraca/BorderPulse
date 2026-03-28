"""
CBP Border Wait Times ingestion service.

Fetches current wait times from the CBP BWT API, normalizes the data,
deduplicates against recent observations, and stores in TimescaleDB.

Primary API: https://bwt.cbp.gov/api/waittimes (JSON, all ports, single call)
Fallback RSS: https://bwt.cbp.gov/api/bwtRss/rssbyportnum/HTML/{POV|PED|COM}/{port}
  Used when the JSON API is stale (>30 min behind wall clock).
"""
import asyncio
import re
import httpx
import structlog
from datetime import datetime, timezone, timedelta
from typing import Optional
from xml.etree import ElementTree
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.port import PortOfEntry, LaneType
from app.models.observation import WaitTimeObservation
from app.services.cache import cache_live_wait, set_ingestion_status
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

STALE_THRESHOLD = timedelta(minutes=30)
RSS_CONCURRENCY = 10  


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


def parse_max_lanes(value) -> Optional[int]:
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


def parse_rss_timestamp(pub_date: str) -> Optional[datetime]:
    if not pub_date:
        return None
    try:

        cleaned = pub_date.strip()
        parts = cleaned.rsplit(" ", 1)
        if len(parts) == 2:
            dt_str, tz_str = parts
            dt = datetime.strptime(dt_str, "%a, %d %b %Y %H:%M:%S")
            tz_offsets = {
                "EST": -5, "EDT": -4, "PST": -8, "PDT": -7,
                "CST": -6, "CDT": -5, "MST": -7, "MDT": -6,
            }
            offset_hours = tz_offsets.get(tz_str, 0)
            dt = dt.replace(tzinfo=timezone(timedelta(hours=offset_hours)))
            return dt.astimezone(timezone.utc)
        return None
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
    Extracts maxLanes and updateTime for each lane group.
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
    lane_configs = [
        ("standard_vehicle", record.get("passenger_vehicle_lanes", {}), "standard_lanes"),
        ("sentri", record.get("passenger_vehicle_lanes", {}), "NEXUS_SENTRI_lanes"),
        ("ready_lane", record.get("passenger_vehicle_lanes", {}), "ready_lanes"),
        ("pedestrian", record.get("pedestrian_lanes", {}), "standard_lanes"),
        ("pedestrian_ready", record.get("pedestrian_lanes", {}), "ready_lanes"),
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
        max_lanes = parse_max_lanes(parent_group.get("maximum_lanes"))
        update_time = str(lane_data.get("update_time", "")).strip() or None

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
            "max_lanes": max_lanes,
            "update_time": update_time,
        })

    return observations


RSS_LANE_MAP_POV = {
    "general": "standard_vehicle",
    "sentri": "sentri",
    "ready": "ready_lane",
}
RSS_LANE_MAP_PED = {
    "general": "pedestrian",
    "ready": "pedestrian_ready",
}
RSS_LANE_MAP_COM = {
    "general": "commercial",
    "fast": "commercial",
}

_RSS_LANE_RE = re.compile(
    r"(General|Sentri|Ready|FAST)\s+Lanes?:\s*"
    r"(?:At\s+(.+?)\s+)?" 
    r"(\d+)\s+min\s+delay\s+"
    r"(\d+)\s+lane\(s\)\s+open",
    re.IGNORECASE,
)
_RSS_CLOSED_RE = re.compile(
    r"(General|Sentri|Ready|FAST)\s+Lanes?:\s*Closed",
    re.IGNORECASE,
)
_RSS_NA_RE = re.compile(
    r"(General|Sentri|Ready|FAST)\s+Lanes?:\s*N/A",
    re.IGNORECASE,
)
_RSS_MAX_LANES_RE = re.compile(
    r"Maximum\s+Lanes:\s*(\d+)",
    re.IGNORECASE,
)
_RSS_NO_DELAY_RE = re.compile(
    r"(General|Sentri|Ready|FAST)\s+Lanes?:\s*"
    r"(?:At\s+(.+?)\s+)?"
    r"no\s+delay\s+"
    r"(\d+)\s+lane\(s\)\s+open",
    re.IGNORECASE,
)


async def _fetch_single_rss(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    port_number: str,
    rss_type: str,
) -> Optional[tuple[str, str, str]]:
    """Fetch a single RSS feed. Returns (port_number, rss_type, xml_text) or None."""
    url = f"{settings.cbp_rss_base_url}/{rss_type}/{port_number}"
    async with sem:
        try:
            resp = await client.get(url, timeout=15.0)
            if resp.status_code == 200:
                text = resp.text
                if "<title>Page not found</title>" in text:
                    return None
                return (port_number, rss_type, text)
        except Exception as e:
            logger.debug("rss_fetch_error", port=port_number, type=rss_type, error=str(e))
    return None


def _parse_rss_description(
    description: str,
    lane_name_map: dict[str, str],
) -> list[dict]:
    lanes = []
    max_lanes_match = _RSS_MAX_LANES_RE.search(description)
    max_lanes = int(max_lanes_match.group(1)) if max_lanes_match else None

    for m in _RSS_LANE_RE.finditer(description):
        lane_name = m.group(1).lower()
        update_time = m.group(2)
        delay = int(m.group(3))
        lanes_open = int(m.group(4))
        lane_code = lane_name_map.get(lane_name)
        if lane_code:
            lanes.append({
                "lane_code": lane_code,
                "wait_minutes": delay,
                "lanes_open": lanes_open,
                "is_closed": False,
                "max_lanes": max_lanes,
                "update_time": f"At {update_time}" if update_time else None,
            })

    for m in _RSS_NO_DELAY_RE.finditer(description):
        lane_name = m.group(1).lower()
        update_time = m.group(2)
        lanes_open = int(m.group(3))
        lane_code = lane_name_map.get(lane_name)
        if lane_code and not any(l["lane_code"] == lane_code for l in lanes):
            lanes.append({
                "lane_code": lane_code,
                "wait_minutes": 0,
                "lanes_open": lanes_open,
                "is_closed": False,
                "max_lanes": max_lanes,
                "update_time": f"At {update_time}" if update_time else None,
            })

    for m in _RSS_CLOSED_RE.finditer(description):
        lane_name = m.group(1).lower()
        lane_code = lane_name_map.get(lane_name)
        if lane_code and not any(l["lane_code"] == lane_code for l in lanes):
            lanes.append({
                "lane_code": lane_code,
                "wait_minutes": None,
                "lanes_open": 0,
                "is_closed": True,
                "max_lanes": max_lanes,
                "update_time": None,
            })

    return lanes


async def fetch_cbp_rss_data(
    port_numbers: list[str],
    port_map: dict[str, int],
    lane_map: dict[str, int],
) -> list[dict]:
    log = logger.bind(service="rss_fallback")
    sem = asyncio.Semaphore(RSS_CONCURRENCY)
    now = datetime.now(timezone.utc)
    observations = []

    rss_types = [
        ("POV", RSS_LANE_MAP_POV),
        ("PED", RSS_LANE_MAP_PED),
        ("COM", RSS_LANE_MAP_COM),
    ]

    async with httpx.AsyncClient() as client:
        tasks = []
        for port_number in port_numbers:
            for rss_type, _ in rss_types:
                tasks.append(_fetch_single_rss(client, sem, port_number, rss_type))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    success_count = 0
    for result in results:
        if isinstance(result, Exception) or result is None:
            continue

        port_number, rss_type, xml_text = result
        port_id = port_map.get(port_number)
        if port_id is None:
            continue

        lane_name_map = next(m for t, m in rss_types if t == rss_type)

        try:
            root = ElementTree.fromstring(xml_text)
        except ElementTree.ParseError:
            continue

        pub_date_el = root.find(".//pubDate")
        cbp_updated = parse_rss_timestamp(pub_date_el.text) if pub_date_el is not None else None

        for item in root.findall(".//item"):
            desc_el = item.find("description")
            if desc_el is None:
                continue

            full_text = "".join(desc_el.itertext())
            if not full_text.strip():
                continue

            parsed_lanes = _parse_rss_description(full_text, lane_name_map)
            for lane_data in parsed_lanes:
                lane_type_id = lane_map.get(lane_data["lane_code"])
                if lane_type_id is None:
                    continue

                observations.append({
                    "observed_at": now,
                    "port_id": port_id,
                    "lane_type_id": lane_type_id,
                    "wait_minutes": lane_data["wait_minutes"],
                    "delay_minutes": None,
                    "lanes_open": lane_data["lanes_open"],
                    "is_closed": lane_data["is_closed"],
                    "source": "cbp_rss",
                    "cbp_updated_at": cbp_updated,
                    "max_lanes": lane_data["max_lanes"],
                    "update_time": lane_data["update_time"],
                })
                success_count += 1

    log.info("rss_fetch_complete", observations=success_count, ports=len(port_numbers))
    return observations

async def store_observations(observations: list[dict]) -> int:
    """Store normalized observations, deduplicating against recent data."""
    if not observations:
        return 0

    stored = 0
    async with AsyncSessionLocal() as session:
        for obs in observations:
            # Always update live cache so it stays fresh even when deduplicating
            await cache_live_wait(obs["port_id"], obs["lane_type_id"], {
                "waitMinutes": obs["wait_minutes"],
                "lanesOpen": obs["lanes_open"],
                "isClosed": obs["is_closed"],
                "updatedAt": obs["observed_at"].isoformat(),
                "cbpUpdatedAt": obs["cbp_updated_at"].isoformat() if obs["cbp_updated_at"] else None,
                "maxLanes": obs.get("max_lanes"),
                "updateTime": obs.get("update_time"),
            })

            # Deduplicate: skip DB insert if we already have this port+lane+cbp_timestamp
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

            db_obs = {k: v for k, v in obs.items() if k not in ("max_lanes", "update_time")}
            session.add(WaitTimeObservation(**db_obs))
            stored += 1

        await session.commit()

    return stored

def _get_json_age_seconds(records: list[dict]) -> Optional[float]:
    now = datetime.now(timezone.utc)
    timestamps = []
    for r in records:
        ts = parse_cbp_timestamp(r.get("date", ""), r.get("time", ""))
        if ts:
            timestamps.append(ts)

    if not timestamps:
        return None

    newest = max(timestamps)
    return (now - newest).total_seconds()


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

        mx_records = [r for r in raw_data if r.get("border") == "Mexican Border"]
        log.info("ingestion_filtered", total=len(raw_data), mexican_border=len(mx_records))

        json_age = _get_json_age_seconds(mx_records)
        json_is_stale = json_age is None or json_age > STALE_THRESHOLD.total_seconds()

        if json_is_stale:
            age_str = f"{json_age / 3600:.1f}h" if json_age else "unknown"
            log.warning(
                "json_api_stale_falling_back_to_rss",
                json_age_seconds=json_age,
                json_age_human=age_str,
                threshold_seconds=STALE_THRESHOLD.total_seconds(),
            )
            port_numbers = list(port_map.keys())
            all_observations = await fetch_cbp_rss_data(port_numbers, port_map, lane_map)
        else:
            log.info("json_api_fresh", json_age_seconds=json_age)
            all_observations = []
            for record in mx_records:
                observations = normalize_cbp_record(record, port_map, lane_map)
                all_observations.extend(observations)

        source = "cbp_rss" if json_is_stale else "cbp_api"
        stored = await store_observations(all_observations)
        log.info(
            "ingestion_complete",
            source=source,
            raw_records=len(mx_records),
            observations=len(all_observations),
            stored=stored,
        )
        await set_ingestion_status(
            success=True,
            record_count=stored,
            source=source,
            json_age_seconds=json_age,
        )

    except Exception as e:
        log.error("ingestion_error", error=str(e))
        await set_ingestion_status(success=False, record_count=0)
        raise
