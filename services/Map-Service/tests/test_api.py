import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite:///file::memory:?cache=shared&mode=memory&uri=true"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from database import Base, get_db
from ApiHandler import app
from fastapi.testclient import TestClient

@pytest.fixture(name="client")
def client_fixture():
    with patch("database.engine", test_engine), \
         patch("database.SessionLocal", TestingSessionLocal), \
         patch("load_data_db.SessionLocal", TestingSessionLocal):

        original_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        Base.metadata.create_all(bind=test_engine)
        with TestClient(app) as c:
            yield c

        Base.metadata.drop_all(bind=test_engine)
        app.dependency_overrides = original_overrides

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_reset_and_load_data(client):
    response = client.post("/api/reset")
    assert response.status_code == 200
    nodes = client.get("/api/nodes").json()
    assert len(nodes) > 0
    assert nodes[0]["id"] == "N1"