"""
API HANDLERS - FastAPI Route Handlers
Separates business logic from API layer
"""
# NOTE: EMERGENCIES incident_type? 

from typing import List, Optional, Dict
from fastapi import HTTPException
from pydantic import BaseModel

from astar import (
    Graph, HazardMap, HazardType,
    hazard_aware_astar, find_nearest_node,
    multi_destination_route, find_evacuation_route,
    calculate_eta, calculate_eta_with_role
)
from nearest_responder import (
    StaffTracker, EmergencyIncident, StaffRole,
    find_nearest_responder, find_multiple_responders,
    assign_responder_to_incident
)


# ========== REQUEST/RESPONSE MODELS ==========

class RouteRequest(BaseModel):
    from_node: str
    to_node: str
    avoid_crowds: bool = False


class RouteResponse(BaseModel):
    path: List[str]
    distance: float
    eta_seconds: int
    waypoints: List[Dict]


class MultiDestinationRequest(BaseModel):
    start: str
    destinations: List[str]


class NearestRequest(BaseModel):
    target: str
    candidates: List[str]


class EmergencyRequest(BaseModel):
    location: str
    incident_type: str  # "medical", "fire", "fight", etc.
    priority: str = "high"  # "low", "medium", "high", "critical"
    required_role: str = "security"  # "security", "medical", "cleaning"


class ResponderResponse(BaseModel):
    staff_id: str
    role: str
    current_position: str
    incident_location: str
    path: List[str]
    distance: float
    eta_seconds: int
    priority: str
    waypoints: List[Dict]


class HazardUpdate(BaseModel):
    node_id: str
    hazard_type: str  # "smoke", "crowd", "fire", "spill", "structural"
    severity: float = 1.0  # 0.0-1.0


# ========== API HANDLERS ==========

class RouteAPIHandler:
    """Handles all routing-related API requests"""
    
    def __init__(self, graph: Graph, hazard_map: HazardMap):
        self.graph = graph
        self.hazard_map = hazard_map
    
    def get_route(self, request: RouteRequest) -> RouteResponse:
        """
        Calculate shortest path between two nodes
        """
        # Validate nodes exist
        if request.from_node not in self.graph.nodes:
            raise HTTPException(
                status_code=404,
                detail=f"Start node {request.from_node} not found"
            )
        
        if request.to_node not in self.graph.nodes:
            raise HTTPException(
                status_code=404,
                detail=f"End node {request.to_node} not found"
            )
        
        # Calculate path
        path, distance = hazard_aware_astar(
            self.graph,
            request.from_node,
            request.to_node,
            self.hazard_map,
            request.avoid_crowds
        )
        
        if not path:
            raise HTTPException(
                status_code=404,
                detail="No path found (may be blocked by closures)"
            )
        
        # Build waypoints
        waypoints = self._build_waypoints(path)
        
        return RouteResponse(
            path=path,
            distance=round(distance, 2),
            eta_seconds=calculate_eta(distance),
            waypoints=waypoints
        )
    
    def get_multi_destination_route(self, request: MultiDestinationRequest) -> RouteResponse:
        """
        Calculate route visiting multiple destinations
        """
        # Validate nodes
        if request.start not in self.graph.nodes:
            raise HTTPException(status_code=404, detail=f"Start node {request.start} not found")
        
        for dest in request.destinations:
            if dest not in self.graph.nodes:
                raise HTTPException(status_code=404, detail=f"Destination {dest} not found")
        
        # Calculate route
        path, distance = multi_destination_route(
            self.graph,
            request.start,
            request.destinations,
            self.hazard_map
        )
        
        if not path:
            raise HTTPException(status_code=404, detail="No path found")
        
        waypoints = self._build_waypoints(path)
        
        return RouteResponse(
            path=path,
            distance=round(distance, 2),
            eta_seconds=calculate_eta(distance),
            waypoints=waypoints
        )
    
    def find_nearest_node_handler(self, request: NearestRequest) -> RouteResponse:
        """
        Find nearest node from a list of candidates
        """
        # Validate target
        if request.target not in self.graph.nodes:
            raise HTTPException(status_code=404, detail=f"Target {request.target} not found")
        
        # Validate candidates
        for candidate in request.candidates:
            if candidate not in self.graph.nodes:
                raise HTTPException(status_code=404, detail=f"Candidate {candidate} not found")
        
        # Find nearest
        nearest, path, distance = find_nearest_node(
            self.graph,
            request.target,
            request.candidates,
            self.hazard_map
        )
        
        if not nearest:
            raise HTTPException(status_code=404, detail="No reachable candidate found")
        
        waypoints = self._build_waypoints(path)
        
        return RouteResponse(
            path=path,
            distance=round(distance, 2),
            eta_seconds=calculate_eta(distance),
            waypoints=waypoints
        )
    
    def get_evacuation_route(self, from_node: str, exit_nodes: List[str]) -> RouteResponse:
        """
        Find safest evacuation route
        """
        if from_node not in self.graph.nodes:
            raise HTTPException(status_code=404, detail=f"Node {from_node} not found")
        
        path, distance, exit_node = find_evacuation_route(
            self.graph,
            from_node,
            self.hazard_map,
            exit_nodes
        )
        
        if not path:
            raise HTTPException(status_code=404, detail="No evacuation route available")
        
        waypoints = self._build_waypoints(path)
        
        return RouteResponse(
            path=path,
            distance=round(distance, 2),
            eta_seconds=calculate_eta(distance),
            waypoints=waypoints
        )
    
    def _build_waypoints(self, path: List[str]) -> List[Dict]:
        """Build waypoint list with coordinates"""
        waypoints = []
        for node_id in path:
            node = self.graph.nodes[node_id]
            waypoints.append({
                "node_id": node_id,
                "x": node.x,
                "y": node.y,
                "level": node.level,
                "type": node.type
            })
        return waypoints


