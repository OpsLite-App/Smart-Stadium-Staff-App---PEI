"""
Tests for StaffCoordinator
"""

import pytest
from staff_coordinator import StaffCoordinator


def test_coordinator_basics():
    """Test basic coordinator functionality"""
    coordinator = StaffCoordinator()
    
    # Register staff
    staff = coordinator.register_staff(
        staff_id="test-001",
        name="Test Staff",
        role="cleaning",
        current_location="NODE-001"
    )
    
    assert staff is not None
    assert staff.id == "test-001"
    assert staff.name == "Test Staff"
    assert staff.is_available is True
    
    # Get staff info
    staff_info = coordinator.get_staff("test-001")
    assert staff_info["id"] == "test-001"
    
    # Update location
    success = coordinator.update_location("test-001", "NODE-002")
    assert success is True
    assert coordinator.get_location("test-001") == "NODE-002"
    
    # Set unavailable
    success = coordinator.set_availability("test-001", False)
    assert success is True
    assert coordinator.is_available("test-001") is False
    
    # Get all staff
    all_staff = coordinator.get_all_staff()
    assert len(all_staff) == 1
    assert all_staff[0]["id"] == "test-001"


def test_coordinator_multiple_staff():
    """Test coordinator with multiple staff"""
    coordinator = StaffCoordinator()
    
    # Register multiple staff
    coordinator.register_staff("s1", "Staff 1", "cleaning", "LOC-1")
    coordinator.register_staff("s2", "Staff 2", "supervisor", "LOC-2")
    coordinator.register_staff("s3", "Staff 3", "cleaning", "LOC-3")
    
    # Make one unavailable
    coordinator.set_availability("s2", False)
    
    # Get available staff
    available = coordinator.get_available_staff()
    assert len(available) == 2  # s1 and s3 should be available
    available_ids = [s["id"] for s in available]
    assert "s1" in available_ids
    assert "s2" not in available_ids
    assert "s3" in available_ids
    
    # Get by role
    cleaners = coordinator.get_staff_by_role("cleaning")
    assert len(cleaners) == 2
    
    # Stats summary
    stats = coordinator.get_stats_summary()
    assert stats["total_staff"] == 3
    assert stats["available"] == 2
    assert stats["busy"] == 1


def test_coordinator_clear():
    """Test clearing coordinator"""
    coordinator = StaffCoordinator()
    
    coordinator.register_staff("s1", "Staff 1", "cleaning", "LOC-1")
    coordinator.register_staff("s2", "Staff 2", "cleaning", "LOC-2")
    
    assert len(coordinator.get_all_staff()) == 2
    
    coordinator.clear_all()
    assert len(coordinator.get_all_staff()) == 0