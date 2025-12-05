"""
PYDANTIC SCHEMAS for Emergency Service
Request/Response models for API endpoints
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ========== INCIDENT SCHEMAS ==========

class IncidentCreate(BaseModel):
    """Create new incident"""
    incident_type: str = Field(..., description="Type: fire, smoke, gas_leak, structural, electrical")
    location_node: str = Field(..., description="Node ID of incident location")
    severity: str = Field(default="medium", description="Severity: low, medium, high, critical")
    description: Optional[str] = Field(None, description="Incident description")
    location_description: Optional[str] = Field(None, description="Human-readable location")
    affected_area: Optional[str] = Field(None, description="Affected zone/sector")
    detected_by: str = Field(default="system", description="Detection source: sensor, staff, visitor, system")
    sensor_id: Optional[str] = Field(None, description="Sensor ID if detected by sensor")
    reported_by: Optional[str] = Field(None, description="Staff ID who reported")
    incident_metadata: Dict[str, Any] = Field(default_factory=dict)


class IncidentUpdate(BaseModel):
    """Update existing incident"""
    status: Optional[str] = Field(None, description="Status: active, investigating, responding, contained, resolved")
    severity: Optional[str] = Field(None, description="Update severity")
    notes: Optional[str] = Field(None, description="Add notes")
    responders_dispatched: Optional[int] = Field(None)
    incident_metadata: Optional[Dict[str, Any]] = None


class IncidentResponse(BaseModel):
    """Incident response model"""
    id: str
    incident_type: str
    status: str
    severity: str
    location_node: str
    location_description: Optional[str]
    affected_area: Optional[str]
    description: Optional[str]
    notes: Optional[str]
    detected_by: str
    sensor_id: Optional[str]
    reported_by: Optional[str]
    responders_dispatched: int
    external_services_alerted: List[str]
    evacuation_triggered: bool
    incident_metadata: Dict[str, Any]
    created_at: str
    detected_at: Optional[str]
    responded_at: Optional[str]
    contained_at: Optional[str]
    resolved_at: Optional[str]
    escalation_count: int
    last_escalated_at: Optional[str]
    
    class Config:
        from_attributes = True


class ActiveIncidentsResponse(BaseModel):
    """List of active incidents"""
    total: int
    active_count: int
    incidents: List[IncidentResponse]


# ========== SENSOR ALERT SCHEMAS ==========

class SensorAlertCreate(BaseModel):
    """Create sensor alert"""
    sensor_id: str = Field(..., description="Sensor identifier")
    sensor_type: str = Field(..., description="Type: smoke, fire, heat, gas, co2")
    location_node: str = Field(..., description="Node ID of sensor location")
    reading_value: float = Field(..., description="Sensor reading value")
    threshold: float = Field(..., description="Alert threshold")
    unit: str = Field(default="ppm", description="Unit: ppm, degrees, percentage")
    severity: str = Field(..., description="Severity: low, medium, high, critical")
    incident_metadata: Dict[str, Any] = Field(default_factory=dict)


class SensorAlertResponse(BaseModel):
    """Sensor alert response"""
    id: str
    incident_id: Optional[str]
    sensor_id: str
    sensor_type: str
    location_node: str
    reading_value: float
    threshold: float
    unit: str
    status: str
    severity: str
    detected_at: str
    acknowledged_at: Optional[str]
    resolved_at: Optional[str]
    incident_metadata: Dict[str, Any]
    
    class Config:
        from_attributes = True


# ========== DISPATCH SCHEMAS ==========

class DispatchRequest(BaseModel):
    """Request responder dispatch"""
    incident_id: str = Field(..., description="Incident ID")
    responder_role: str = Field(..., description="Required role: security, supervisor, maintenance")
    num_responders: int = Field(default=1, ge=1, le=10, description="Number of responders to dispatch")


class DispatchResponse(BaseModel):
    """Responder dispatch response"""
    id: str
    incident_id: str
    responder_id: str
    responder_role: str
    route_nodes: List[str]
    route_distance: float
    eta_seconds: int
    status: str
    dispatched_at: str
    en_route_at: Optional[str]
    arrived_at: Optional[str]
    completed_at: Optional[str]
    
    class Config:
        from_attributes = True


# ========== EVACUATION SCHEMAS ==========

class EvacuationRequest(BaseModel):
    """Request evacuation"""
    incident_id: Optional[str] = Field(None, description="Related incident ID")
    affected_zones: List[str] = Field(default_factory=list, description="Zones to evacuate: ['Sector A', 'Level 2']")
    evacuation_type: str = Field(..., description="Type: partial, full, staged")
    reason: str = Field(..., description="Evacuation reason")


class EvacuationResponse(BaseModel):
    """Evacuation response"""
    id: str
    incident_id: Optional[str]
    evacuation_type: str
    affected_zones: List[str]
    affected_nodes: List[str]
    exit_routes: Dict[str, Any]
    blocked_corridors: List[str]
    status: str
    initiated_at: str
    completed_at: Optional[str]
    estimated_people: Optional[int]
    evacuated_count: int
    reason: str
    incident_metadata: Dict[str, Any]
    
    class Config:
        from_attributes = True


class EvacuationRouteResponse(BaseModel):
    """Evacuation route for individual"""
    from_node: str
    to_exit: str
    path: List[str]
    distance: float
    estimated_time_sec: int
    hazards_avoided: List[str]
    alternative_routes: List[Dict[str, Any]]


# ========== CORRIDOR CLOSURE SCHEMAS ==========

class CorridorClosureCreate(BaseModel):
    """Create corridor closure"""
    from_node: str
    to_node: str
    reason: str = Field(..., description="Reason: fire, smoke, structural, congestion")
    incident_id: Optional[str] = None
    evacuation_id: Optional[str] = None
    severity: str = Field(default="high")


class CorridorClosureResponse(BaseModel):
    """Corridor closure response"""
    id: str
    incident_id: Optional[str]
    evacuation_id: Optional[str]
    from_node: str
    to_node: str
    reason: str
    severity: str
    is_active: bool
    closed_at: str
    reopened_at: Optional[str]
    
    class Config:
        from_attributes = True


# ========== STATISTICS SCHEMAS ==========

class IncidentStatistics(BaseModel):
    """Overall incident statistics"""
    total_incidents: int
    active_incidents: int
    by_type: Dict[str, int]
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    avg_response_time_min: Optional[float]
    avg_resolution_time_min: Optional[float]
    false_alarms: int
    external_alerts_sent: int


class IncidentTimeline(BaseModel):
    """Timeline entry"""
    incident_id: str
    incident_type: str
    severity: str
    status: str
    timestamp: str
    location: str


# ========== EXTERNAL ALERT SCHEMAS ==========

class ExternalAlertRequest(BaseModel):
    """Request external service alert"""
    incident_id: str
    services: List[str] = Field(..., description="Services: fire_brigade, police, ambulance")
    alert_method: str = Field(default="phone", description="Method: phone, api, radio")


class ExternalAlertResponse(BaseModel):
    """External alert response"""
    id: str
    incident_id: str
    service_name: str
    contact_number: Optional[str]
    alert_method: str
    status: str
    alerted_at: str
    confirmed_at: Optional[str]
    arrived_at: Optional[str]
    response_time_min: Optional[int]
    
    class Config:
        from_attributes = True


# ========== LOG SCHEMAS ==========

class IncidentLogEntry(BaseModel):
    """Incident log entry"""
    id: int
    incident_id: str
    event_type: str
    description: Optional[str]
    actor: Optional[str]
    incident_metadata: Dict[str, Any]
    timestamp: str
    
    class Config:
        from_attributes = True