class EmergencyAPIHandler:
    """Handles emergency response API requests"""
    
    def __init__(self, graph: Graph, hazard_map: HazardMap, staff_tracker: StaffTracker):
        self.graph = graph
        self.hazard_map = hazard_map
        self.staff_tracker = staff_tracker
    
    def assign_nearest_responder(self, request: EmergencyRequest) -> ResponderResponse:
        """
        Find and assign nearest available responder
        """
        # Validate location
        if request.location not in self.graph.nodes:
            raise HTTPException(status_code=404, detail=f"Location {request.location} not found")
        
        # Parse role
        try:
            role = StaffRole(request.required_role.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {request.required_role}")
        
        # Create incident
        incident = EmergencyIncident(
            id=f"INC-{hash(request.location) % 10000:04d}",
            location=request.location,
            type=request.incident_type,
            priority=request.priority,
            required_role=role,
            timestamp=""  # Would be set in production
        )
        
        # Find responder
        assignment = assign_responder_to_incident(
            self.graph,
            incident,
            self.staff_tracker,
            self.hazard_map
        )
        
        if not assignment:
            raise HTTPException(
                status_code=404,
                detail=f"No available {request.required_role} staff found"
            )
        
        # Build waypoints
        waypoints = []
        for node_id in assignment.path:
            node = self.graph.nodes[node_id]
            waypoints.append({
                "node_id": node_id,
                "x": node.x,
                "y": node.y
            })
        
        return ResponderResponse(
            staff_id=assignment.staff_id,
            role=assignment.staff_role.value,
            current_position=assignment.current_position,
            incident_location=assignment.incident_location,
            path=assignment.path,
            distance=round(assignment.distance, 2),
            eta_seconds=assignment.eta_seconds,
            priority=assignment.priority,
            waypoints=waypoints
        )
    
    def assign_multiple_responders(
        self,
        request: EmergencyRequest,
        num_responders: int = 3
    ) -> List[ResponderResponse]:
        """
        Assign multiple responders for large emergency
        """
        if request.location not in self.graph.nodes:
            raise HTTPException(status_code=404, detail=f"Location {request.location} not found")
        
        try:
            role = StaffRole(request.required_role.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {request.required_role}")
        
        incident = EmergencyIncident(
            id=f"INC-{hash(request.location) % 10000:04d}",
            location=request.location,
            type=request.incident_type,
            priority=request.priority,
            required_role=role,
            timestamp=""
        )
        
        assignments = find_multiple_responders(
            self.graph,
            incident,
            self.staff_tracker,
            self.hazard_map,
            num_responders
        )
        
        if not assignments:
            raise HTTPException(status_code=404, detail="No available responders")
        
        responses = []
        for assignment in assignments:
            waypoints = []
            for node_id in assignment.path:
                node = self.graph.nodes[node_id]
                waypoints.append({"node_id": node_id, "x": node.x, "y": node.y})
            
            responses.append(ResponderResponse(
                staff_id=assignment.staff_id,
                role=assignment.staff_role.value,
                current_position=assignment.current_position,
                incident_location=assignment.incident_location,
                path=assignment.path,
                distance=round(assignment.distance, 2),
                eta_seconds=assignment.eta_seconds,
                priority=assignment.priority,
                waypoints=waypoints
            ))
        
        return responses


class HazardAPIHandler:
    """Handles hazard management API requests"""
    
    def __init__(self, hazard_map: HazardMap):
        self.hazard_map = hazard_map
    
    def add_closure(self, from_node: str, to_node: str):
        """Add corridor closure"""
        self.hazard_map.add_closure(from_node, to_node)
        return {
            "message": "Closure added",
            "from": from_node,
            "to": to_node,
            "bidirectional": True
        }
    
    def remove_closure(self, from_node: str, to_node: str):
        """Remove corridor closure"""
        self.hazard_map.remove_closure(from_node, to_node)
        return {
            "message": "Closure removed",
            "from": from_node,
            "to": to_node
        }
    
    def update_hazard(self, update: HazardUpdate):
        """Update hazard penalty for a node"""
        # Parse hazard type
        hazard_type_map = {
            "smoke": HazardType.SMOKE,
            "crowd": HazardType.CROWD,
            "fire": HazardType.FIRE,
            "spill": HazardType.SPILL,
            "structural": HazardType.STRUCTURAL
        }
        
        hazard_type = hazard_type_map.get(update.hazard_type.lower())
        
        if not hazard_type:
            raise HTTPException(status_code=400, detail=f"Invalid hazard type: {update.hazard_type}")
        
        # Clamp severity to [0, 1]
        severity = max(0.0, min(1.0, update.severity))
        
        self.hazard_map.set_node_hazard(update.node_id, hazard_type, severity)
        
        return {
            "message": "Hazard updated",
            "node_id": update.node_id,
            "hazard_type": update.hazard_type,
            "severity": severity,
            "penalty": hazard_type.value * severity
        }
    
    def update_crowd_penalty(self, node_id: str, occupancy_rate: float):
        """
        Update crowd penalty based on occupancy rate
        Automatically calculates severity from occupancy (0-100%)
        """
        self.hazard_map.set_crowd_penalty(node_id, occupancy_rate)
        
        penalty = self.hazard_map.get_node_penalty(node_id)
        
        return {
            "message": "Crowd penalty updated",
            "node_id": node_id,
            "occupancy_rate": occupancy_rate,
            "calculated_penalty": round(penalty, 2)
        }
    
    def clear_hazards(self, node_id: str):
        """Clear all hazards from a node"""
        self.hazard_map.clear_node_hazards(node_id)
        return {
            "message": "Hazards cleared",
            "node_id": node_id
        }
    
    def get_hazard_status(self) -> Dict:
        """Get summary of current hazards"""
        return {
            "closures": len(self.hazard_map.closures) // 2,  # Bidirectional
            "node_hazards": len(self.hazard_map.node_hazards),
            "edge_hazards": len(self.hazard_map.edge_hazards) // 2
        }