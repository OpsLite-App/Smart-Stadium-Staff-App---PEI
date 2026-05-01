import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool          # ← critical
from sqlalchemy.orm import sessionmaker
import database                                 # patch the module
from models import Base
from main import app
from fastapi.testclient import TestClient

# 1. Use a URL that supports shared cache, but StaticPool is easier
TEST_DATABASE_URL = "sqlite:///:memory:"

# 2. Create the test engine with a single, reusable connection
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,                       # ← only one connection ever
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# 3. Replace the production engine & sessionmaker with the test ones
database.engine = test_engine
database.SessionLocal = TestingSessionLocal

@pytest.fixture(scope="function")
def db_session():
    """Create tables and provide a session (the same connection is reused)."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)   # clean isolation

@pytest.fixture(scope="function")
def client(db_session):
    """Test client with the dependency overridden to use the test session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()