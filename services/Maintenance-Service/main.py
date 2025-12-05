"""
MAIN.PY -
Maintenance Service
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import asyncio
import httpx

from models import (
    MaintenanceTask, BinAlert, StaffAssignment,
    TaskStatus, TaskPriority, TaskType
)
from schemas import (
    TaskCreate, TaskUpdate, TaskResponse,
    BinAlertCreate, BinAlertResponse,
    AssignmentRequest, AssignmentResponse,
    TaskListResponse, StaffTasksResponse
)
from database import get_db, init_db
from task_manager import TaskManager
# CORRIGIDO: Importar get_staff_coordinator em vez de StaffCoordinator
from staff_coordinator import get_staff_coordinator
from mqtt_listener import start_mqtt_listener

app = FastAPI(
    title="Stadium Maintenance Service",
    description="Cleaning tasks, bin alerts, and staff assignment",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CONFIGURATION ==========

ROUTING_SERVICE_URL = "http://localhost:8002"
MAP_SERVICE_URL = "http://localhost:8000"

# ========== GLOBAL STATE ==========

task_manager: Optional[TaskManager] = None


# ========== STARTUP ==========

@app.on_event("startup")
async def startup():
    """Initialize maintenance service"""
    global task_manager
    
    print("\n" + "="*60)
    print("🧹 MAINTENANCE SERVICE - STARTING")
    print("="*60)
    
    # Initialize database
    init_db()
    print("✅ Database initialized")
    
    # CORRIGIDO: Inicializar staff coordinator ANTES do task manager
    staff_coordinator = get_staff_coordinator()
    print("✅ Staff coordinator initialized")
    
    # Initialize task manager
    task_manager = TaskManager(ROUTING_SERVICE_URL, MAP_SERVICE_URL)
    print("✅ Task manager initialized")
    
    # Start MQTT listener
    start_mqtt_listener(task_manager)
    print("✅ MQTT listener started")
    
    # Start background tasks
    asyncio.create_task(cleanup_old_tasks())
    asyncio.create_task(check_unassigned_tasks())
    print("✅ Background tasks started")
    
    print("\n" + "="*60)
    print("✅ MAINTENANCE SERVICE READY")
    print(f"   - Routing Service: {ROUTING_SERVICE_URL}")
    print(f"   - Map Service: {MAP_SERVICE_URL}")
    print(f"   - Staff Coordinator: Active")
    print("="*60 + "\n")


# ========== BACKGROUND TASKS ==========

async def cleanup_old_tasks():
    """Remove completed tasks older than 24h"""
    while True:
        try:
            db = next(get_db())
            task_manager.cleanup_old_tasks(db, hours=24)
            db.close()
        except Exception as e:
            print(f"❌ Cleanup error: {e}")
        
        await asyncio.sleep(3600)  # Run every hour


async def check_unassigned_tasks():
    """Alert on tasks pending assignment for >5min"""
    while True:
        await asyncio.sleep(60)  # Check every minute
        
        try:
            db = next(get_db())
            unassigned = task_manager.get_unassigned_tasks(db, minutes=5)
            
            if unassigned:
                print(f"⚠️  {len(unassigned)} tasks pending assignment >5min")
                for task in unassigned[:3]:  # Show first 3
                    print(f"   - {task.id}: {task.task_type} at {task.location_node}")
            
            db.close()
        except Exception as e:
            print(f"❌ Unassigned check error: {e}")


# ========== HEALTH & STATUS ==========

@app.get("/")
def root():
    """Health check"""
    staff_coordinator = get_staff_coordinator()
    return {
        "service": "Maintenance Service",
        "version": "1.0.0",
        "status": "running",
        "routing_service": ROUTING_SERVICE_URL,
        "map_service": MAP_SERVICE_URL,
        "staff_registered": len(staff_coordinator.staff_locations)
    }


@app.get("/api/maintenance/status")
def get_service_status(db: Session = Depends(get_db)):
    """Get service status and statistics"""
    staff_coordinator = get_staff_coordinator()
    stats = task_manager.get_statistics(db)
    
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "statistics": stats,
        "staff": {
            "registered": len(staff_coordinator.staff_locations),
            "available": staff_coordinator.get_available_count()
        }
    }


# ========== BIN ALERTS ==========

@app.post("/api/maintenance/bins/alert", response_model=TaskResponse, status_code=201)
async def create_bin_alert(
    alert: BinAlertCreate,
    auto_assign: bool = Query(True, description="Automatically assign to nearest staff"),
    db: Session = Depends(get_db)
):
    """Create bin-full alert and optionally auto-assign"""
    task = task_manager.create_bin_task(db, alert)
    
    # Auto-assign if requested
    if auto_assign:
        assignment = await task_manager.auto_assign_task(db, task.id)
        if assignment:
            print(f"✅ Task {task.id} auto-assigned to {assignment.staff_id}")
    
    return task


@app.get("/api/maintenance/bins/alerts", response_model=List[BinAlertResponse])
def get_bin_alerts(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    db: Session = Depends(get_db)
):
    """Get all bin alerts"""
    from models import MaintenanceTask, TaskType
    
    # Build query directly from database
    query = db.query(MaintenanceTask).filter(
        MaintenanceTask.task_type == TaskType.BIN_FULL
    )
    
    if status:
        query = query.filter(MaintenanceTask.status == status)
    if priority:
        query = query.filter(MaintenanceTask.priority == priority)
    
    tasks = query.all()
    
    result = []
    for t in tasks:
        # Convert datetime to ISO string if needed
        created_at = t.created_at
        if hasattr(created_at, 'isoformat'):
            created_at = created_at.isoformat()
        
        completed_at = t.completed_at
        if completed_at and hasattr(completed_at, 'isoformat'):
            completed_at = completed_at.isoformat()
        
        result.append(BinAlertResponse(
            id=t.id,
            bin_id=t.main_metadata.get('bin_id') if t.main_metadata else None,
            location_node=t.location_node,
            fill_percentage=t.main_metadata.get('fill_percentage', 0) if t.main_metadata else 0,
            priority=t.priority,
            status=t.status,
            assigned_to=t.assigned_to,
            created_at=created_at,
            completed_at=completed_at
        ))
    
    return result


# ========== TASKS ==========

@app.post("/api/maintenance/tasks", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new maintenance task"""
    return task_manager.create_task(db, task)


