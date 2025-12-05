"""
DATABASE MODELS for Emergency Service
SQLAlchemy models for incidents, evacuations, and sensor alerts
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from enum import Enum

Base = declarative_base()


# ========== ENUMS ==========

class IncidentType(str, Enum):
    """Types of emergency incidents"""
    FIRE = "fire"
    SMOKE = "smoke"
    GAS_LEAK = "gas_leak"
    STRUCTURAL = "structural"
    ELECTRICAL = "electrical"
    CHEMICAL = "chemical"
    BOMB_THREAT = "bomb_threat"
    OTHER = "other"


class IncidentStatus(str, Enum):
    """Incident lifecycle status"""
    ACTIVE = "active"
    INVESTIGATING = "investigating"
    RESPONDING = "responding"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    FALSE_ALARM = "false_alarm"


class IncidentSeverity(str, Enum):
    """Incident severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SensorType(str, Enum):
    """Types of emergency sensors"""
    SMOKE = "smoke"
    FIRE = "fire"
    HEAT = "heat"
    GAS = "gas"
    CO2 = "co2"
    MOTION = "motion"


class EvacuationType(str, Enum):
    """Types of evacuation"""
    PARTIAL = "partial"
    FULL = "full"
    STAGED = "staged"


# ========== MODELS ==========

class EmergencyIncident(Base):
    """Main incident table"""
    __tablename__ = "emergency_incidents"
    
    # Primary fields
    id = Column(String, primary_key=True)
    incident_type = Column(SQLEnum(IncidentType), nullable=False, index=True)
    status = Column(SQLEnum(IncidentStatus), default=IncidentStatus.ACTIVE, nullable=False, index=True)
    severity = Column(SQLEnum(IncidentSeverity), default=IncidentSeverity.MEDIUM, nullable=False, index=True)
    
    # Location
    location_node = Column(String, nullable=False, index=True)
    location_description = Column(String, nullable=True)
    affected_area = Column(String, nullable=True)  # e.g., "Sector A", "Level 2"
    
    # Description
    description = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    
    # Source
    detected_by = Column(String, nullable=True)  # "sensor", "staff", "visitor", "system"
    sensor_id = Column(String, nullable=True, index=True)
    reported_by = Column(String, nullable=True)  # Staff ID who reported
    
    # Response
    responders_dispatched = Column(Integer, default=0)
    external_services_alerted = Column(JSON, default=list)  # ["fire_brigade", "police"]
    evacuation_triggered = Column(Boolean, default=False)
    
    # Metadata
    incident_metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)
    detected_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    contained_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Escalation tracking
    escalation_count = Column(Integer, default=0)
    last_escalated_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Incident {self.id}: {self.incident_type.value} @ {self.location_node} [{self.severity.value}]>"


class SensorAlert(Base):
    """Sensor alerts that trigger incidents"""
    __tablename__ = "sensor_alerts"
    
    id = Column(String, primary_key=True)
    incident_id = Column(String, nullable=True, index=True)  # Link to incident if created
    
    sensor_id = Column(String, nullable=False, index=True)
    sensor_type = Column(SQLEnum(SensorType), nullable=False)
    location_node = Column(String, nullable=False, index=True)
    
    # Readings
    reading_value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    unit = Column(String, default="ppm")  # ppm, degrees, percentage
    
    # Status
    status = Column(String, default="active", index=True)  # active, acknowledged, resolved
    severity = Column(SQLEnum(IncidentSeverity), nullable=False)
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.now, nullable=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    incident_metadata = Column(JSON, default=dict)
    
    def __repr__(self):
        return f"<SensorAlert {self.sensor_id}: {self.sensor_type.value} = {self.reading_value}>"


