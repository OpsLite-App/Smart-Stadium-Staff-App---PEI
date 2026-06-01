from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, init_db
from schemas import FingerprintCreate, FingerprintResponse, LocateRequest, PositionResponse, SimulatedPositionUpdate
import positioning

from typing import List

app = FastAPI(title="Positioning Service")


@app.on_event("startup")
def startup():
    init_db()


@app.post("/fingerprints", response_model=FingerprintResponse, status_code=201)
def add_fingerprint(fp: FingerprintCreate, db: Session = Depends(get_db)):
    return positioning.add_fingerprint(db, fp)


@app.post("/locate", response_model=PositionResponse)
def locate(req: LocateRequest, db: Session = Depends(get_db)):
    try:
        return positioning.locate(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/position/simulate", response_model=PositionResponse)
def simulate(req: SimulatedPositionUpdate, db: Session = Depends(get_db)):
    return positioning.update_simulated_position(db, req.staff_id, req.x, req.y, req.zone, req.location_id)


@app.get("/positions", response_model=List[PositionResponse])
def get_all_positions(db: Session = Depends(get_db)):
    from models import StaffPosition
    return db.query(StaffPosition).all()


@app.get("/position/{staff_id}", response_model=PositionResponse)
def get_position(staff_id: str, db: Session = Depends(get_db)):
    from models import StaffPosition
    pos = db.query(StaffPosition).filter(StaffPosition.staff_id == staff_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    return pos


@app.get("/health")
def health_check():
    return {"status": "ok"}
