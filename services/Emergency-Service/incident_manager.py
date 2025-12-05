"""
INCIDENT MANAGER - Emergency Service
Core business logic for incident creation, escalation, and responder dispatch
Calls Routing Service for route calculations
"""

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import uuid
import httpx

from models import (
    EmergencyIncident, SensorAlert, ResponderDispatch, IncidentLog,
    IncidentType, IncidentStatus, IncidentSeverity, SensorType
)
from schemas import (
    IncidentCreate, IncidentUpdate, IncidentResponse,
    SensorAlertCreate, SensorAlertResponse,
    DispatchResponse
)
from nearest_responder import (
    StaffTracker, IncidentRequest, StaffRole,
    assign_responder_to_incident, find_multiple_responders,
    create_mock_staff_tracker
)


class IncidentManager:
    """Manages emergency incidents lifecycle"""
    
    def __init__(self, routing_service_url: str, map_service_url: str):
        self.routing_service_url = routing_service_url
        self.map_service_url = map_service_url
        
        # Initialize staff tracker
        self.staff_tracker = create_mock_staff_tracker(num_per_role=3)
        print(f"✅ Staff tracker initialized with {len(self.staff_tracker.staff)} staff members")
    
    # ========== INCIDENT CREATION ==========
    
    def create_incident(self, db: Session, incident_data: IncidentCreate) -> IncidentResponse:
        """Create new emergency incident"""
        incident = EmergencyIncident(
            id=f"inc-{uuid.uuid4().hex[:8]}",
            incident_type=IncidentType(incident_data.incident_type),
            location_node=incident_data.location_node,
            severity=IncidentSeverity(incident_data.severity),
            description=incident_data.description,
            location_description=incident_data.location_description,
            affected_area=incident_data.affected_area,
            detected_by=incident_data.detected_by,
            sensor_id=incident_data.sensor_id,
            reported_by=incident_data.reported_by,
            detected_at=datetime.now(),
            incident_metadata=incident_data.incident_metadata
        )
        
        db.add(incident)
        db.commit()
        db.refresh(incident)
        
        # Se for fire critical, criar evacuação E atualizar campo
        if incident_data.incident_type == "fire" and incident_data.severity == "critical":
            # Este método deveria retornar o incidente atualizado
            incident.evacuation_triggered = True
            db.commit()
            db.refresh(incident)
        
        # Log creation
        self._log_event(db, incident.id, "created", f"Incident created: {incident.incident_type.value}")
        
        print(f"🚨 Created incident {incident.id}: {incident.incident_type.value} @ {incident.location_node} [{incident.severity.value}]")
        
        return self._incident_to_response(incident)
    
    def create_incident_from_sensor(self, db: Session, alert: SensorAlertCreate) -> IncidentResponse:
        """Create incident from sensor alert"""
        
        # Map sensor type to incident type
        sensor_to_incident = {
            "smoke": "smoke",
            "fire": "fire",
            "heat": "fire",
            "gas": "gas_leak",
            "co2": "gas_leak"
        }
        
        incident_type = sensor_to_incident.get(alert.sensor_type, "other")
        
        # Create sensor alert record
        sensor_alert = SensorAlert(
            id=f"alert-{uuid.uuid4().hex[:8]}",
            sensor_id=alert.sensor_id,
            sensor_type=SensorType(alert.sensor_type),
            location_node=alert.location_node,
            reading_value=alert.reading_value,
            threshold=alert.threshold,
            unit=alert.unit,
            severity=IncidentSeverity(alert.severity),
            incident_metadata=alert.incident_metadata
        )
        
        db.add(sensor_alert)
        db.commit()
        
        # Create incident
        incident_data = IncidentCreate(
            incident_type=incident_type,
            location_node=alert.location_node,
            severity=alert.severity,
            description=f"{alert.sensor_type.upper()} sensor alert: {alert.reading_value}{alert.unit} (threshold: {alert.threshold}{alert.unit})",
            detected_by="sensor",
            sensor_id=alert.sensor_id,
            incident_metadata={
                "sensor_alert_id": sensor_alert.id,
                "reading": alert.reading_value,
                "threshold": alert.threshold,
                "unit": alert.unit
            }
        )
        
        incident = self.create_incident(db, incident_data)
        
        # Link sensor alert to incident
        sensor_alert.incident_id = incident.id
        db.commit()
        
        return incident
    
    # ========== INCIDENT QUERIES ==========
    
    def get_incident(self, db: Session, incident_id: str) -> Optional[IncidentResponse]:
        """Get incident by ID"""
        incident = db.query(EmergencyIncident).filter(
            EmergencyIncident.id == incident_id
        ).first()
        
        return self._incident_to_response(incident) if incident else None
    
    def get_incidents(self, db: Session, **filters) -> List[IncidentResponse]:
        """Get incidents with filters"""
        query = db.query(EmergencyIncident)
        
        if 'status' in filters:
            query = query.filter(EmergencyIncident.status == IncidentStatus(filters['status']))
        
        if 'severity' in filters:
            query = query.filter(EmergencyIncident.severity == IncidentSeverity(filters['severity']))
        
        if 'incident_type' in filters:
            query = query.filter(EmergencyIncident.incident_type == IncidentType(filters['incident_type']))
        
        query = query.order_by(EmergencyIncident.created_at.desc())
        incidents = query.all()
        
        return [self._incident_to_response(i) for i in incidents]
    
    def get_active_incidents(self, db: Session) -> List[EmergencyIncident]:
        """Get all active incidents (returns DB models, not responses)"""
        return db.query(EmergencyIncident).filter(
            EmergencyIncident.status.in_([
                IncidentStatus.ACTIVE,
                IncidentStatus.INVESTIGATING,
                IncidentStatus.RESPONDING
            ])
        ).all()
    
    # ========== INCIDENT UPDATES ==========
    
    def update_incident(
        self,
        db: Session,
        incident_id: str,
        update: IncidentUpdate
    ) -> Optional[IncidentResponse]:
        """Update incident"""
        incident = db.query(EmergencyIncident).filter(
            EmergencyIncident.id == incident_id
        ).first()
        
        if not incident:
            return None
        
        old_status = incident.status.value
        old_severity = incident.severity.value
        
        # Update fields
        if update.status:
            new_status = IncidentStatus(update.status)
            incident.status = new_status
            
            if new_status == IncidentStatus.RESPONDING and not incident.responded_at:
                incident.responded_at = datetime.now()
            elif new_status == IncidentStatus.CONTAINED and not incident.contained_at:
                incident.contained_at = datetime.now()
            elif new_status == IncidentStatus.RESOLVED and not incident.resolved_at:
                incident.resolved_at = datetime.now()
        
        if update.severity:
            incident.severity = IncidentSeverity(update.severity)
        
        if update.notes:
            incident.notes = update.notes
        
        if update.responders_dispatched is not None:
            incident.responders_dispatched = update.responders_dispatched
        
        if update.incident_metadata:
            incident.incident_metadata.update(update.incident_metadata)
        
        db.commit()
        db.refresh(incident)
        
        # Log changes
        if old_status != incident.status.value:
            self._log_event(db, incident_id, "status_change", f"{old_status} → {incident.status.value}")
        
        if old_severity != incident.severity.value:
            self._log_event(db, incident_id, "severity_change", f"{old_severity} → {incident.severity.value}")
        
        return self._incident_to_response(incident)
    
    def escalate_incident(self, db: Session, incident_id: str) -> Optional[IncidentResponse]:
        """Escalate incident severity"""
        incident = db.query(EmergencyIncident).filter(
            EmergencyIncident.id == incident_id
        ).first()
        
        if not incident:
            return None
        
        # Escalate severity
        current_severity = incident.severity
        
        if current_severity == IncidentSeverity.LOW:
            new_severity = IncidentSeverity.MEDIUM
        elif current_severity == IncidentSeverity.MEDIUM:
            new_severity = IncidentSeverity.HIGH
        elif current_severity == IncidentSeverity.HIGH:
            new_severity = IncidentSeverity.CRITICAL
        else:
            return self._incident_to_response(incident)
        
        incident.severity = new_severity
        incident.escalation_count += 1
        incident.last_escalated_at = datetime.now()
        
        db.commit()
        db.refresh(incident)
        
        self._log_event(
            db, incident_id, "escalated",
            f"Escalated from {current_severity.value} to {new_severity.value}"
        )
        
        print(f"⬆️  Incident {incident_id} escalated to {new_severity.value}")
        
        return self._incident_to_response(incident)
    
    def should_escalate(self, incident: EmergencyIncident) -> bool:
        """Check if incident should be escalated"""
        if incident.severity == IncidentSeverity.CRITICAL:
            return False
        
        if incident.status in [IncidentStatus.RESOLVED, IncidentStatus.FALSE_ALARM]:
            return False
        
        # Escalate if active for >10 minutes without response
        if not incident.responded_at:
            duration = (datetime.now() - incident.created_at).total_seconds() / 60
            if duration > 10:
                return True
        
        # Escalate if still active after 30 minutes
        duration = (datetime.now() - incident.created_at).total_seconds() / 60
        if duration > 30 and incident.status == IncidentStatus.ACTIVE:
            return True
        
        return False
    
    # ========== RESPONDER DISPATCH ==========
    
    async def dispatch_responders(
        self,
        db: Session,
        incident_id: str,
        responder_role: str,
        num_responders: int
    ) -> List[DispatchResponse]:
        """Dispatch multiple responders to incident by calling Routing Service"""
        
        # Get incident from DB
        incident_db = db.query(EmergencyIncident).filter(
            EmergencyIncident.id == incident_id
        ).first()
        
        if not incident_db:
            print(f"❌ Incident {incident_id} not found")
            return []
        
        # Convert to IncidentRequest for nearest_responder
        incident_request = IncidentRequest(
            id=incident_db.id,
            location=incident_db.location_node,
            type=incident_db.incident_type.value,
            priority=incident_db.severity.value,
            required_role=StaffRole(responder_role.lower()),
            timestamp=incident_db.created_at.isoformat()
        )
        
        # Call nearest_responder (which calls Routing Service)
        assignments = await find_multiple_responders(
            incident_request,
            self.staff_tracker,
            self.routing_service_url,
            num_responders
        )
        
        if not assignments:
            print(f"❌ No available {responder_role} responders found")
            return []
        
        # Create dispatches in DB
        dispatches = []
        
        for assignment in assignments:
            dispatch = ResponderDispatch(
                id=f"dispatch-{uuid.uuid4().hex[:8]}",
                incident_id=incident_id,
                responder_id=assignment.staff_id,
                responder_role=responder_role,
                route_nodes=assignment.path,
                route_distance=assignment.distance,
                eta_seconds=assignment.eta_seconds
            )
            
            db.add(dispatch)
            dispatches.append(dispatch)
        
        # Update incident
        incident_db.responders_dispatched += len(dispatches)
        if incident_db.status == IncidentStatus.ACTIVE:
            incident_db.status = IncidentStatus.RESPONDING
            incident_db.responded_at = datetime.now()
        
        db.commit()
        
        # Log dispatch
        self._log_event(
            db, incident_id, "dispatched",
            f"Dispatched {len(dispatches)} {responder_role} responders"
        )
        
        print(f"✅ Dispatched {len(dispatches)} {responder_role} to incident {incident_id}")
        
        return [self._dispatch_to_response(d) for d in dispatches]
    
    async def auto_dispatch_responders(self, db: Session, incident_id: str) -> Optional[List[DispatchResponse]]:
        """Automatically dispatch responders based on incident severity"""
        
        incident = db.query(EmergencyIncident).filter_by(id=incident_id).first()
        
        if not incident:
            return None
        
        # Determine number of responders based on severity
        num_responders = {
            IncidentSeverity.LOW: 1,
            IncidentSeverity.MEDIUM: 2,
            IncidentSeverity.HIGH: 3,
            IncidentSeverity.CRITICAL: 5
        }.get(incident.severity, 2)
        
        # Dispatch security (primary responders)
        return await self.dispatch_responders(db, incident_id, "security", num_responders)
    
    def get_active_dispatches(self, db: Session) -> List[DispatchResponse]:
        """Get all active responder dispatches"""
        dispatches = db.query(ResponderDispatch).filter(
            ResponderDispatch.status.in_(["dispatched", "en_route"])
        ).all()
        
        return [self._dispatch_to_response(d) for d in dispatches]
    
    def mark_responder_arrived(self, db: Session, dispatch_id: str) -> Optional[DispatchResponse]:
        """Mark responder as arrived at incident"""
        dispatch = db.query(ResponderDispatch).filter(
            ResponderDispatch.id == dispatch_id
        ).first()
        
        if not dispatch:
            return None
        
        dispatch.status = "arrived"
        dispatch.arrived_at = datetime.now()
        
        if dispatch.dispatched_at:
            response_time = (dispatch.arrived_at - dispatch.dispatched_at).total_seconds()
            dispatch.actual_response_time_sec = int(response_time)
        
        db.commit()
        db.refresh(dispatch)
        
        self._log_event(
            db, dispatch.incident_id, "responder_arrived",
            f"Responder {dispatch.responder_id} arrived"
        )
        
        return self._dispatch_to_response(dispatch)
    
    # ========== SENSOR ALERTS ==========
    
    def get_sensor_alerts(
        self,
        db: Session,
        sensor_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[SensorAlertResponse]:
        """Get sensor alerts"""
        query = db.query(SensorAlert)
        
        if sensor_type:
            query = query.filter(SensorAlert.sensor_type == SensorType(sensor_type))
        
        if status:
            query = query.filter(SensorAlert.status == status)
        
        query = query.order_by(SensorAlert.detected_at.desc()).limit(limit)
        alerts = query.all()
        
        return [self._sensor_alert_to_response(a) for a in alerts]
    
    # ========== STATISTICS ==========
    
    def get_statistics(self, db: Session) -> Dict[str, Any]:
        """Get incident statistics"""
        all_incidents = db.query(EmergencyIncident).all()
        
        stats = {
            "total_incidents": len(all_incidents),
            "active_incidents": 0,
            "by_type": {},
            "by_severity": {},
            "by_status": {},
            "false_alarms": 0,
            "external_alerts_sent": 0,
            "avg_response_time_min": None,
            "avg_resolution_time_min": None
        }
        
        response_times = []
        resolution_times = []
        
        for incident in all_incidents:
            if incident.status in [IncidentStatus.ACTIVE, IncidentStatus.INVESTIGATING, IncidentStatus.RESPONDING]:
                stats["active_incidents"] += 1
            
            itype = incident.incident_type.value
            stats["by_type"][itype] = stats["by_type"].get(itype, 0) + 1
            
            severity = incident.severity.value
            stats["by_severity"][severity] = stats["by_severity"].get(severity, 0) + 1
            
            status = incident.status.value
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            if incident.status == IncidentStatus.FALSE_ALARM:
                stats["false_alarms"] += 1
            
            stats["external_alerts_sent"] += len(incident.external_services_alerted)
            
            if incident.responded_at and incident.created_at:
                rt = (incident.responded_at - incident.created_at).total_seconds() / 60
                response_times.append(rt)
            
            if incident.resolved_at and incident.created_at:
                rt = (incident.resolved_at - incident.created_at).total_seconds() / 60
                resolution_times.append(rt)
        
        if response_times:
            stats["avg_response_time_min"] = round(sum(response_times) / len(response_times), 2)
        
        if resolution_times:
            stats["avg_resolution_time_min"] = round(sum(resolution_times) / len(resolution_times), 2)
        
        return stats
    
    def get_incident_timeline(self, db: Session, hours: int = 24) -> List[Dict]:
        """Get incident timeline for last N hours"""
        threshold = datetime.now() - timedelta(hours=hours)
        
        incidents = db.query(EmergencyIncident).filter(
            EmergencyIncident.created_at >= threshold
        ).order_by(EmergencyIncident.created_at.desc()).all()
        
        return [
            {
                "incident_id": i.id,
                "incident_type": i.incident_type.value,
                "severity": i.severity.value,
                "status": i.status.value,
                "timestamp": i.created_at.isoformat(),
                "location": i.location_node
            }
            for i in incidents
        ]
    
    # ========== HELPERS ==========
    
    def _incident_to_response(self, incident: EmergencyIncident) -> IncidentResponse:
        """Convert model to response"""
        return IncidentResponse(
            id=incident.id,
            incident_type=incident.incident_type.value,
            status=incident.status.value,
            severity=incident.severity.value,
            location_node=incident.location_node,
            location_description=incident.location_description,
            affected_area=incident.affected_area,
            description=incident.description,
            notes=incident.notes,
            detected_by=incident.detected_by,
            sensor_id=incident.sensor_id,
            reported_by=incident.reported_by,
            responders_dispatched=incident.responders_dispatched,
            external_services_alerted=incident.external_services_alerted,
            evacuation_triggered=incident.evacuation_triggered,
            incident_metadata=incident.incident_metadata,
            created_at=incident.created_at.isoformat(),
            detected_at=incident.detected_at.isoformat() if incident.detected_at else None,
            responded_at=incident.responded_at.isoformat() if incident.responded_at else None,
            contained_at=incident.contained_at.isoformat() if incident.contained_at else None,
            resolved_at=incident.resolved_at.isoformat() if incident.resolved_at else None,
            escalation_count=incident.escalation_count,
            last_escalated_at=incident.last_escalated_at.isoformat() if incident.last_escalated_at else None
        )
    
    def _dispatch_to_response(self, dispatch: ResponderDispatch) -> DispatchResponse:
        """Convert dispatch to response"""
        return DispatchResponse(
            id=dispatch.id,
            incident_id=dispatch.incident_id,
            responder_id=dispatch.responder_id,
            responder_role=dispatch.responder_role,
            route_nodes=dispatch.route_nodes,
            route_distance=dispatch.route_distance or 0,
            eta_seconds=dispatch.eta_seconds or 0,
            status=dispatch.status,
            dispatched_at=dispatch.dispatched_at.isoformat(),
            en_route_at=dispatch.en_route_at.isoformat() if dispatch.en_route_at else None,
            arrived_at=dispatch.arrived_at.isoformat() if dispatch.arrived_at else None,
            completed_at=dispatch.completed_at.isoformat() if dispatch.completed_at else None
        )
    
    def _sensor_alert_to_response(self, alert: SensorAlert) -> SensorAlertResponse:
        """Convert sensor alert to response"""
        return SensorAlertResponse(
            id=alert.id,
            incident_id=alert.incident_id,
            sensor_id=alert.sensor_id,
            sensor_type=alert.sensor_type.value,
            location_node=alert.location_node,
            reading_value=alert.reading_value,
            threshold=alert.threshold,
            unit=alert.unit,
            status=alert.status,
            severity=alert.severity.value,
            detected_at=alert.detected_at.isoformat(),
            acknowledged_at=alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            resolved_at=alert.resolved_at.isoformat() if alert.resolved_at else None,
            incident_metadata=alert.incident_metadata
        )
    
    def _log_event(self, db: Session, incident_id: str, event_type: str, description: str):
        """Log incident event"""
        log = IncidentLog(
            incident_id=incident_id,
            event_type=event_type,
            description=description
        )
        
        db.add(log)
        db.commit()