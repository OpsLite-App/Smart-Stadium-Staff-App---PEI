"""
Shared fixtures for integration tests across all services.
Handles service startup, mocking, and teardown.
"""

import asyncio
import os
import pytest
import httpx
import paho.mqtt.client as mqtt
from typing import Generator, Dict, Any
from unittest.mock import MagicMock, AsyncMock, patch
import json
from datetime import datetime
import time

# Service URLs (update based on your docker-compose setup)
SERVICE_URLS = {
    "map": "http://localhost:8001/api",
    "routing": "http://localhost:8002/api",
    "emergency": "http://localhost:8003/api/emergency",
    "maintenance": "http://localhost:8004/api/maintenance",
    "positioning": "http://localhost:8005",
    "queueing": "http://localhost:8006/api/queue",
    "congestion": "http://localhost:8007/api",
    "chat": "http://localhost:8008",
}

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def http_client() -> Generator[httpx.AsyncClient, None, None]:
    """Provide an HTTP client for service-to-service calls."""
    async with httpx.AsyncClient(timeout=30) as client:
        yield client


@pytest.fixture
def mqtt_client() -> Generator[mqtt.Client, None, None]:
    """Provide an MQTT client for event publishing."""
    client = mqtt.Client()
    
    def on_connect(client, userdata, flags, rc):
        if rc != 0:
            pytest.fail(f"MQTT connection failed with code {rc}")
    
    def on_disconnect(client, userdata, rc):
        pass
    
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        time.sleep(0.5)  # Allow connection to establish
        yield client
    finally:
        client.loop_stop()
        client.disconnect()


@pytest.fixture
def service_urls() -> Dict[str, str]:
    """Provide service URLs for testing."""
    return SERVICE_URLS.copy()


@pytest.fixture
async def map_service_data(http_client: httpx.AsyncClient) -> Dict[str, Any]:
    """Populate Map Service with test data and return important node IDs."""
    try:
        # Create some test nodes
        nodes_data = [
            {"id": "gate_1", "x": 10.0, "y": 20.0, "level": 0, "type": "gate"},
            {"id": "gate_2", "x": 50.0, "y": 60.0, "level": 0, "type": "gate"},
            {"id": "medical", "x": 100.0, "y": 100.0, "level": 0, "type": "poi"},
            {"id": "zone_1", "x": 30.0, "y": 40.0, "level": 0, "type": "normal"},
            {"id": "zone_2", "x": 70.0, "y": 80.0, "level": 0, "type": "normal"},
        ]
        
        for node in nodes_data:
            await http_client.post(
                f"{SERVICE_URLS['map']}/nodes",
                json=node
            )
        
        # Create edges
        edges = [
            {"id": "e1", "from_id": "gate_1", "to_id": "zone_1", "weight": 100.0},
            {"id": "e2", "from_id": "zone_1", "to_id": "medical", "weight": 150.0},
            {"id": "e3", "from_id": "zone_1", "to_id": "zone_2", "weight": 200.0},
            {"id": "e4", "from_id": "gate_2", "to_id": "zone_2", "weight": 120.0},
            {"id": "e5", "from_id": "zone_2", "to_id": "medical", "weight": 180.0},
        ]
        
        for edge in edges:
            await http_client.post(
                f"{SERVICE_URLS['map']}/edges",
                json=edge
            )
        
        # VERY IMPORTANT: Reload Routing Service graph
        await http_client.post(f"{SERVICE_URLS['routing']}/reload")
        
        return {
            "nodes": {node["id"]: node for node in nodes_data},
            "start_node": "gate_1",
            "end_node": "medical",
            "intermediate_node": "zone_1",
        }
    except Exception as e:
        pytest.skip(f"Map Service not available: {e}")


@pytest.fixture
def mock_mqtt_message():
    """Create mock MQTT messages for testing."""
    def _create_message(topic: str, payload: Dict[str, Any]) -> MagicMock:
        msg = MagicMock()
        msg.topic = topic
        msg.payload = json.dumps(payload).encode('utf-8')
        return msg
    return _create_message


@pytest.fixture
def incident_data():
    """Sample incident data for testing."""
    return {
        "description": "Medical emergency at Gate A",
        "severity": "critical",
        "location": "gate_1",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "reporter_id": "staff_001",
    }


@pytest.fixture
def maintenance_task_data():
    """Sample maintenance task data for testing."""
    return {
        "title": "Repair broken seat",
        "location": "zone_1",
        "priority": "high",
        "description": "Row 5, Seat 12 is broken",
        "estimated_duration": 30,
    }


@pytest.fixture
def queue_event_data():
    """Sample queue event data for testing."""
    return {
        "location_id": "gate_1",
        "observed_count": 150,
        "observation_time": datetime.now().isoformat(),
    }


@pytest.fixture
def crowd_density_data():
    """Sample crowd density data for testing."""
    return {
        "zone_id": "zone_1",
        "density": 0.75,
        "timestamp": datetime.now().isoformat(),
    }


# Marker definitions for categorizing tests
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "workflow: mark test as an end-to-end workflow test"
    )
    config.addinivalue_line(
        "markers", "mqtt: mark test as using MQTT events"
    )
    config.addinivalue_line(
        "markers", "service_call: mark test as testing service-to-service calls"
    )


@pytest.fixture
def health_check_timeout():
    """Set timeout for service health checks during test setup."""
    return 5  # seconds


async def wait_for_service(url: str, timeout: int = 10) -> bool:
    """Wait for a service to be available."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # Extract base URL (http://localhost:XXXX) from the potentially prefixed URL
            from urllib.parse import urlparse
            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{base_url}/health", timeout=2)
                if response.status_code == 200:
                    return True
        except (httpx.RequestError, httpx.ConnectError):
            await asyncio.sleep(0.5)
    return False


@pytest.fixture
async def services_ready(event_loop):
    """Verify all services are ready before running tests."""
    # Try to reach each service's health endpoint
    services_status = {}
    for service_name, url in SERVICE_URLS.items():
        try:
            is_ready = await wait_for_service(url, timeout=3)
            services_status[service_name] = is_ready
        except Exception:
            services_status[service_name] = False
    
    # Print readiness status
    ready_count = sum(1 for v in services_status.values() if v)
    print(f"\n✓ Services ready: {ready_count}/{len(SERVICE_URLS)}")
    for service, ready in services_status.items():
        status = "✓" if ready else "✗"
        print(f"  {status} {service}: {SERVICE_URLS[service]}")
    
    if ready_count < len(SERVICE_URLS):
        pytest.skip(f"Only {ready_count}/{len(SERVICE_URLS)} services are available")
    
    yield services_status