class ResponderDispatch(Base):
    """Responder assignments to incidents"""
    __tablename__ = "responder_dispatches"
    
    id = Column(String, primary_key=True)
    incident_id = Column(String, nullable=False, index=True)
    
    responder_id = Column(String, nullable=False, index=True)
    responder_role = Column(String, nullable=False)  # security, supervisor, maintenance
    
    # Route
    route_nodes = Column(JSON, default=list)
    route_distance = Column(Float, nullable=True)
    eta_seconds = Column(Integer, nullable=True)
    
    # Status
    status = Column(String, default="dispatched", nullable=False)  # dispatched, en_route, arrived, completed
    
    # Timestamps
    dispatched_at = Column(DateTime, default=datetime.now, nullable=False)
    en_route_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Performance
    actual_response_time_sec = Column(Integer, nullable=True)
    
    incident_metadata = Column(JSON, default=dict)
    
    def __repr__(self):
        return f"<Dispatch {self.responder_id} → {self.incident_id}>"


class EvacuationZone(Base):
    """Evacuation orders and affected zones"""
    __tablename__ = "evacuation_zones"
    
    id = Column(String, primary_key=True)
    incident_id = Column(String, nullable=True, index=True)
    
    evacuation_type = Column(SQLEnum(EvacuationType), nullable=False)
    
    # Affected areas
    affected_zones = Column(JSON, default=list)  # ["Sector A", "Sector B"]
    affected_nodes = Column(JSON, default=list)  # List of node IDs
    
    # Routes
    exit_routes = Column(JSON, default=dict)  # {zone: [route_data]}
    blocked_corridors = Column(JSON, default=list)  # List of blocked edges
    
    # Status
    status = Column(String, default="active", nullable=False, index=True)  # active, in_progress, completed
    
    # Timing
    initiated_at = Column(DateTime, default=datetime.now, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Statistics
    estimated_people = Column(Integer, nullable=True)
    evacuated_count = Column(Integer, default=0)
    
    # Reason
    reason = Column(String, nullable=True)
    
    incident_metadata = Column(JSON, default=dict)
    
    def __repr__(self):
        return f"<Evacuation {self.id}: {self.evacuation_type.value} [{self.status}]>"


class CorridorClosure(Base):
    """Corridor closures during emergencies"""
    __tablename__ = "corridor_closures"
    
    id = Column(String, primary_key=True)
    incident_id = Column(String, nullable=True, index=True)
    evacuation_id = Column(String, nullable=True, index=True)
    
    from_node = Column(String, nullable=False, index=True)
    to_node = Column(String, nullable=False, index=True)
    
    reason = Column(String, nullable=False)  # fire, smoke, structural, congestion
    severity = Column(String, default="high")
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    closed_at = Column(DateTime, default=datetime.now, nullable=False)
    reopened_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<Closure {self.from_node}→{self.to_node}: {self.reason}>"


class IncidentLog(Base):
    """Timeline log of incident events"""
    __tablename__ = "incident_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String, nullable=False, index=True)
    
    event_type = Column(String, nullable=False)  # created, escalated, dispatched, resolved
    description = Column(String, nullable=True)
    
    actor = Column(String, nullable=True)  # Who performed the action
    incident_metadata = Column(JSON, default=dict)
    
    timestamp = Column(DateTime, default=datetime.now, nullable=False, index=True)
    
    def __repr__(self):
        return f"<IncidentLog {self.incident_id}: {self.event_type}>"


class ExternalAlert(Base):
    """Log of external service alerts (fire brigade, police)"""
    __tablename__ = "external_alerts"
    
    id = Column(String, primary_key=True)
    incident_id = Column(String, nullable=False, index=True)
    
    service_name = Column(String, nullable=False)  # fire_brigade, police, ambulance
    contact_number = Column(String, nullable=True)
    
    alert_method = Column(String, default="phone")  # phone, api, radio
    status = Column(String, default="sent")  # sent, confirmed, arrived
    
    alerted_at = Column(DateTime, default=datetime.now, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    
    response_time_min = Column(Integer, nullable=True)
    
    incident_metadata = Column(JSON, default=dict)
    
    def __repr__(self):
        return f"<ExternalAlert {self.service_name} for {self.incident_id}>"