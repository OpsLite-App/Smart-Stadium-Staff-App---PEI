"""
Test fixtures
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from database import Base, get_db
from staff_coordinator import get_staff_coordinator



# Use SQLite with StaticPool to avoid threading issues
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory database for each test"""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool  # Important: avoids threading issues
    )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """Test client with overridden database dependency"""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    # Override database dependency
    app.dependency_overrides[get_db] = override_get_db
    
    # Reset staff coordinator
    staff_coordinator = get_staff_coordinator()
    staff_coordinator.clear_all()
    
    with TestClient(app) as test_client:
        yield test_client
    
    # Cleanup
    app.dependency_overrides.clear()


# ========== SIMPLE DATA FIXTURES ==========

@pytest.fixture
def sample_task_data():
    """Sample task data"""
    return {
        "task_type": "general_cleaning",
        "location_node": "NODE-301",
        "priority": "medium"
    }