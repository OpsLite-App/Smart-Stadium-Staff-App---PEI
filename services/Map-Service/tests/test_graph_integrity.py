import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db

# Shared in‑memory SQLite database
TEST_DATABASE_URL = "sqlite:///file::memory:?cache=shared&mode=memory&uri=true"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from ApiHandler import app
from fastapi.testclient import TestClient

@pytest.fixture(name="client")
def client_fixture():
    # Patch the real database modules so the app uses the test database
    with patch("database.engine", test_engine), \
         patch("database.SessionLocal", TestingSessionLocal), \
         patch("load_data_db.SessionLocal", TestingSessionLocal):

        # Save any existing overrides and set our own
        original_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        # Create tables and load sample stadium data
        Base.metadata.create_all(bind=test_engine)
        with TestClient(app) as c:
            # Load the Dragão stadium data via the reset endpoint
            c.post("/api/reset")
            yield c

        # Clean up
        Base.metadata.drop_all(bind=test_engine)
        app.dependency_overrides = original_overrides

# ================== TEST ==================

def test_path_exists_between_floors(client):
    """Ensures there is a real path between Floor 0 and Floor 1."""
    # (client has already reset in the fixture, but repeating is harmless)
    client.post("/api/reset")  # optional, preserves original behavior
    nodes = client.get("/api/nodes").json()
    edges = client.get("/api/edges").json()

    # Build adjacency list
    adj = {n['id']: [] for n in nodes}
    for e in edges:
        adj[e['from_id']].append(e['to_id'])

    visited = set()
    queue = ["N1"]
    while queue:
        curr = queue.pop(0)
        if curr == "N16":
            return  # Path found – test passes
        if curr not in visited:
            visited.add(curr)
            queue.extend(adj.get(curr, []))

    assert False, "No path exists between Floor 0 and Floor 1!"