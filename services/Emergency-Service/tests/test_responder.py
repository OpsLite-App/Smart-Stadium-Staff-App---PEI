import pytest
from unittest.mock import AsyncMock, patch
from nearest_responder import (
    StaffTracker, StaffMember, StaffRole, StaffStatus,
    IncidentRequest, find_nearest_responder
)

@pytest.fixture
def mock_staff_tracker():
    tracker = StaffTracker()
    tracker.add_staff(StaffMember("S1", StaffRole.SECURITY, "N1", StaffStatus.AVAILABLE, "Safe1"))
    tracker.add_staff(StaffMember("S2", StaffRole.SECURITY, "N10", StaffStatus.AVAILABLE, "Safe2"))
    tracker.add_staff(StaffMember("M1", StaffRole.MEDICAL, "N10", StaffStatus.AVAILABLE, "Doc1"))
    return tracker

@pytest.mark.asyncio
async def test_find_nearest_responder_selection(mock_staff_tracker):
    incident = IncidentRequest(
        id="inc-123",
        location="N11",                     # close to N10, far from N1
        type="fight",
        priority="high",
        required_role=StaffRole.SECURITY,
        timestamp="2024-05-20T10:00:00Z"
    )

    # Mock responses for the two security guards (S1 then S2)
    mock_responses = [
        {"path": ["N1", "N5", "N11"], "distance": 500, "eta_seconds": 300},
        {"path": ["N10", "N11"], "distance": 50, "eta_seconds": 30}
    ]

    mock_get = AsyncMock()
    mock_get.side_effect = [
        AsyncMock(status_code=200, json=lambda: mock_responses[0]),
        AsyncMock(status_code=200, json=lambda: mock_responses[1])
    ]

    # Patch resolve_positions to avoid calling Positioning Service
    with patch.object(mock_staff_tracker, 'resolve_positions', new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = None
        with patch("nearest_responder.httpx.AsyncClient.get", mock_get):
            assignment = await find_nearest_responder(
                incident, mock_staff_tracker, "http://fake-url"
            )

    assert assignment is not None
    assert assignment.staff_id == "S2"          # the nearest responder
    assert assignment.staff_role == StaffRole.SECURITY
    assert assignment.eta_seconds == 30
    assert assignment.distance == 50