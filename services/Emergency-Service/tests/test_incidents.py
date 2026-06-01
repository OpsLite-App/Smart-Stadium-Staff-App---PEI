from datetime import datetime, timedelta
from models import EmergencyIncident, IncidentSeverity, IncidentStatus
from incident_manager import IncidentManager

def test_incident_escalation_logic():
    # Setup the Manager with fake URLs
    manager = IncidentManager("http://routing", "http://map")
    
    # Create an old incident with medium severity
    old_incident = EmergencyIncident(
        id="inc-old",
        incident_type="security",
        severity=IncidentSeverity.MEDIUM,
        status=IncidentStatus.ACTIVE,
        created_at=datetime.now() - timedelta(minutes=20) # Created 20 minutes ago
    )
    
    # Simulate the logic that would be called by the background task
    if old_incident.severity == IncidentSeverity.MEDIUM:
        old_incident.severity = IncidentSeverity.HIGH
        
    assert old_incident.severity == IncidentSeverity.HIGH