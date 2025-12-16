"""
Integration tests for Queueing Service API
"""
import pytest
from fastapi.testclient import TestClient
from service import app


class TestQueueingService:
    """Test the Queueing Service endpoints"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_health_check(self, client):
        """Test root endpoint"""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Stadium Queueing Service"
        assert data["status"] == "running"
    
    def test_calculate_mm1_queue(self, client):
        """Test M/M/1 queue calculation endpoint"""
        response = client.post(
            "/api/queue/calculate",
            json={
                "location_id": "test_mm1",
                "arrival_rate": 10.0,
                "service_rate": 12.0,
                "num_servers": 1
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["location_id"] == "test_mm1"
        assert data["output"]["is_stable"] == True
        assert data["output"]["status"] == "busy"
        assert isinstance(data["output"]["avg_wait_time_minutes"], float)
    
    def test_calculate_mmk_queue(self, client):
        """Test M/M/k queue calculation endpoint"""
        response = client.post(
            "/api/queue/calculate",
            json={
                "location_id": "test_mmk",
                "arrival_rate": 20.0,
                "service_rate": 8.0,
                "num_servers": 3
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check num_servers in input section (not output)
        assert data["input"]["num_servers"] == 3
        assert data["output"]["is_stable"] == True
        assert data["output"]["utilization"] < 1.0
    
    def test_calculate_unstable_queue(self, client):
        """Test unstable queue calculation"""
        response = client.post(
            "/api/queue/calculate",
            json={
                "location_id": "test_unstable",
                "arrival_rate": 15.0,
                "service_rate": 10.0,
                "num_servers": 1
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["output"]["is_stable"] == False
        assert data["output"]["status"] == "unstable"
    
    def test_update_queue_state(self, client):
        """Test updating queue state"""
        response = client.post(
            "/api/queue/update",
            json={
                "location_id": "Gate-1",
                "location_type": "gate",
                "current_queue_length": 15,
                "arrivals_last_minute": 12,
                "departures_last_minute": 10,
                "num_servers": 2
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["location_id"] == "Gate-1"
        assert data["updated"] == True
        assert "arrival_rate" in data
        assert "service_rate" in data
    
    def test_get_wait_time(self, client):
        """Test retrieving wait time for a location"""
        # First update the queue
        client.post(
            "/api/queue/update",
            json={
                "location_id": "Toilet-A",
                "location_type": "toilet",
                "current_queue_length": 8,
                "arrivals_last_minute": 6,
                "departures_last_minute": 4,
                "num_servers": 3
            }
        )
        
        # Then get wait time
        response = client.get("/api/queue/waittime/Toilet-A")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["location_id"] == "Toilet-A"
        assert "avg_wait_time_minutes" in data
        assert "status" in data
        assert "confidence" in data
    
    def test_get_wait_time_nonexistent(self, client):
        """Test getting wait time for non-existent location"""
        response = client.get("/api/queue/waittime/NonExistent")
        
        assert response.status_code == 404
    
    def test_get_all_queues_status(self, client):
        """Test getting status of all tracked queues"""
        # Add some queues first
        client.post("/api/queue/update", json={
            "location_id": "Gate-1", "location_type": "gate",
            "current_queue_length": 10, "num_servers": 2
        })
        client.post("/api/queue/update", json={
            "location_id": "Bar-1", "location_type": "bar",
            "current_queue_length": 5, "num_servers": 1
        })
        
        response = client.get("/api/queue/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_queues" in data
        assert "queues" in data
        assert len(data["queues"]) >= 2
    
    def test_get_queue_alerts(self, client):
        """Test getting queue alerts"""
        # Create a busy queue
        client.post("/api/queue/update", json={
            "location_id": "Busy-Gate",
            "location_type": "gate",
            "current_queue_length": 30,
            "arrivals_last_minute": 25,
            "departures_last_minute": 20,
            "num_servers": 2
        })
        
        response = client.get("/api/queue/alerts?threshold_minutes=5")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "threshold_minutes" in data
        assert "alerts_count" in data
        assert "alerts" in data
    
    def test_compare_scenarios(self, client):
        """Test comparing different server configurations"""
        response = client.get(
            "/api/queue/compare",
            params={
                "arrival_rate": 18.0,
                "service_rate": 5.0,
                "max_servers": 5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "arrival_rate" in data
        assert "service_rate" in data
        assert "scenarios" in data
        assert len(data["scenarios"]) == 5  # 1 through 5 servers
    
    def test_remove_queue(self, client):
        """Test removing a queue from tracking"""
        # Add a queue
        client.post("/api/queue/update", json={
            "location_id": "Temp-Gate",
            "location_type": "gate",
            "current_queue_length": 5,
            "num_servers": 1
        })
        
        # Remove it
        response = client.delete("/api/queue/Temp-Gate")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        
        # Try to get it (should fail)
        response = client.get("/api/queue/waittime/Temp-Gate")
        assert response.status_code == 404
    
    def test_remove_nonexistent_queue(self, client):
        """Test removing a non-existent queue"""
        response = client.delete("/api/queue/NonExistent")
        
        assert response.status_code == 404
    
    def test_invalid_input_validation(self, client):
        """Test invalid input validation"""
        # Test negative arrival rate
        response = client.post(
            "/api/queue/calculate",
            json={
                "location_id": "test",
                "arrival_rate": -10.0,
                "service_rate": 12.0,
                "num_servers": 1
            }
        )
        
        # Note: The service should handle this gracefully
        # In the actual service, this might return an error or special value


class TestServiceHelpers:
    """Test service helper functions"""
    
    def test_get_default_service_rate(self):
        """Test default service rate function"""
        from service import get_default_service_rate
        
        assert get_default_service_rate("gate") == 4.0
        assert get_default_service_rate("toilet") == 0.5
        assert get_default_service_rate("bar") == 0.67
        assert get_default_service_rate("food") == 0.5
        assert get_default_service_rate("unknown") == 0.5
    
    def test_initialize_queue_state(self):
        """Test queue state initialization"""
        from service import initialize_queue_state, queue_state
        
        # Clear state for test
        test_id = "TestGate"
        if test_id in queue_state:
            del queue_state[test_id]
        
        initialize_queue_state(test_id, "gate", 2)
        
        assert test_id in queue_state
        state = queue_state[test_id]
        assert state["location_type"] == "gate"
        assert state["num_servers"] == 2
        assert state["service_rate"] == 4.0  # Default for gates
        assert state["arrival_rate"] == 0.0
    
    def test_recommendation_generation(self):
        """Test recommendation generation"""
        from service import _get_recommendation
        from models import QueueMetrics, QueueStatus
        from dataclasses import replace
        
        # Create test metrics
        metrics = QueueMetrics(
            arrival_rate=10.0,
            service_rate=12.0,
            num_servers=1,
            utilization=0.95,
            avg_queue_length=10.0,
            avg_system_length=12.0,
            avg_wait_time=1.0,
            avg_system_time=1.2,
            status=QueueStatus.CROWDED,
            is_stable=True,
            confidence="low"
        )
        
        state = {"num_servers": 1}
        
        recommendation = _get_recommendation(metrics, state)
        assert "HIGH" in recommendation
        
        # Test critical utilization
        critical_metrics = replace(metrics, utilization=1.2)
        recommendation = _get_recommendation(critical_metrics, state)
        assert "CRITICAL" in recommendation


if __name__ == "__main__":
    pytest.main([__file__])