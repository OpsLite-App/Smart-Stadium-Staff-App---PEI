import pytest
from unittest.mock import patch
import httpx
from task_manager import TaskManager
from schemas import BinAlertCreate

# Fixtures are provided by conftest.py

def test_task_creation_when_map_service_is_down(db_session):
    # Setup of the Manager pointing to 'dead' services
    tm = TaskManager(
        routing_service_url="http://fake-routing", 
        map_service_url="http://fake-map"
    )
    
    alert = BinAlertCreate(
        bin_id="bin_99",
        location_node="gate_A",
        fill_percentage=98,
        capacity_liters=50.0
    )
    
    # Simulating that any httpx post call throws a connection error
    with patch("httpx.Client.post", side_effect=httpx.ConnectError("Service Unavailable")):
        # The code should catch the error internally and create the task anyway
        response = tm.create_bin_task(db_session, alert)
        
        assert response.id is not None
        assert response.priority == "critical"
        print(f"\nResilience tested: Task {response.id} created even with Map Service offline.")