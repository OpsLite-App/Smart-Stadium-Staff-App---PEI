import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db

TEST_DATABASE_URL = "sqlite:///file::memory:?cache=shared&mode=memory&uri=true"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

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
            c.post("/api/reset")
            yield c

        Base.metadata.drop_all(bind=test_engine)
        app.dependency_overrides = original_overrides

def test_seat_metadata_integrity(client):
    """Garante que os lugares têm dados de fila e número válidos."""
    seats = client.get("/api/seats").json()
    for seat in seats:
        assert seat['row'] > 0, f"Lugar {seat['id']} tem fila inválida"
        assert seat['number'] > 0, f"Lugar {seat['id']} tem número inválido"
        assert seat['block'] and seat['block'].strip(), f"Lugar {seat['id']} tem bloco vazio"