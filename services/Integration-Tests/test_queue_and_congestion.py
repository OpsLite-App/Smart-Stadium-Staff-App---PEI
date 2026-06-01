"""
Integration tests for Queueing and Congestion Services.
Tests wait time estimation and crowd density monitoring.
"""

import pytest
import httpx
import json
import time
from typing import Dict, Any


@pytest.mark.integration
class TestQueueingWorkflow:
    """Test queueing service workflows."""
    
    async def test_queue_observation_and_waittime(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Update queue state → Get wait time estimate
        """
        location_id = "gate_1"
        payload = {
            "location_id": location_id,
            "location_type": "gate",
            "current_queue_length": 20,
            "arrivals_last_minute": 10,
            "departures_last_minute": 5,
        }
        
        # Update queue
        response = await http_client.post(
            f"{service_urls['queueing']}/update",
            json=payload,
        )
        assert response.status_code == 200, f"Queue update failed: {response.text}"
        
        # Get wait time
        response = await http_client.get(
            f"{service_urls['queueing']}/waittime/{location_id}",
        )
        assert response.status_code == 200
        data = response.json()
        assert "avg_wait_time_minutes" in data
    
    async def test_multiple_queue_updates(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Multiple updates reflect in queue status
        """
        location_id = "gate_2"
        
        for length in [10, 20, 30]:
            payload = {
                "location_id": location_id,
                "location_type": "gate",
                "current_queue_length": length,
                "arrivals_last_minute": 10,
                "departures_last_minute": 5,
            }
            await http_client.post(
                f"{service_urls['queueing']}/update",
                json=payload,
            )
        
        # Use /status (all queues) and filter
        response = await http_client.get(
            f"{service_urls['queueing']}/status",
        )
        assert response.status_code == 200
        data = response.json()
        queues = data.get("queues", [])
        gate_2 = next((q for q in queues if q["location_id"] == location_id), None)
        assert gate_2 is not None
        assert gate_2["queue_length"] == 30


@pytest.mark.integration
class TestCongestionWorkflow:
    """Test congestion service workflows."""
    
    async def test_crowd_density_heatmap(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        mqtt_client: Any,
    ):
        """
        Test: Publish crowd density via MQTT → Verify heatmap update
        """
        area_id = "zone_1"
        payload = {
            "event_type": "crowd_density",
            "area_id": area_id,
            "area_type": "normal",
            "current_count": 85,
            "capacity": 100,
            "occupancy_rate": 85.0,
            "heat_level": "red",
            "location": {"x": 30.0, "y": 40.0}
        }
        
        # Publish via MQTT
        mqtt_client.publish("stadium/crowd/density-updates", json.dumps(payload))
        
        # Wait for processing
        time.sleep(1)
        
        # Verify in heatmap
        response = await http_client.get(
            f"{service_urls['congestion']}/heatmap",
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check if area exists in heatmap
        areas = data.get("areas", [])
        assert any(a["area_id"] == area_id for a in areas), "Area not found in heatmap"
    
    async def test_heatmap_retrieval(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        """
        Test: Retrieve full heatmap and points
        """
        # Full heatmap
        response = await http_client.get(f"{service_urls['congestion']}/heatmap")
        assert response.status_code == 200
        
        # Heatmap points for map display
        response = await http_client.get(f"{service_urls['congestion']}/heatmap/points")
        assert response.status_code == 200


@pytest.mark.integration
class TestQueueCongestionIntegration:
    """Test integration between Queueing and Congestion services."""
    
    async def test_queue_impacts_congestion(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
        mqtt_client: Any,
    ):
        """
        Test: High queue levels reported via MQTT also update congestion
        """
        # Simulate a system where queue updates trigger crowd density events
        # We'll just verify both can be seen together
        area_id = "gate_1"
        
        # 1. Update Queue
        await http_client.post(
            f"{service_urls['queueing']}/update",
            json={
                "location_id": area_id,
                "location_type": "gate",
                "current_queue_length": 50,
                "arrivals_last_minute": 25,
                "departures_last_minute": 15,
            }
        )
        
        # 2. Update Congestion via MQTT
        payload = {
            "event_type": "crowd_density",
            "area_id": area_id,
            "area_type": "gate",
            "current_count": 50,
            "capacity": 100,
            "occupancy_rate": 50.0,
            "location": {"x": 10.0, "y": 20.0}
        }
        mqtt_client.publish("stadium/crowd/density-updates", json.dumps(payload))
        
        time.sleep(1)
        
        # Verify both
        q_resp = await http_client.get(f"{service_urls['queueing']}/status")
        c_resp = await http_client.get(f"{service_urls['congestion']}/heatmap/{area_id}")
        
        assert q_resp.status_code == 200
        assert c_resp.status_code == 200
        
        queues = q_resp.json().get("queues", [])
        assert any(q["location_id"] == area_id for q in queues)
