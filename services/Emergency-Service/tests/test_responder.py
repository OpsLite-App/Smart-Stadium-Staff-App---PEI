import pytest
from unittest.mock import AsyncMock, patch
from nearest_responder import (
    StaffTracker, StaffMember, StaffRole, StaffStatus,
    IncidentRequest, find_nearest_responder
)

@pytest.fixture
def mock_staff_tracker():
    tracker = StaffTracker()
    # Adds a security guard far away
    tracker.add_staff(StaffMember("S1", StaffRole.SECURITY, "N1", StaffStatus.AVAILABLE, "Safe1"))
    # Adds a security guard nearby
    tracker.add_staff(StaffMember("S2", StaffRole.SECURITY, "N10", StaffStatus.AVAILABLE, "Safe2"))
    # Adds a medic (should not be chosen if we request security)
    tracker.add_staff(StaffMember("M1", StaffRole.MEDICAL, "N10", StaffStatus.AVAILABLE, "Doc1"))
    return tracker

@pytest.mark.asyncio
async def test_find_nearest_responder_selection(mock_staff_tracker):
    incident = IncidentRequest(
        id="inc-123",
        location="N11",  # Near N10
        type="fight",
        priority="high",
        required_role=StaffRole.SECURITY,
        timestamp="2024-05-20T10:00:00Z"
    )

    # Mock of the routing service responses (in order: S1, S2)
    mock_responses = [
        {"path": ["N1", "N5", "N11"], "distance": 500, "eta_seconds": 300},  # S1
        {"path": ["N10", "N11"], "distance": 50, "eta_seconds": 30}          # S2
    ]

    # Mock of AsyncClient.get method
    mock_get = AsyncMock()
    mock_get.side_effect = [
        AsyncMock(status_code=200, json=AsyncMock(return_value=mock_responses[0])),
        AsyncMock(status_code=200, json=AsyncMock(return_value=mock_responses[1]))
    ]

    with patch("nearest_responder.httpx.AsyncClient.get", mock_get):
        assignment = await find_nearest_responder(
            incident, mock_staff_tracker, "http://fake-url"
        )

    assert assignment is not None
    assert assignment.staff_id == "S2"          # The nearest
    assert assignment.staff_role == StaffRole.SECURITY
    assert assignment.eta_seconds == 30
    assert assignment.distance == 50