import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db

# Shared in‑memory SQLite database (so all connections see the same data)
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

        # Save any existing dependency overrides and set our own
        original_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = lambda: TestingSessionLocal()

        # Create tables and load the sample stadium data
        Base.metadata.create_all(bind=test_engine)
        with TestClient(app) as c:
            # Load the Dragão stadium data via the reset endpoint
            c.post("/api/reset")
            yield c

        # Clean up after the test
        Base.metadata.drop_all(bind=test_engine)
        app.dependency_overrides = original_overrides

# ================== TESTS ==================

def test_no_duplicate_seat_locations(client):
    """Verifica se não existem dois lugares nas mesmas coordenadas GPS."""
    seats = client.get("/api/seats").json()
    locations = [(s['x'], s['y']) for s in seats]
    assert len(locations) == len(set(locations)), "Existem lugares sobrepostos no mapa!"

def test_gate_coordinates_within_bounds(client):
    """Verifica se as portas (Gates) estão dentro do perímetro esperado do Dragão."""
    gates = client.get("/api/gates").json()
    for gate in gates:
        # Coordenadas aproximadas do Estádio do Dragão
        assert 41.1600 <= gate['x'] <= 41.1630
        assert -8.5860 <= gate['y'] <= -8.5820

def test_edge_weights_are_positive(client):
    """O peso (distância) entre pontos nunca pode ser zero ou negativo."""
    edges = client.get("/api/edges").json()
    for edge in edges:
        assert edge['weight'] > 0, f"Aresta {edge['id']} tem peso inválido!"