from sqlalchemy import Column, Integer, String, Numeric, SmallInteger, Date, DateTime, ForeignKey, UniqueConstraint, func
from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    port_id = Column(Integer, ForeignKey("ports_of_entry.id"), nullable=False)
    lane_type_id = Column(Integer, ForeignKey("lane_types.id"), nullable=False)
    prediction_date = Column(Date, nullable=False)
    hour = Column(SmallInteger, nullable=False)  # 0-23
    predicted_wait = Column(Numeric(5, 1), nullable=False)
    confidence = Column(String(20), nullable=False)  # low, medium, high
    p25_wait = Column(Numeric(5, 1))
    p75_wait = Column(Numeric(5, 1))
    sample_count = Column(Integer)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("port_id", "lane_type_id", "prediction_date", "hour"),
    )
