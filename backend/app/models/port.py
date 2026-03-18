from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, func
from app.database import Base


class PortOfEntry(Base):
    __tablename__ = "ports_of_entry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cbp_port_id = Column(String(20), unique=True, nullable=False)
    name_en = Column(String(200), nullable=False)
    name_es = Column(String(200), nullable=False)
    city_us = Column(String(100))
    city_mx = Column(String(100))
    state_us = Column(String(50))
    state_mx = Column(String(50))
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    crossing_type = Column(String(20), nullable=False, default="land")
    is_active = Column(Boolean, default=True)
    timezone = Column(String(50), nullable=False, default="America/Tijuana")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LaneType(Base):
    __tablename__ = "lane_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(30), unique=True, nullable=False)
    name_en = Column(String(100), nullable=False)
    name_es = Column(String(100), nullable=False)
