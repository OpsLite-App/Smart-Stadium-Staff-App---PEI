"""
NEAREST RESPONDER ALGORITHM - Emergency Service
Finds optimal staff member for emergency response by calling Routing Service
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import httpx
import os


class StaffRole(Enum):
    """Staff roles in stadium"""
    SECURITY = "security"
    CLEANING = "cleaning"
    SUPERVISOR = "supervisor"
    MEDICAL = "medical"


class StaffStatus(Enum):
    """Staff availability status"""
    AVAILABLE = "available"
    BUSY = "busy"
    OFF_DUTY = "off_duty"
    RESPONDING = "responding"


@dataclass
class StaffMember:
    """Staff member representation"""
    id: str
    role: StaffRole
    current_position: str  # Node ID
    status: StaffStatus
    name: Optional[str] = None
    
    def is_available(self) -> bool:
        """Check if staff is available for assignment"""
        return self.status == StaffStatus.AVAILABLE


@dataclass
class IncidentRequest:
    """
    Emergency incident request for responder assignment
    
    NOTE: This is a dataclass for business logic, NOT the SQLAlchemy model.
    Use this when calling nearest_responder functions.
    """
    id: str
    location: str  # Node ID
    type: str  # "medical", "fire", "fight", "injury", etc.
    priority: str  # "low", "medium", "high", "critical"
    required_role: StaffRole
    timestamp: str
    
    def get_priority_score(self) -> int:
        """Convert priority to numeric score"""
        scores = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        return scores.get(self.priority.lower(), 2)


@dataclass
class ResponderAssignment:
    """Result of responder assignment"""
    staff_id: str
    staff_role: StaffRole
    current_position: str
    incident_location: str
    path: List[str]
    distance: float
    eta_seconds: int
    priority: str


POSITIONING_SERVICE_URL = os.getenv("POSITIONING_SERVICE_URL", "http://positioning-service:8004")
ROUTING_SERVICE_URL_ENV = os.getenv("ROUTING_SERVICE_URL", "http://routing-service:8002")


async def _get_staff_node_from_positioning(staff_id: str, routing_service_url: str) -> Optional[str]:
    """
    Fetch staff (x, y) from Positioning Service and convert to nearest graph Node ID
    via Routing Service /api/route/nearest.
    Returns None if positioning or routing is unavailable.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            pos_resp = await client.get(f"{POSITIONING_SERVICE_URL}/position/{staff_id}")
            if pos_resp.status_code != 200:
                return None
            pos = pos_resp.json()

            # Ask routing service for the nearest node to these coordinates
            nearest_resp = await client.get(
                f"{routing_service_url}/api/route/nearest-to-coords",
                params={"x": pos["x"], "y": pos["y"]}
            )
            if nearest_resp.status_code == 200:
                return nearest_resp.json().get("node_id")
    except httpx.RequestError:
        pass
    return None


class StaffTracker:
    """
    Tracks staff positions and availability.
    Positions are resolved live from the Positioning Service when available.
    """

    def __init__(self):
        self.staff: Dict[str, StaffMember] = {}

    def add_staff(self, staff: StaffMember):
        self.staff[staff.id] = staff

    def update_position(self, staff_id: str, new_position: str):
        if staff_id in self.staff:
            self.staff[staff_id].current_position = new_position

    def update_status(self, staff_id: str, new_status: StaffStatus):
        if staff_id in self.staff:
            self.staff[staff_id].status = new_status

    def get_available_by_role(self, role: StaffRole) -> List[StaffMember]:
        return [s for s in self.staff.values() if s.role == role and s.is_available()]

    def get_staff(self, staff_id: str) -> Optional[StaffMember]:
        return self.staff.get(staff_id)

    async def resolve_positions(self, routing_service_url: str):
        """
        For every registered staff member, try to fetch their live position
        from the Positioning Service and update current_position with the
        nearest graph node. Falls back to the existing static position.
        """
        for staff in self.staff.values():
            node = await _get_staff_node_from_positioning(staff.id, routing_service_url)
            if node:
                staff.current_position = node


