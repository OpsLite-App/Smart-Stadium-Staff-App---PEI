import numpy as np
from sqlalchemy.orm import Session
from models import Fingerprint, StaffPosition
from schemas import FingerprintCreate, LocateRequest
from datetime import datetime
import uuid


def add_fingerprint(db: Session, fp: FingerprintCreate) -> Fingerprint:
    record = Fingerprint(
        id=str(uuid.uuid4()),
        location_id=fp.location_id,
        zone=fp.zone,
        x=fp.x,
        y=fp.y,
        rssi_map=fp.rssi_map,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _rssi_distance(rssi_a: dict, rssi_b: dict) -> float:
    """Euclidean distance in RSSI space. Missing BSSIDs default to -100 dBm."""
    all_bssids = set(rssi_a) | set(rssi_b)
    diffs = [(rssi_a.get(b, -100) - rssi_b.get(b, -100)) ** 2 for b in all_bssids]
    return float(np.sqrt(sum(diffs)))


def locate(db: Session, req: LocateRequest) -> StaffPosition:
    fingerprints = db.query(Fingerprint).all()

    if not fingerprints:
        raise ValueError("No fingerprints calibrated. Run calibration first.")

    # Rank by RSSI distance
    ranked = sorted(fingerprints, key=lambda fp: _rssi_distance(req.rssi_map, fp.rssi_map))
    top_k = ranked[: req.k]

    # Weighted average position (weight = 1 / distance)
    distances = [_rssi_distance(req.rssi_map, fp.rssi_map) for fp in top_k]
    weights = [1 / (d + 1e-6) for d in distances]
    total = sum(weights)

    x = sum(fp.x * w for fp, w in zip(top_k, weights)) / total
    y = sum(fp.y * w for fp, w in zip(top_k, weights)) / total

    # Confidence: inverse of normalised distance (closer = higher confidence)
    max_possible = len(set(req.rssi_map) | set(top_k[0].rssi_map)) ** 0.5 * 100
    confidence = max(0.0, min(1.0, 1 - distances[0] / (max_possible + 1e-6)))

    return _upsert_position(db, req.staff_id, x, y, top_k[0].zone, top_k[0].location_id, confidence)


def update_simulated_position(db: Session, staff_id: str, x: float, y: float, zone: str, location_id: str) -> StaffPosition:
    return _upsert_position(db, staff_id, x, y, zone, location_id, confidence=1.0)


def _upsert_position(db: Session, staff_id: str, x: float, y: float, zone: str, location_id: str, confidence: float) -> StaffPosition:
    pos = db.query(StaffPosition).filter(StaffPosition.staff_id == staff_id).first()
    if pos:
        pos.x, pos.y, pos.zone, pos.location_id, pos.confidence = x, y, zone, location_id, confidence
        pos.updated_at = datetime.utcnow()
    else:
        pos = StaffPosition(
            id=str(uuid.uuid4()),
            staff_id=staff_id,
            x=x, y=y,
            zone=zone,
            location_id=location_id,
            confidence=confidence,
        )
        db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos
