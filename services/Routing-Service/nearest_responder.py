"""
NEAREST RESPONDER ALGORITHM
Finds optimal staff member for emergency response
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from astar import Graph, HazardMap, hazard_aware_astar, calculate_eta_with_role


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
class EmergencyIncident:
    """Emergency incident representation"""
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


class StaffTracker:
    """
    Tracks staff positions and availability
    In production, this would be a separate microservice
    """
    
    def __init__(self):
        self.staff: Dict[str, StaffMember] = {}
    
    def add_staff(self, staff: StaffMember):
        """Register a staff member"""
        self.staff[staff.id] = staff
    
    def update_position(self, staff_id: str, new_position: str):
        """Update staff position"""
        if staff_id in self.staff:
            self.staff[staff_id].current_position = new_position
    
    def update_status(self, staff_id: str, new_status: StaffStatus):
        """Update staff availability status"""
        if staff_id in self.staff:
            self.staff[staff_id].status = new_status
    
    def get_available_by_role(self, role: StaffRole) -> List[StaffMember]:
        """Get all available staff with specific role"""
        return [
            staff for staff in self.staff.values()
            if staff.role == role and staff.is_available()
        ]
    
    def get_staff(self, staff_id: str) -> Optional[StaffMember]:
        """Get staff by ID"""
        return self.staff.get(staff_id)


def find_nearest_responder(
    graph: Graph,
    incident: EmergencyIncident,
    staff_tracker: StaffTracker,
    hazard_map: HazardMap
) -> Optional[ResponderAssignment]:
    """
    NEAREST RESPONDER ALGORITHM
    
    For each staff member with correct role and status AVAILABLE:
    1. Calculate route to incident using hazard_aware_astar
    2. Calculate ETA based on distance and role speed
    3. Order by (priority_weight * ETA)
    4. Return staff with minimum weighted ETA
    
    Priority weights:
    - critical: ETA x 0.5 (prioritize speed)
    - high: ETA x 0.75
    - medium: ETA x 1.0
    - low: ETA x 1.5 (ok to be slower)
    
    Args:
        graph: Stadium graph
        incident: Emergency incident
        staff_tracker: Staff tracking system
        hazard_map: Current hazards
    
    Returns:
        ResponderAssignment with best staff member, or None if no one available
    """
    
    # Get available staff with required role
    available_staff = staff_tracker.get_available_by_role(incident.required_role)
    
    if not available_staff:
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
    for staff in available_staff:
        # Calculate route from staff position to incident
        path, distance = hazard_aware_astar(
            graph,
            staff.current_position,
            incident.location,
            hazard_map,
            avoid_crowds=True  # Responders should avoid crowds
        )
        
        if not path:
            continue  # No path available
        
        # Calculate ETA based on role speed
        eta_seconds = calculate_eta_with_role(distance, staff.role.value)
        
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
    
    return best_assignment


def find_multiple_responders(
    graph: Graph,
    incident: EmergencyIncident,
    staff_tracker: StaffTracker,
    hazard_map: HazardMap,
    num_responders: int = 3
) -> List[ResponderAssignment]:
    """
    Find multiple responders for large-scale emergency
    
    Use case: Fire alarm requires multiple security staff
    
    Returns top N nearest available staff members
    """
    
    available_staff = staff_tracker.get_available_by_role(incident.required_role)
    
    if not available_staff:
        return []
    
    assignments = []
    
    for staff in available_staff:
        path, distance = hazard_aware_astar(
            graph,
            staff.current_position,
            incident.location,
            hazard_map,
            avoid_crowds=True
        )
        
        if not path:
            continue
        
        eta_seconds = calculate_eta_with_role(distance, staff.role.value)
        
        assignments.append(ResponderAssignment(
            staff_id=staff.id,
            staff_role=staff.role,
            current_position=staff.current_position,
            incident_location=incident.location,
            path=path,
            distance=distance,
            eta_seconds=eta_seconds,
            priority=incident.priority
        ))
    
    # Sort by ETA and return top N
    assignments.sort(key=lambda a: a.eta_seconds)
    return assignments[:num_responders]


def assign_responder_to_incident(
    graph: Graph,
    incident: EmergencyIncident,
    staff_tracker: StaffTracker,
    hazard_map: HazardMap
) -> Optional[ResponderAssignment]:
    """
    Complete workflow: Find responder and update their status
    
    1. Find nearest available responder
    2. Update staff status to RESPONDING
    3. Return assignment
    
    Returns:
        ResponderAssignment or None if no one available
    """
    
    assignment = find_nearest_responder(graph, incident, staff_tracker, hazard_map)
    
    if assignment:
        # Update staff status
        staff_tracker.update_status(assignment.staff_id, StaffStatus.RESPONDING)
    
    return assignment


def calculate_response_coverage(
    graph: Graph,
    staff_tracker: StaffTracker,
    hazard_map: HazardMap,
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
    
    for location in test_locations:
        etas = []
        
        for staff in available_staff:
            path, distance = hazard_aware_astar(
                graph,
                staff.current_position,
                location,
                hazard_map
            )
            
            if path:
                eta = calculate_eta_with_role(distance, staff.role.value)
                etas.append(eta)
        
        if etas:
            coverage[location] = sum(etas) / len(etas)
        else:
            coverage[location] = float('inf')
    
    return coverage


# ========== HELPER FUNCTIONS ==========

def create_mock_staff_tracker(graph: Graph, num_per_role: int = 3) -> StaffTracker:
    """
    Create mock staff tracker for testing
    
    Distributes staff across entrance gates
    """
    tracker = StaffTracker()
    
    # Get entrance nodes (prefer gates, fallback to first nodes)
    entrance_nodes = [n.id for n in graph.nodes.values() if n.type in ["gate", "entrance"]]
    
    if not entrance_nodes:
        # Fallback to distributed positions across the map
        all_nodes = list(graph.nodes.keys())
        entrance_nodes = all_nodes[::max(1, len(all_nodes) // 6)][:6]  # Pick 6 distributed nodes
    
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