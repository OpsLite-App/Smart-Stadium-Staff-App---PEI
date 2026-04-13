from sqlalchemy import Column, String, Float, DateTime, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


class Fingerprint(Base):
    __tablename__ = "fingerprints"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id = Column(String, nullable=False, index=True)
    zone = Column(String, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    rssi_map = Column(JSON, nullable=False)  # {bssid: rssi}
    created_at = Column(DateTime, default=datetime.utcnow)


class StaffPosition(Base):
    __tablename__ = "staff_positions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    staff_id = Column(String, nullable=False, index=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    zone = Column(String, nullable=False)
    location_id = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
