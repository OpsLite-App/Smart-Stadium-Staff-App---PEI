"""
Staff API Endpoint Tests
Tests for staff registration, location updates, availability, and listing
"""

import pytest


def test_root_endpoint(client):
    """Basic health check"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Maintenance Service"
    assert data["status"] == "running"


def test_register_staff(client):
    """Test staff registration"""
    response = client.post(
        "/api/maintenance/staff/register",
        params={
            "staff_id": "staff-001",
            "name": "Test Staff",
            "role": "cleaning",
            "current_location": "NODE-101"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["staff_id"] == "staff-001"
    assert data["name"] == "Test Staff"


def test_get_available_staff(client):
    """Test getting available staff"""
    # Register staff first
    client.post(
        "/api/maintenance/staff/register",
        params={
            "staff_id": "staff-002",
            "name": "Available Staff",
            "role": "cleaning",
            "current_location": "NODE-102"
        }
    )
    
    response = client.get("/api/maintenance/staff/available")
    assert response.status_code == 200
    staff_list = response.json()
    assert len(staff_list) >= 1


def test_update_staff_location(client):
    """Test updating staff location"""
    # Register staff
    client.post(
        "/api/maintenance/staff/register",
        params={
            "staff_id": "move-staff",
            "name": "Moving Staff",
            "role": "cleaning",
            "current_location": "LOC-001"
        }
    )
    
    # Update location
    response = client.patch(
        "/api/maintenance/staff/move-staff/location",
        params={"location": "LOC-002"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["location"] == "LOC-002"


def test_staff_availability(client):
    """Test staff availability"""
    # Register staff
    client.post(
        "/api/maintenance/staff/register",
        params={
            "staff_id": "avail-staff",
            "name": "Availability Test",
            "role": "cleaning",
            "current_location": "AVL-001"
        }
    )
    
    # Make unavailable
    response = client.patch(
        "/api/maintenance/staff/avail-staff/availability",
        params={"is_available": False}
    )
    assert response.status_code == 200
    
    # Check available staff (should be empty or not include this staff)
    response = client.get("/api/maintenance/staff/available")
    available = response.json()
    assert not any(staff["id"] == "avail-staff" for staff in available)


def test_get_all_staff(client):
    """Test getting all staff"""
    # Register a few staff members
    for i in range(3):
        client.post(
            "/api/maintenance/staff/register",
            params={
                "staff_id": f"all-staff-{i}",
                "name": f"Staff {i}",
                "role": "cleaning",
                "current_location": f"NODE-{i}"
            }
        )
    
    response = client.get("/api/maintenance/staff")
    assert response.status_code == 200
    staff_list = response.json()
    assert len(staff_list) >= 3