@app.get("/api/maintenance/tasks", response_model=TaskListResponse)
def get_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """Get tasks with filters"""
    filters = {}
    if status:
        filters['status'] = status
    if priority:
        filters['priority'] = priority
    if assigned_to:
        filters['assigned_to'] = assigned_to
    
    if task_type:
        try:
            task_type_enum = TaskType(task_type)
            tasks = task_manager.get_tasks_by_type(db, task_type_enum, **filters)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid task_type: {task_type}")
    else:
        tasks = task_manager.get_all_tasks(db, **filters)
    
    tasks = tasks[:limit]
    
    return TaskListResponse(
        total=len(tasks),
        tasks=tasks
    )


@app.get("/api/maintenance/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    """Get specific task details"""
    task = task_manager.get_task(db, task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return task


@app.patch("/api/maintenance/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    update: TaskUpdate,
    db: Session = Depends(get_db)
):
    """Update task details"""
    task = task_manager.update_task(db, task_id, update)
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return task


@app.delete("/api/maintenance/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    """Delete a task (use with caution)"""
    success = task_manager.delete_task(db, task_id)
    
    if not success:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return {"status": "deleted", "task_id": task_id}


# ========== ASSIGNMENT ==========

@app.post("/api/maintenance/assign", response_model=AssignmentResponse)
async def assign_task(
    request: AssignmentRequest,
    db: Session = Depends(get_db)
):
    """Manually assign task to staff member"""
    assignment = await task_manager.assign_task_to_staff(
        db,
        request.task_id,
        request.staff_id,
        request.calculate_route
    )
    
    if not assignment:
        raise HTTPException(status_code=400, detail="Assignment failed")
    
    return assignment


@app.post("/api/maintenance/assign/auto/{task_id}", response_model=AssignmentResponse)
async def auto_assign_task(task_id: str, db: Session = Depends(get_db)):
    """Automatically assign task to nearest available staff"""
    assignment = await task_manager.auto_assign_task(db, task_id)
    
    if not assignment:
        raise HTTPException(
            status_code=400,
            detail="No available staff or assignment failed"
        )
    
    return assignment


@app.post("/api/maintenance/assign/batch")
async def batch_assign_tasks(
    auto_assign_all: bool = Query(True),
    priority_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Batch assign all unassigned tasks"""
    filters = {'status': 'pending'}
    if priority_filter:
        filters['priority'] = priority_filter
    
    unassigned_tasks = task_manager.get_all_tasks(db, **filters)
    
    results = {
        "total_tasks": len(unassigned_tasks),
        "assigned": 0,
        "failed": 0,
        "assignments": []
    }
    
    for task in unassigned_tasks:
        assignment = await task_manager.auto_assign_task(db, task.id)
        
        if assignment:
            results["assigned"] += 1
            results["assignments"].append({
                "task_id": task.id,
                "staff_id": assignment.staff_id,
                "eta_seconds": assignment.eta_seconds
            })
        else:
            results["failed"] += 1
    
    return results


# ========== STAFF MANAGEMENT ==========

@app.post("/api/maintenance/staff/register")
def register_staff(
    staff_id: str = Query(...),
    name: str = Query(...),
    role: str = Query("cleaning"),
    current_location: str = Query(...)
):
    """Register staff member and their location"""
    staff_coordinator = get_staff_coordinator()
    staff_coordinator.register_staff(staff_id, name, role, current_location)
    
    return {
        "status": "registered",
        "staff_id": staff_id,
        "name": name,
        "role": role,
        "location": current_location
    }


@app.patch("/api/maintenance/staff/{staff_id}/location")
def update_staff_location(
    staff_id: str,
    location: str = Query(..., description="Current node ID")
):
    """Update staff member's current location"""
    staff_coordinator = get_staff_coordinator()
    success = staff_coordinator.update_location(staff_id, location)
    
    if not success:
        raise HTTPException(status_code=404, detail=f"Staff {staff_id} not found")
    
    return {
        "status": "updated",
        "staff_id": staff_id,
        "location": location
    }


@app.patch("/api/maintenance/staff/{staff_id}/availability")
def update_staff_availability(
    staff_id: str,
    is_available: bool = Query(...)
):
    """Update staff availability status"""
    staff_coordinator = get_staff_coordinator()
    success = staff_coordinator.set_availability(staff_id, is_available)
    
    if not success:
        raise HTTPException(status_code=404, detail=f"Staff {staff_id} not found")
    
    return {
        "status": "updated",
        "staff_id": staff_id,
        "is_available": is_available
    }


@app.get("/api/maintenance/staff")
def get_staff_list():
    """Get all registered staff"""
    staff_coordinator = get_staff_coordinator()
    return staff_coordinator.get_all_staff()


@app.get("/api/maintenance/staff/available")
def get_available_staff():
    """Get only available staff"""
    staff_coordinator = get_staff_coordinator()
    return staff_coordinator.get_available_staff()


@app.get("/api/maintenance/staff/{staff_id}/tasks", response_model=StaffTasksResponse)
def get_staff_tasks(
    staff_id: str,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get tasks assigned to specific staff member"""
    filters = {'assigned_to': staff_id}
    if status:
        filters['status'] = status
    
    tasks = task_manager.get_all_tasks(db, **filters)
    
    return StaffTasksResponse(
        staff_id=staff_id,
        total_tasks=len(tasks),
        tasks=tasks
    )


# ========== COMPLETION ==========

@app.post("/api/maintenance/tasks/{task_id}/complete")
def complete_task(
    task_id: str,
    notes: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Mark task as completed"""
    update = TaskUpdate(
        status=TaskStatus.COMPLETED.value,
        notes=notes
    )
    
    task = task_manager.update_task(db, task_id, update)
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    # Free up staff member
    if task.assigned_to:
        staff_coordinator = get_staff_coordinator()
        staff_coordinator.set_availability(task.assigned_to, True)
    
    return {
        "status": "completed",
        "task_id": task_id,
        "completed_at": task.completed_at if task.completed_at else None
    }


@app.post("/api/maintenance/tasks/{task_id}/start")
def start_task(task_id: str, db: Session = Depends(get_db)):
    """Mark task as in progress"""
    update = TaskUpdate(status=TaskStatus.IN_PROGRESS.value)
    task = task_manager.update_task(db, task_id, update)
    
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return {
        "status": "started",
        "task_id": task_id,
        "assigned_to": task.assigned_to
    }


# ========== STATISTICS ==========

@app.get("/api/maintenance/stats")
def get_statistics(db: Session = Depends(get_db)):
    """Get detailed maintenance statistics"""
    return task_manager.get_statistics(db)


@app.get("/api/maintenance/stats/staff/{staff_id}")
def get_staff_statistics(staff_id: str, db: Session = Depends(get_db)):
    """Get statistics for specific staff member"""
    return task_manager.get_staff_statistics(db, staff_id)


# ========== RUN SERVER ==========

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8006,
        log_level="info"
    )