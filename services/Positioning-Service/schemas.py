from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FingerprintCreate(BaseModel):
    location_id: str
    zone: str
    x: float
    y: float
    rssi_map: dict[str, int]  # {bssid: rssi}


class FingerprintResponse(BaseModel):
    id: str
    location_id: str
    zone: str
    x: float
    y: float
    rssi_map: dict[str, int]
    created_at: datetime

    class Config:
        from_attributes = True


class LocateRequest(BaseModel):
    staff_id: str
    rssi_map: dict[str, int]
    k: int = 3


class PositionResponse(BaseModel):
    staff_id: str
    x: float
    y: float
    zone: str
    location_id: str
    confidence: float  # 0-1, based on distance to nearest fingerprint
    updated_at: datetime

    class Config:
        from_attributes = True


class SimulatedPositionUpdate(BaseModel):
    staff_id: str
    x: float
    y: float
    zone: str
    location_id: str
