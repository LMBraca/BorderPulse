from sqlalchemy import Column, Integer, Boolean, String, DateTime, ForeignKey, func, Index
from app.database import Base


class WaitTimeObservation(Base):
    __tablename__ = "wait_time_observations"

    # Composite primary key: observed_at + port_id + lane_type_id
    observed_at = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    port_id = Column(Integer, ForeignKey("ports_of_entry.id"), primary_key=True, nullable=False)
    lane_type_id = Column(Integer, ForeignKey("lane_types.id"), primary_key=True, nullable=False)
    wait_minutes = Column(Integer, nullable=True)  # NULL = unavailable
    delay_minutes = Column(Integer, nullable=True)
    lanes_open = Column(Integer, nullable=True)
    is_closed = Column(Boolean, default=False)
    source = Column(String(30), default="cbp_api")
    cbp_updated_at = Column(DateTime(timezone=True), nullable=True)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_wto_port_lane", "port_id", "lane_type_id", observed_at.desc()),
    )