async def find_nearest_responder(
    incident: IncidentRequest,
    staff_tracker: StaffTracker,
    routing_service_url: str
) -> Optional[ResponderAssignment]:
    # Refresh positions from Positioning Service before evaluating
    await staff_tracker.resolve_positions(routing_service_url)

    available_staff = staff_tracker.get_available_by_role(incident.required_role)
    
    if not available_staff:
        print(f"❌ No available {incident.required_role.value} staff found")
        return None
    
    # Priority weight for ETA calculation
    priority_weights = {
        "critical": 0.5,
        "high": 0.75,
        "medium": 1.0,
        "low": 1.5
    }
    weight = priority_weights.get(incident.priority.lower(), 1.0)
    
    best_assignment = None
    best_weighted_eta = float('inf')
    
    # Evaluate each available staff member
    async with httpx.AsyncClient(timeout=5.0) as client:
        for staff in available_staff:
            try:
                # 🔥 CALL ROUTING SERVICE to calculate route
                response = await client.get(
                    f"{routing_service_url}/api/route",
                    params={
                        "from_node": staff.current_position,
                        "to_node": incident.location,
                        "avoid_crowds": True  # Responders should avoid crowds
                    }
                )
                
                if response.status_code != 200:
                    print(f"⚠️  Failed to get route for {staff.id}")
                    continue
                
                route_data = response.json()
                
                path = route_data["path"]
                distance = route_data["distance"]
                eta_seconds = route_data["eta_seconds"]
                
                # Apply priority weight
                weighted_eta = eta_seconds * weight
                
                # Update best if this is faster
                if weighted_eta < best_weighted_eta:
                    best_weighted_eta = weighted_eta
                    best_assignment = ResponderAssignment(
                        staff_id=staff.id,
                        staff_role=staff.role,
                        current_position=staff.current_position,
                        incident_location=incident.location,
                        path=path,
                        distance=distance,
                        eta_seconds=eta_seconds,
                        priority=incident.priority
                    )
                    
            except httpx.RequestError as e:
                print(f"❌ Routing Service error for {staff.id}: {e}")
                continue
    
    if best_assignment:
        print(f"✅ Found responder: {best_assignment.staff_id} (ETA: {best_assignment.eta_seconds}s)")
    else:
        print(f"❌ No reachable responder found")
    
    return best_assignment


async def find_multiple_responders(
    incident: IncidentRequest,
    staff_tracker: StaffTracker,
    routing_service_url: str,
    num_responders: int = 3
) -> List[ResponderAssignment]:
    """Find multiple responders for large-scale emergency"""
    # Refresh positions from Positioning Service before evaluating
    await staff_tracker.resolve_positions(routing_service_url)

    available_staff = staff_tracker.get_available_by_role(incident.required_role)
    
    if not available_staff:
        return []
    
    assignments = []
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        for staff in available_staff:
            try:
                # Call Routing Service
                response = await client.get(
                    f"{routing_service_url}/api/route",
                    params={
                        "from_node": staff.current_position,
                        "to_node": incident.location,
                        "avoid_crowds": True
                    }
                )
                
                if response.status_code != 200:
                    continue
                
                route_data = response.json()
                
                assignments.append(ResponderAssignment(
                    staff_id=staff.id,
                    staff_role=staff.role,
                    current_position=staff.current_position,
                    incident_location=incident.location,
                    path=route_data["path"],
                    distance=route_data["distance"],
                    eta_seconds=route_data["eta_seconds"],
                    priority=incident.priority
                ))
                
            except httpx.RequestError as e:
                print(f"❌ Routing error for {staff.id}: {e}")
                continue
    
    # Sort by ETA and return top N
    assignments.sort(key=lambda a: a.eta_seconds)
    return assignments[:num_responders]


