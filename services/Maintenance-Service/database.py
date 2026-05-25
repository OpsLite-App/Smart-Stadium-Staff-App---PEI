"""
DATABASE SETUP for Maintenance Service
SQLAlchemy configuration and session management
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base
import os

# Database URL (SQLite for development)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./maintenance.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False  # Set to True for SQL debug logging
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")


def get_db() -> Session:
    """
    Dependency for FastAPI endpoints
    
    Usage:
        @app.get("/endpoint")
        def my_endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_db():
    """Drop and recreate all tables (CAUTION: deletes all data)"""
    print("⚠️  Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("✅ All tables dropped")
    
    print("📦 Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database reset complete")


def seed_initial_alerts(db: Session):
    """Seed initial bin alerts if database is empty"""
    from models import MaintenanceTask, BinAlert, TaskType, TaskPriority, TaskStatus
    import uuid

    try:
        task_count = db.query(MaintenanceTask).count()
        if task_count > 0:
            return

        print("🌱 Seeding initial bin alerts...")
        initial_bins = [
            {"bin_id": "bin-wc-masc", "node_id": "51", "fill": 96, "desc": "Bin Lixeira WC Masculino is 96% full"},
            {"bin_id": "bin-wc-fem", "node_id": "53", "fill": 88, "desc": "Bin Lixeira WC Feminino is 88% full"},
            {"bin_id": "bin-bar", "node_id": "2", "fill": 91, "desc": "Bin Lixeira Bar is 91% full"},
            {"bin_id": "bin-calculo", "node_id": "85", "fill": 98, "desc": "Bin Lixeira Sala de Cálculo is 98% full"}
        ]

        for b in initial_bins:
            priority = "critical" if b["fill"] >= 95 else "high"
            task_id = f"task-{uuid.uuid4().hex[:8]}"
            task = MaintenanceTask(
                id=task_id,
                task_type=TaskType.BIN_FULL,
                location_node=b["node_id"],
                priority=TaskPriority(priority),
                description=b["desc"],
                location_description=f"Near {b['node_id']}",
                estimated_duration_min=5,
                status=TaskStatus.PENDING,
                main_metadata={
                    "bin_id": b["bin_id"],
                    "fill_percentage": b["fill"],
                    "capacity_liters": 50
                }
            )
            db.add(task)

            bin_alert = BinAlert(
                id=f"bin-alert-{uuid.uuid4().hex[:8]}",
                task_id=task_id,
                bin_id=b["bin_id"],
                location_node=b["node_id"],
                fill_percentage=b["fill"],
                capacity_liters=50
            )
            db.add(bin_alert)

        db.commit()
        print("✅ Seeded 4 initial bin alerts")
    except Exception as e:
        print(f"⚠️ Error seeding initial alerts: {e}")
        db.rollback()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--reset":
        reset_db()
    else:
        init_db()