"""
DATABASE SETUP for Emergency Service
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from models import Base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./emergency.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    if "postgresql" in DATABASE_URL:
        with engine.begin() as connection:
            # Existing dev volumes may already have the enum created without the
            # new canonical categories. Keep this idempotent for shared Docker DBs.
            for value in ("medic", "cleaning"):
                connection.execute(text(f"ALTER TYPE incidenttype ADD VALUE IF NOT EXISTS '{value}'"))
    print("✅ Database tables created")


def get_db() -> Session:
    """FastAPI dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def reset_db():
    """Reset database (CAUTION)"""
    print("⚠️  Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✅ Database reset complete")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--reset":
        reset_db()
    else:
        init_db()
