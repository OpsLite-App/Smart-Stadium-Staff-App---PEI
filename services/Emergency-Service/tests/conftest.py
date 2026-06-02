"""
Test configuration and shared fixtures for Emergency Service tests
"""

import os
import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Set fake service URLs and testing mode BEFORE importing main modules
os.environ["ROUTING_SERVICE_URL"] = "http://fake-routing"
os.environ["MAP_SERVICE_URL"] = "http://fake-map"
os.environ["CONGESTION_SERVICE_URL"] = "http://fake-congestion"
os.environ["AUTH_SERVICE_URL"] = "http://fake-auth"
os.environ["TESTING"] = "true"

from main import app
import database
from database import Base, get_db

# Use a shared in-memory SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///file::memory:?cache=shared"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False, "uri": True}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for tests"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment once per session"""
    # Create tables in the shared in-memory database
    Base.metadata.create_all(bind=engine)
    
    # Patch SessionLocal in database module to use test database
    database.SessionLocal = TestingSessionLocal
    
    yield
    
    # Clean up after all tests
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def setup_dependencies():
    """Override dependencies for each test"""
    # Override database dependency
    app.dependency_overrides[get_db] = override_get_db
    
    yield
    
    # Restore original after test
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Provide a test client for the app"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Provide a database session for tests"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()





