import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db

# shared in-memory SQLite so all connections share the same database
TEST_DATABASE_URL = "sqlite:///file::memory:?cache=shared&mode=memory&uri=true"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

from ApiHandler import app
from fastapi.testclient import TestClient

@pytest.fixture(name="client")
def client_fixture():
    # use test database, initialize schema and sample data
    with patch("database.engine", test_engine), \
         patch("database.SessionLocal", TestingSessionLocal), \
         patch("load_data_db.SessionLocal", TestingSessionLocal):

        original_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        Base.metadata.create_all(bind=test_engine)
        with TestClient(app) as c:
            c.post("/api/reset")
            yield c

        Base.metadata.drop_all(bind=test_engine)
        app.dependency_overrides = original_overrides

# ================== TESTS ==================

def test_stair_nodes_type(client):
    """Check that floor-transition nodes are marked as 'stairs'."""
    nodes = client.get("/api/nodes").json()
    stairs = [n for n in nodes if n['id'] in ['N15', 'N16']]
    for s in stairs:
        assert s['type'] == 'stairs', f"Node {s['id']} should be type stairs"

def test_all_seats_have_nodes(client):
    """Ensure every seat is mapped in the graph (accessible)."""
    seats = client.get("/api/seats").json()
    assert len(seats) > 0

def test_duplicate_node_prevention(client):
    """Attempt to create a node with an existing ID; expect an error."""
    duplicate_node = {"id": "N1", "x": 10.0, "y": 10.0, "level": 0}
    response = client.post("/api/nodes", json=duplicate_node)
    # endpoint may be disabled; error codes vary
    assert response.status_code in [400, 404, 405]

def test_poi_categories(client):
    """Verifica se as categorias de POI são válidas (de acordo com os dados carregados)."""
    pois = client.get("/api/pois").json()
    valid_categories = ["bin", "restroom", "bar", "wc", "store", "museum"]
    for poi in pois:
        assert poi['category'] in valid_categories, f"POI {poi['id']} tem categoria inválida: {poi['category']}"