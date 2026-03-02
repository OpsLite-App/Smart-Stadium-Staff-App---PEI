import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db

# Shared in‑memory SQLite (so all connections see the same DB)
TEST_DATABASE_URL = "sqlite:///file::memory:?cache=shared&mode=memory&uri=true"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from ApiHandler import app
from fastapi.testclient import TestClient

@pytest.fixture(name="client")
def client_fixture():
    # Patch the real database modules
    with patch("database.engine", test_engine), \
         patch("database.SessionLocal", TestingSessionLocal), \
         patch("load_data_db.SessionLocal", TestingSessionLocal):

        # Save original overrides and set our own
        original_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        # Create tables and load sample data
        Base.metadata.create_all(bind=test_engine)
        with TestClient(app) as c:
            c.post("/api/reset")          # loads the Dragão stadium
            yield c

        # Cleanup
        Base.metadata.drop_all(bind=test_engine)
        app.dependency_overrides = original_overrides

# ===== TESTS =====

def test_graph_is_fully_connected(client):
    nodes = client.get("/api/nodes").json()
    edges = client.get("/api/edges").json()

    adj = {n['id']: [] for n in nodes}
    for e in edges:
        adj[e['from_id']].append(e['to_id'])

    start = nodes[0]['id']
    visited = {start}
    queue = [start]

    while queue:
        current = queue.pop(0)
        for neighbor in adj.get(current, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    assert len(visited) == len(nodes), f"Isolated nodes! Visited {len(visited)}/{len(nodes)}"

def test_closure_impact(client):
    closure_data = {
        "id": "C_STAIRS",
        "node_id": "N15",
        "reason": "Escada rolante avariada"
    }
    res = client.post("/api/closures", json=closure_data)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"

    data = res.json()
    assert data["node_id"] == "N15"
    assert data["reason"] == "Escada rolante avariada"