async def assign_responder_to_incident(
    incident: IncidentRequest,
    staff_tracker: StaffTracker,
    routing_service_url: str
) -> Optional[ResponderAssignment]:
    """
    Complete workflow: Find responder and update their status
    
    1. Find nearest available responder
    2. Update staff status to RESPONDING
    3. Return assignment
    
    Returns:
        ResponderAssignment or None if no one available
    """
    
    assignment = await find_nearest_responder(incident, staff_tracker, routing_service_url)
    
    if assignment:
        # Update staff status to RESPONDING
        staff_tracker.update_status(assignment.staff_id, StaffStatus.RESPONDING)
        print(f"📍 {assignment.staff_id} dispatched to {incident.location}")
    
    return assignment


async def calculate_response_coverage(
    staff_tracker: StaffTracker,
    routing_service_url: str,
    test_locations: List[str],
    role: StaffRole
) -> Dict[str, float]:
    """
    Calculate response coverage for different stadium areas
    
    For each test location, calculate average ETA from available staff
    
    Use case: Evaluate if staff are well-distributed
    
    Returns:
        {location_id: average_eta_seconds}
    """
    
    available_staff = staff_tracker.get_available_by_role(role)
    
    if not available_staff:
        return {}
    
    coverage = {}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for location in test_locations:
            etas = []
            
            for staff in available_staff:
                try:
                    response = await client.get(
                        f"{routing_service_url}/api/route",
                        params={
                            "from_node": staff.current_position,
                            "to_node": location
                        }
                    )
                    
                    if response.status_code == 200:
                        route_data = response.json()
                        etas.append(route_data["eta_seconds"])
                        
                except httpx.RequestError:
                    continue
            
            if etas:
                coverage[location] = sum(etas) / len(etas)
            else:
                coverage[location] = float('inf')
    
    return coverage


# ========== HELPER FUNCTIONS ==========

def create_mock_staff_tracker(num_per_role: int = 3) -> StaffTracker:
    """
    Create mock staff tracker for testing
    
    Note: In production, positions would be fetched from real-time tracking system
    """
    tracker = StaffTracker()
    
    # Mock entrance positions
    entrance_nodes = ["N1", "N5", "N10", "N15", "N20", "N21"]
    
    staff_id = 1
    
    for role in StaffRole:
        for i in range(num_per_role):
            # Distribute staff across different positions
            position_idx = (staff_id - 1) % len(entrance_nodes)
            position = entrance_nodes[position_idx]
            
            staff = StaffMember(
                id=f"STAFF_{role.value.upper()}_{staff_id:03d}",
                role=role,
                current_position=position,
                status=StaffStatus.AVAILABLE,
                name=f"{role.value.title()} {staff_id}"
            )
            
            tracker.add_staff(staff)
            staff_id += 1
    
    return tracker


# ========== EXAMPLE USAGE ==========

async def example_usage():
    """Example of how to use this module"""
    
    # Setup
    ROUTING_SERVICE_URL = os.getenv("ROUTING_SERVICE_URL", "http://routing-service:8002")
    staff_tracker = create_mock_staff_tracker(num_per_role=3)
    
    # Create incident REQUEST (not the DB model!)
    incident = IncidentRequest(
        id="inc-001",
        location="N42",
        type="medical",
        priority="high",
        required_role=StaffRole.SECURITY,
        timestamp="2025-10-06T19:22:00Z"
    )
    
    # Find nearest responder
    assignment = await find_nearest_responder(
        incident,
        staff_tracker,
        ROUTING_SERVICE_URL
    )
    
    if assignment:
        print(f"\n✅ Responder assigned:")
        print(f"   Staff: {assignment.staff_id}")
        print(f"   Role: {assignment.staff_role.value}")
        print(f"   Distance: {assignment.distance:.1f}m")
        print(f"   ETA: {assignment.eta_seconds}s")
        print(f"   Path: {' → '.join(assignment.path)}")
    else:
        print("\n❌ No responder available")


if __name__ == "__main__":
    import asyncio
    asyncio.run(example_usage())
