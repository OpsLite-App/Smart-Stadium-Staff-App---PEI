import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db

# Single Engine Configuration for Tests
# StaticPool ensures that the in-memory database doesn't disappear between calls
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def client():
    # Create tables before each test
    Base.metadata.create_all(bind=engine)
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    # Inject the test DB dependency into the app
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as c:
        yield c
    
    # Clear tables and overrides after the test
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)

# --- Tests ---

def test_create_task_via_api(client):
    payload = {
        "task_type": "spill_cleanup",
        "location_node": "sector_b_01",
        "priority": "high",
        "description": "Limpeza urgente"
    }
    response = client.post("/api/maintenance/tasks", json=payload)
    
    # Status 201 is semantically correct for creation POST
    assert response.status_code == 201 
    data = response.json()
    assert data["task_type"] == "spill_cleanup"
    assert "id" in data

def test_get_stats_empty(client):
    response = client.get("/api/maintenance/stats")
    assert response.status_code == 200
    assert response.json()["total_tasks"] == 0

def test_start_task_not_found(client):
    # The endpoint returns 404 if the task doesn't exist
    response = client.post("/api/maintenance/tasks/task-999/start")
    assert response.status_code == 404