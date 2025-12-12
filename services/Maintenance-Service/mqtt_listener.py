"""
MQTT LISTENER for Maintenance Service
Listens to stadium events and creates maintenance tasks automatically
"""

import json
from typing import Optional
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    print("⚠️  paho-mqtt not installed. Install with: pip install paho-mqtt")


MQTT_BROKER = "localhost"
MQTT_PORT = 1883
# Subscribe to maintenance-specific topics
MQTT_TOPICS = [
    "stadium/maintenance/bin-alerts",
    "stadium/maintenance/staff-assignments"
]


def on_connect(client, userdata, flags, rc, properties=None):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print(f"✅ Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        for topic in MQTT_TOPICS:
            client.subscribe(topic)
            print(f"✅ Subscribed to topic: {topic}")
    else:
        print(f"❌ Failed to connect to MQTT broker (code: {rc})")


def on_message(client, userdata, msg):
    """
    Callback when message received
    
    userdata contains the TaskManager instance
    """
    try:
        payload = msg.payload.decode('utf-8')
        event = json.loads(payload)
        
        task_manager = userdata.get('task_manager')
        
        if not task_manager:
            return
        
        # Get database session
        from database import SessionLocal
        db = SessionLocal()
        
        try:
            process_event(event, task_manager, db)
        finally:
            db.close()
    
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON in MQTT message")
    except Exception as e:
        print(f"❌ Error processing MQTT message: {e}")


def process_event(event: dict, task_manager, db):
    """Process different types of stadium events"""
    event_type = event.get('event_type')
    
    if event_type == 'bin_full':
        handle_bin_full(event, task_manager, db)
    
    elif event_type == 'spill_detected':
        handle_spill(event, task_manager, db)
    
    elif event_type == 'restroom_check_needed':
        handle_restroom_check(event, task_manager, db)
    
    elif event_type == 'equipment_malfunction':
        handle_equipment_issue(event, task_manager, db)


def handle_bin_full(event: dict, task_manager, db):
    """Handle bin-full event"""
    from schemas import BinAlertCreate
    
    bin_id = event.get('bin_id')
    location_node = event.get('location_node', event.get('poi_node'))
    fill_percentage = event.get('fill_pct', event.get('fill_percentage', 0))
    
    if not bin_id or not location_node:
        return
    
    # Determine priority
    if fill_percentage >= 95:
        priority = "critical"
    elif fill_percentage >= 85:
        priority = "high"
    else:
        priority = "medium"
    
    alert = BinAlertCreate(
        bin_id=bin_id,
        location_node=location_node,
        fill_percentage=fill_percentage,
        priority=priority
    )
    
    task = task_manager.create_bin_task(db, alert)
    
    print(f"📦 Created bin task: {task.id} for {bin_id} ({fill_percentage}%)")


def handle_spill(event: dict, task_manager, db):
    """Handle spill detection event"""
    from schemas import TaskCreate
    
    location_node = event.get('location_node', event.get('node_id'))
    spill_type = event.get('spill_type', 'unknown')
    severity = event.get('severity', 'medium')
    
    if not location_node:
        return
    
    task_data = TaskCreate(
        task_type="spill_cleanup",
        location_node=location_node,
        priority=severity if severity in ['low', 'medium', 'high', 'critical'] else 'medium',
        description=f"{spill_type.capitalize()} spill detected",
        location_description=event.get('description', f"Spill at {location_node}"),
        estimated_duration_min=10,
        metadata={
            'spill_type': spill_type,
            'severity': severity,
            'detected_at': event.get('ts', datetime.now().isoformat())
        }
    )
    
    task = task_manager.create_task(db, task_data)
    
    print(f"🧹 Created spill cleanup task: {task.id} at {location_node}")


def handle_restroom_check(event: dict, task_manager, db):
    """Handle restroom check request"""
    from schemas import TaskCreate
    
    location_node = event.get('location_node')
    restroom_id = event.get('restroom_id', 'unknown')
    reason = event.get('reason', 'scheduled_check')
    
    if not location_node:
        return
    
    # Priority based on reason
    priority_map = {
        'scheduled_check': 'low',
        'complaint': 'medium',
        'urgent': 'high',
        'emergency': 'critical'
    }
    
    priority = priority_map.get(reason, 'low')
    
    task_data = TaskCreate(
        task_type="restroom_check",
        location_node=location_node,
        priority=priority,
        description=f"Restroom check needed: {restroom_id}",
        location_description=f"Restroom {restroom_id}",
        estimated_duration_min=5,
        metadata={
            'restroom_id': restroom_id,
            'reason': reason
        }
    )
    
    task = task_manager.create_task(db, task_data)
    
    print(f"🚽 Created restroom check task: {task.id} for {restroom_id}")


def handle_equipment_issue(event: dict, task_manager, db):
    """Handle equipment malfunction"""
    from schemas import TaskCreate
    
    location_node = event.get('location_node')
    equipment_type = event.get('equipment_type', 'unknown')
    issue = event.get('issue', 'malfunction')
    
    if not location_node:
        return
    
    task_data = TaskCreate(
        task_type="equipment_repair",
        location_node=location_node,
        priority="high",
        description=f"Equipment issue: {equipment_type} - {issue}",
        estimated_duration_min=20,
        metadata={
            'equipment_type': equipment_type,
            'issue': issue
        }
    )
    
    task = task_manager.create_task(db, task_data)
    
    print(f"🔧 Created equipment repair task: {task.id}")


def start_mqtt_listener(task_manager):
    """Start MQTT listener in background thread"""
    if not MQTT_AVAILABLE:
        print("⚠️  MQTT not available - listener not started")
        return
    
    def mqtt_thread():
        """Background thread for MQTT"""
        client = mqtt.Client(
            client_id="maintenance-service",
            protocol=mqtt.MQTTv5,
            userdata={'task_manager': task_manager}
        )
        
        client.on_connect = on_connect
        client.on_message = on_message
        
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            client.loop_forever()
        except Exception as e:
            print(f"❌ MQTT listener error: {e}")
    
    import threading
    thread = threading.Thread(target=mqtt_thread, daemon=True)
    thread.start()
    
    print("✅ MQTT listener thread started")


# ========== MANUAL TESTING ==========

if __name__ == "__main__":
    """Test MQTT listener"""
    
    print("\n🧪 Testing MQTT Listener")
    print("="*60)
    
    # Create mock task manager
    class MockTaskManager:
        def create_bin_task(self, db, alert):
            print(f"   [MOCK] Would create bin task: {alert.bin_id}")
            return type('obj', (object,), {'id': 'mock-task-123'})
        
        def create_task(self, db, task_data):
            print(f"   [MOCK] Would create task: {task_data.task_type}")
            return type('obj', (object,), {'id': 'mock-task-456'})
    
    mock_manager = MockTaskManager()
    
    # Start listener
    start_mqtt_listener(mock_manager)
    
    print("\n✅ Listener running. Waiting for events...")
    print("   Send test events to topic: stadium/events")
    print("   Press Ctrl+C to stop\n")
    
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 Stopped")