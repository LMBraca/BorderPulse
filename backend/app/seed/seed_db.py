"""Seed the database with ports of entry and lane types."""
import json
import asyncio
from pathlib import Path
from sqlalchemy import select, text
from app.database import AsyncSessionLocal
from app.models.port import PortOfEntry, LaneType


SEED_FILE = Path(__file__).parent / "ports.json"


async def seed():
    with open(SEED_FILE) as f:
        data = json.load(f)

    async with AsyncSessionLocal() as session:
        # Seed lane types (upsert name if it changed)
        for lt in data["lane_types"]:
            result = await session.execute(
                select(LaneType).where(LaneType.code == lt["code"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                if existing.name_en != lt["name_en"]:
                    existing.name_en = lt["name_en"]
                    existing.name_es = lt["name_es"]
                    print(f"  ~ Updated lane type: {lt['code']}")
            else:
                session.add(LaneType(**lt))
                print(f"  + Lane type: {lt['code']}")

        # Seed ports
        for port in data["ports"]:
            existing = await session.execute(
                select(PortOfEntry).where(PortOfEntry.cbp_port_id == port["cbp_port_id"])
            )
            if not existing.scalar_one_or_none():
                session.add(PortOfEntry(**port))
                print(f"  + Port: {port['name_en']}")

        await session.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
