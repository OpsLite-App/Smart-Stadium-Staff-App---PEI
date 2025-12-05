"""
TASK MANAGER - CORRIGIDO
Core business logic for task creation, assignment, and lifecycle
"""

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import uuid
import httpx

from models import (
    MaintenanceTask, BinAlert, StaffAssignment, TaskHistory,
    TaskStatus, TaskPriority, TaskType
)
from schemas import (
    TaskCreate, TaskUpdate, TaskResponse,
    BinAlertCreate, AssignmentResponse
)


class TaskManager:
    """Manages maintenance tasks and assignments"""
    
    def __init__(self, routing_service_url: str, map_service_url: str):
        self.routing_service_url = routing_service_url
        self.map_service_url = map_service_url
    
    # ========== TASK CREATION ==========
    
    def create_task(self, db: Session, task_data: TaskCreate) -> TaskResponse:
        """Create a new maintenance task"""
        task = MaintenanceTask(
            id=f"task-{uuid.uuid4().hex[:8]}",
            task_type=TaskType(task_data.task_type),
            location_node=task_data.location_node,
            priority=TaskPriority(task_data.priority),
            description=task_data.description,
            location_description=task_data.location_description,
            estimated_duration_min=task_data.estimated_duration_min,
            main_metadata=task_data.main_metadata
        )
        
        db.add(task)
        db.commit()
        db.refresh(task)
        
        # Log creation
        self._log_task_event(db, task.id, "created", None, TaskStatus.PENDING.value)
        
        return self._task_to_response(task)
    
    def create_bin_task(self, db: Session, alert: BinAlertCreate) -> TaskResponse:
        """Create task from bin-full alert"""
        # Determine priority based on fill percentage
        if alert.fill_percentage >= 95:
            priority = "critical"
        elif alert.fill_percentage >= 85:
            priority = "high"
        else:
            priority = "medium"
        
        # Create task
        task_data = TaskCreate(
            task_type="bin_full",
            location_node=alert.location_node,
            priority=priority,
            description=f"Bin {alert.bin_id} is {alert.fill_percentage}% full",
            location_description=f"Near {alert.location_node}",
            estimated_duration_min=5,
            main_metadata={
                "bin_id": alert.bin_id,
                "fill_percentage": alert.fill_percentage,
                "capacity_liters": alert.capacity_liters
            }
        )
        
        task = self.create_task(db, task_data)
        
        # Create bin alert record
        bin_alert = BinAlert(
            id=f"bin-alert-{uuid.uuid4().hex[:8]}",
            task_id=task.id,
            bin_id=alert.bin_id,
            location_node=alert.location_node,
            fill_percentage=alert.fill_percentage,
            capacity_liters=alert.capacity_liters
        )
        
        db.add(bin_alert)
        db.commit()
        
        return task
    
    # ========== TASK QUERIES ==========
    
    def get_task(self, db: Session, task_id: str) -> Optional[TaskResponse]:
        """Get task by ID"""
        task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        return self._task_to_response(task) if task else None
    
    def get_all_tasks(self, db: Session, **filters) -> List[TaskResponse]:
        """Get all tasks with optional filters"""
        query = db.query(MaintenanceTask)
        
        if 'status' in filters:
            query = query.filter(MaintenanceTask.status == TaskStatus(filters['status']))
        
        if 'priority' in filters:
            query = query.filter(MaintenanceTask.priority == TaskPriority(filters['priority']))
        
        if 'assigned_to' in filters:
            query = query.filter(MaintenanceTask.assigned_to == filters['assigned_to'])
        
        query = query.order_by(MaintenanceTask.created_at.desc())
        tasks = query.all()
        
        return [self._task_to_response(t) for t in tasks]
    
    def get_tasks_by_type(self, db: Session, task_type: TaskType, **filters) -> List[TaskResponse]:
        """Get tasks of specific type"""
        query = db.query(MaintenanceTask).filter(MaintenanceTask.task_type == task_type)
        
        if 'status' in filters:
            query = query.filter(MaintenanceTask.status == TaskStatus(filters['status']))
        
        if 'priority' in filters:
            query = query.filter(MaintenanceTask.priority == TaskPriority(filters['priority']))
        
        tasks = query.order_by(MaintenanceTask.created_at.desc()).all()
        return [self._task_to_response(t) for t in tasks]
    
    def get_unassigned_tasks(self, db: Session, minutes: int = 5) -> List[MaintenanceTask]:
        """Get tasks pending assignment for >N minutes"""
        threshold = datetime.now() - timedelta(minutes=minutes)
        
        return db.query(MaintenanceTask).filter(
            MaintenanceTask.status == TaskStatus.PENDING,
            MaintenanceTask.assigned_to.is_(None),
            MaintenanceTask.created_at < threshold
        ).all()
    
    # ========== TASK UPDATES ==========
    
    def update_task(self, db: Session, task_id: str, update: TaskUpdate) -> Optional[TaskResponse]:
        """Update task fields"""
        task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        
        if not task:
            return None
        
        old_status = task.status.value
        
        # Update fields
        if update.status:
            new_status = TaskStatus(update.status)
            task.status = new_status
            
            if new_status == TaskStatus.IN_PROGRESS and not task.started_at:
                task.started_at = datetime.now()
            elif new_status == TaskStatus.COMPLETED and not task.completed_at:
                task.completed_at = datetime.now()
        
        if update.priority:
            task.priority = TaskPriority(update.priority)
        
        if update.assigned_to:
            task.assigned_to = update.assigned_to
            task.assigned_at = datetime.now()
            if not task.status == TaskStatus.ASSIGNED:
                task.status = TaskStatus.ASSIGNED
        
        if update.notes:
            task.notes = update.notes
        
        if update.main_metadata:
            task.main_metadata.update(update.main_metadata)
        
        db.commit()
        db.refresh(task)
        
        # Log update
        if old_status != task.status.value:
            self._log_task_event(db, task_id, "status_change", old_status, task.status.value)
        
        return self._task_to_response(task)
    
    def delete_task(self, db: Session, task_id: str) -> bool:
        """Delete task (use with caution)"""
        task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        
        if not task:
            return False
        
        # Delete related records
        db.query(BinAlert).filter(BinAlert.task_id == task_id).delete()
        db.query(StaffAssignment).filter(StaffAssignment.task_id == task_id).delete()
        db.query(TaskHistory).filter(TaskHistory.task_id == task_id).delete()
        
        db.delete(task)
        db.commit()
        
        return True
    
    # ========== ASSIGNMENT (CORRIGIDO) ==========
    
    async def assign_task_to_staff(
        self,
        db: Session,
        task_id: str,
        staff_id: str,
        calculate_route: bool = True
    ) -> Optional[AssignmentResponse]:
        """Assign task to specific staff member"""
        task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        
        if not task:
            print(f"❌ Task {task_id} not found")
            return None
        
        # Get staff location from staff coordinator
        from staff_coordinator import staff_coordinator_instance
        
        if not staff_coordinator_instance:
            print(f"❌ Staff coordinator not initialized")
            return None
        
        staff_info = staff_coordinator_instance.get_staff(staff_id)
        
        if not staff_info:
            print(f"❌ Staff {staff_id} not found in coordinator")
            return None
        
        # CORRIGIDO: Usar a localização atual do staff
        staff_location = staff_info["current_location"]
        print(f"📍 Staff {staff_id} is at {staff_location}, task at {task.location_node}")
        
        # Calculate route if requested
        route_nodes = []
        route_distance = 0.0
        eta_seconds = 0
        
        if calculate_route:
            route_info = await self._calculate_route(staff_location, task.location_node)
            if route_info:
                route_nodes = route_info.get("path", [])
                route_distance = route_info.get("distance", 0.0)
                eta_seconds = route_info.get("eta_seconds", 0)
                print(f"✅ Route calculated: {route_distance}m, ETA {eta_seconds}s")
            else:
                print(f"⚠️  Could not calculate route from {staff_location} to {task.location_node}")
                # Não assumir rota default - deixar vazio se falhar
        
        # Create assignment record
        assignment = StaffAssignment(
            id=f"assign-{uuid.uuid4().hex[:8]}",
            task_id=task_id,
            staff_id=staff_id,
            route_nodes=route_nodes,
            route_distance=route_distance,
            eta_seconds=eta_seconds
        )
        
        db.add(assignment)
        
        # Update task
        task.assigned_to = staff_id
        task.assigned_at = datetime.now()
        task.status = TaskStatus.ASSIGNED
        
        # CORRIGIDO: Marcar staff como indisponível ANTES do commit
        staff_coordinator_instance.set_availability(staff_id, False)
        print(f"🔒 Staff {staff_id} marked as unavailable")
        
        db.commit()
        db.refresh(assignment)
        
        # Log assignment
        self._log_task_event(db, task_id, "assigned", None, None, staff_id=staff_id)
        
        return AssignmentResponse(
            assignment_id=assignment.id,
            task_id=task_id,
            staff_id=staff_id,
            route_nodes=route_nodes,
            route_distance=route_distance,
            eta_seconds=eta_seconds,
            assigned_at=assignment.assigned_at.isoformat()
        )
    
    async def auto_assign_task(self, db: Session, task_id: str) -> Optional[AssignmentResponse]:
        """Automatically assign task to nearest available staff"""
        task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        
        if not task:
            print(f"❌ Task {task_id} not found")
            return None
        
        # Get available staff from coordinator
        from staff_coordinator import staff_coordinator_instance
        
        if not staff_coordinator_instance:
            print(f"❌ Staff coordinator not initialized")
            return None
        
        available_staff = staff_coordinator_instance.get_available_staff()
        
        if not available_staff:
            print(f"⚠️  No available staff for auto-assignment")
            return None
        
        print(f"🔍 Finding nearest staff from {len(available_staff)} available")
        
        # Find nearest staff using routing service
        nearest_staff = None
        min_distance = float('inf')
        best_route_info = None
        
        for staff in available_staff:
            staff_id = staff["id"]
            staff_location = staff["current_location"]
            
            print(f"   Checking {staff_id} at {staff_location}...")
            route_info = await self._calculate_route(staff_location, task.location_node)
            
            if route_info:
                distance = route_info.get("distance", float('inf'))
                print(f"   → Distance: {distance}m")
                if distance < min_distance:
                    min_distance = distance
                    nearest_staff = staff_id
                    best_route_info = route_info
            else:
                print(f"   → Could not calculate route")
        
        if not nearest_staff:
            print(f"❌ Could not find nearest staff (routing failed for all)")
            return None
        
        print(f"✅ Nearest staff: {nearest_staff} ({min_distance}m away)")
        
        # Assign to nearest staff
        assignment = await self.assign_task_to_staff(db, task_id, nearest_staff, calculate_route=False)
        
        # Use pre-calculated route info
        if assignment and best_route_info:
            # Update assignment with calculated route
            db_assignment = db.query(StaffAssignment).filter(
                StaffAssignment.id == assignment.assignment_id
            ).first()
            
            if db_assignment:
                db_assignment.route_nodes = best_route_info.get("path", [])
                db_assignment.route_distance = best_route_info.get("distance", 0.0)
                db_assignment.eta_seconds = best_route_info.get("eta_seconds", 0)
                db.commit()
                
                # Update response
                assignment.route_nodes = db_assignment.route_nodes
                assignment.route_distance = db_assignment.route_distance
                assignment.eta_seconds = db_assignment.eta_seconds
        
        return assignment
    
    async def _calculate_route(self, from_node: str, to_node: str) -> Optional[Dict[str, Any]]:
        """Call routing service to calculate path"""
        try:
            print(f"🗺️  Calculating route: {from_node} → {to_node}")
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.routing_service_url}/api/route",
                    params={"from_node": from_node, "to_node": to_node}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Estimate ETA (assume 1.5 m/s walking speed)
                    distance = data.get("distance", 0)
                    eta_seconds = int(distance / 1.5) if distance > 0 else 0
                    
                    print(f"   ✅ Route found: {len(data.get('path', []))} nodes, {distance}m")
                    
                    return {
                        "path": data.get("path", []),
                        "distance": distance,
                        "eta_seconds": eta_seconds
                    }
                else:
                    print(f"   ❌ Routing service returned {response.status_code}")
        except httpx.TimeoutException:
            print(f"   ❌ Routing service timeout")
        except Exception as e:
            print(f"   ❌ Route calculation error: {e}")
        
        return None
    
    # ========== STATISTICS ==========
    
    def get_statistics(self, db: Session) -> Dict[str, Any]:
        """Get overall task statistics"""
        all_tasks = db.query(MaintenanceTask).all()
        
        stats = {
            "total_tasks": len(all_tasks),
            "by_status": {},
            "by_priority": {},
            "by_type": {},
            "pending_tasks": 0,
            "avg_completion_time_min": None
        }
        
        completion_times = []
        
        for task in all_tasks:
            # Count by status
            status = task.status.value
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            # Count by priority
            priority = task.priority.value
            stats["by_priority"][priority] = stats["by_priority"].get(priority, 0) + 1
            
            # Count by type
            task_type = task.task_type.value
            stats["by_type"][task_type] = stats["by_type"].get(task_type, 0) + 1
            
            # Pending count
            if task.status == TaskStatus.PENDING:
                stats["pending_tasks"] += 1
            
            # Completion times
            if task.completed_at and task.created_at:
                duration = (task.completed_at - task.created_at).total_seconds() / 60
                completion_times.append(duration)
        
        # Calculate average completion time
        if completion_times:
            stats["avg_completion_time_min"] = round(sum(completion_times) / len(completion_times), 2)
        
        return stats
    
    def get_staff_statistics(self, db: Session, staff_id: str) -> Dict[str, Any]:
        """Get statistics for specific staff member"""
        tasks = db.query(MaintenanceTask).filter(
            MaintenanceTask.assigned_to == staff_id
        ).all()
        
        completed = [t for t in tasks if t.status == TaskStatus.COMPLETED]
        in_progress = [t for t in tasks if t.status == TaskStatus.IN_PROGRESS]
        
        completion_times = []
        for task in completed:
            if task.completed_at and task.started_at:
                duration = (task.completed_at - task.started_at).total_seconds() / 60
                completion_times.append(duration)
        
        # Get total distance from assignments
        assignments = db.query(StaffAssignment).filter(
            StaffAssignment.staff_id == staff_id
        ).all()
        
        total_distance = sum(a.route_distance or 0 for a in assignments)
        
        return {
            "staff_id": staff_id,
            "tasks_completed": len(completed),
            "tasks_in_progress": len(in_progress),
            "avg_completion_time_min": round(sum(completion_times) / len(completion_times), 2) if completion_times else None,
            "total_distance_m": round(total_distance, 2)
        }
    
    # ========== CLEANUP ==========
    
    def cleanup_old_tasks(self, db: Session, hours: int = 24):
        """Remove completed tasks older than N hours"""
        threshold = datetime.now() - timedelta(hours=hours)
        
        old_tasks = db.query(MaintenanceTask).filter(
            MaintenanceTask.status == TaskStatus.COMPLETED,
            MaintenanceTask.completed_at < threshold
        ).all()
        
        for task in old_tasks:
            db.delete(task)
        
        if old_tasks:
            db.commit()
            print(f"🗑️  Cleaned up {len(old_tasks)} old tasks")
    
    # ========== HELPERS ==========
    
    def _task_to_response(self, task: MaintenanceTask) -> TaskResponse:
        """Convert SQLAlchemy model to Pydantic response"""
        return TaskResponse(
            id=task.id,
            task_type=task.task_type.value,
            status=task.status.value,
            priority=task.priority.value,
            location_node=task.location_node,
            location_description=task.location_description,
            assigned_to=task.assigned_to,
            assigned_at=task.assigned_at.isoformat() if task.assigned_at else None,
            description=task.description,
            notes=task.notes,
            main_metadata=task.main_metadata,
            created_at=task.created_at.isoformat(),
            started_at=task.started_at.isoformat() if task.started_at else None,
            completed_at=task.completed_at.isoformat() if task.completed_at else None,
            estimated_duration_min=task.estimated_duration_min
        )
    
    def _log_task_event(
        self,
        db: Session,
        task_id: str,
        event_type: str,
        previous_status: Optional[str] = None,
        new_status: Optional[str] = None,
        staff_id: Optional[str] = None,
        notes: Optional[str] = None
    ):
        """Log task event to history"""
        history = TaskHistory(
            task_id=task_id,
            event_type=event_type,
            previous_status=previous_status,
            new_status=new_status,
            staff_id=staff_id,
            notes=notes
        )
        
        db.add(history)
        db.commit()