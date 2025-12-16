"""
Test fixtures for Routing Service - Pytest Configuration
"""
import pytest
import sys
import os
from unittest.mock import patch, AsyncMock, MagicMock

# Force Python to use the current directory's venv
venv_path = os.path.join(os.path.dirname(__file__), '..', 'venv')
if os.path.exists(venv_path):
    site_packages = os.path.join(venv_path, 'lib', f'python{sys.version_info.major}.{sys.version_info.minor}', 'site-packages')
    if os.path.exists(site_packages):
        sys.path.insert(0, site_packages)

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from main import app as fastapi_app
from astar import Graph, HazardMap
from api_handlers import RouteAPIHandler, HazardAPIHandler


@pytest.fixture
def mock_graph():
    """Create a mock graph for testing"""
    nodes = [
        {"id": "N1", "x": 0, "y": 0, "level": 0},
        {"id": "N2", "x": 10, "y": 0, "level": 0},
        {"id": "N10", "x": 50, "y": 50, "level": 0},
        {"id": "N15", "x": 100, "y": 100, "level": 0},
        {"id": "N20", "x": 150, "y": 150, "level": 0},
        {"id": "N21", "x": 200, "y": 200, "level": 0}
    ]
    
    edges = [
        {"from": "N1", "to": "N2", "w": 10.0},
        {"from": "N2", "to": "N10", "w": 40.0},
        {"from": "N10", "to": "N15", "w": 50.0},
        {"from": "N15", "to": "N20", "w": 50.0},
        {"from": "N20", "to": "N21", "w": 50.0}
    ]
    
    return Graph(nodes, edges)


@pytest.fixture
def mock_hazard_map():
    """Create a mock hazard map for testing"""
    return HazardMap()


@pytest.fixture
def mock_handlers(mock_graph, mock_hazard_map):
    """Create mock handlers for testing"""
    return {
        "route_handler": RouteAPIHandler(mock_graph, mock_hazard_map),
        "hazard_handler": HazardAPIHandler(mock_hazard_map)
    }


@pytest.fixture
def client(mock_graph, mock_hazard_map, mock_handlers):
    """Test client with mocked dependencies"""
    # Mock the global variables that would be set by startup
    with patch('main.GRAPH', mock_graph):
        with patch('main.HAZARD_MAP', mock_hazard_map):
            with patch('main.route_handler', mock_handlers["route_handler"]):
                with patch('main.hazard_handler', mock_handlers["hazard_handler"]):
                    # Mock the external service calls
                    with patch('main.load_graph_from_map_service', AsyncMock(return_value=True)):
                        with patch('main.httpx.AsyncClient') as mock_client:
                            # Mock the gates endpoint response
                            mock_response = MagicMock()
                            mock_response.json.return_value = [
                                {"id": "G1", "x": 200, "y": 200},
                                {"id": "G2", "x": 150, "y": 150}
                            ]
                            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
                            
                            with TestClient(fastapi_app) as test_client:
                                yield test_client


@pytest.fixture
def test_graph():
    """Simple test graph for algorithm testing"""
    nodes = [
        {"id": "A", "x": 0, "y": 0},
        {"id": "B", "x": 10, "y": 0},
        {"id": "C", "x": 10, "y": 10},
        {"id": "D", "x": 0, "y": 10},
    ]
    
    edges = [
        {"from": "A", "to": "B", "w": 10.0},
        {"from": "B", "to": "C", "w": 10.0},
        {"from": "C", "to": "D", "w": 10.0},
        {"from": "D", "to": "A", "w": 10.0},
    ]
    
    return Graph(nodes, edges)


@pytest.fixture
def test_hazard_map():
    """Clean hazard map for testing"""
    return HazardMap()