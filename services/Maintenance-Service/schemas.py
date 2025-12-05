"""
PYDANTIC SCHEMAS for Maintenance Service
Request/Response models for API endpoints
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ========== TASK SCHEMAS ==========

class TaskCreate(BaseModel):
    """Create new maintenance task"""
    task_type: str = Field(..., description="Type of task: bin_full, spill_cleanup, restroom_check, etc.")
    location_node: str = Field(..., description="Node ID where task is located")
    priority: str = Field(default="medium", description="Priority: low, medium, high, critical")
    description: Optional[str] = Field(None, description="Task description")
    location_description: Optional[str] = Field(None, description="Human-readable location")
    estimated_duration_min: int = Field(default=10, description="Estimated duration in minutes")
    main_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional task-specific data")


class TaskUpdate(BaseModel):
    """Update existing task"""
    status: Optional[str] = Field(None, description="New status: pending, assigned, in_progress, completed, cancelled")
    priority: Optional[str] = Field(None, description="Update priority")
    assigned_to: Optional[str] = Field(None, description="Assign to staff ID")
    notes: Optional[str] = Field(None, description="Add notes")
    main_metadata: Optional[Dict[str, Any]] = Field(None, description="Update metadata")


class TaskResponse(BaseModel):
    """Task response model"""
    id: str
    task_type: str
    status: str
    priority: str
    location_node: str
    location_description: Optional[str]
    assigned_to: Optional[str]
    assigned_at: Optional[str]
    description: Optional[str]
    notes: Optional[str]
    main_metadata: Dict[str, Any]
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    estimated_duration_min: int
    
    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """List of tasks"""
    total: int
    tasks: List[TaskResponse]


# ========== BIN ALERT SCHEMAS ==========

class BinAlertCreate(BaseModel):
    """Create bin-full alert"""
    bin_id: str = Field(..., description="Bin identifier (e.g., BIN-A12)")
    location_node: str = Field(..., description="Node ID where bin is located")
    fill_percentage: int = Field(..., ge=0, le=100, description="Fill level 0-100%")
    priority: str = Field(default="medium", description="Priority based on fill level")
    capacity_liters: Optional[int] = Field(None, description="Bin capacity in liters")


class BinAlertResponse(BaseModel):
    """Bin alert response"""
    id: str
    bin_id: str
    location_node: str
    fill_percentage: int
    priority: str
    status: str
    assigned_to: Optional[str]
    created_at: str
    completed_at: Optional[str]
    
    class Config:
        from_attributes = True


# ========== ASSIGNMENT SCHEMAS ==========

class AssignmentRequest(BaseModel):
    """Manual task assignment"""
    task_id: str = Field(..., description="Task to assign")
    staff_id: str = Field(..., description="Staff member to assign to")
    calculate_route: bool = Field(default=True, description="Calculate route from staff location to task")


class AssignmentResponse(BaseModel):
    """Assignment result with routing info"""
    assignment_id: str
    task_id: str
    staff_id: str
    route_nodes: List[str]
    route_distance: float
    eta_seconds: int
    assigned_at: str
    
    class Config:
        from_attributes = True


# ========== STAFF SCHEMAS ==========

class StaffRegister(BaseModel):
    """Register new staff member"""
    staff_id: str
    name: str
    role: str = Field(default="cleaning", description="Role: cleaning, supervisor, maintenance")
    current_location: str = Field(..., description="Current node ID")


class StaffUpdate(BaseModel):
    """Update staff information"""
    current_location: Optional[str] = None
    is_available: Optional[bool] = None


class StaffResponse(BaseModel):
    """Staff member response"""
    id: str
    name: str
    role: str
    is_available: bool
    current_location: Optional[str]
    tasks_completed: int
    total_distance_m: float
    registered_at: str
    last_seen: str
    
    class Config:
        from_attributes = True


class StaffTasksResponse(BaseModel):
    """Tasks assigned to staff member"""
    staff_id: str
    total_tasks: int
    tasks: List[TaskResponse]


# ========== STATISTICS SCHEMAS ==========

class TaskStatistics(BaseModel):
    """Overall task statistics"""
    total_tasks: int
    by_status: Dict[str, int]
    by_priority: Dict[str, int]
    by_type: Dict[str, int]
    avg_completion_time_min: Optional[float]
    pending_tasks: int
    overdue_tasks: int


class StaffStatistics(BaseModel):
    """Staff performance statistics"""
    staff_id: str
    name: str
    tasks_completed: int
    tasks_in_progress: int
    avg_completion_time_min: Optional[float]
    total_distance_m: float
    availability_rate: float


# ========== ROUTE SCHEMAS ==========

class RouteInfo(BaseModel):
    """Routing information"""
    from_node: str
    to_node: str
    path: List[str]
    distance: float
    eta_seconds: int
    waypoints: List[Dict[str, float]]  # [{x, y}, ...]


# ========== BATCH OPERATIONS ==========

class BatchAssignmentRequest(BaseModel):
    """Batch assign multiple tasks"""
    task_ids: List[str]
    priority_order: bool = Field(default=True, description="Assign high-priority tasks first")


class BatchAssignmentResponse(BaseModel):
    """Batch assignment results"""
    total_requested: int
    successful: int
    failed: int
    assignments: List[AssignmentResponse]
    errors: List[Dict[str, str]]


# ========== ALERTS ==========

class MaintenanceAlert(BaseModel):
    """Alert for urgent maintenance needs"""
    alert_id: str
    alert_type: str  # bin_full, spill, equipment_failure
    location: str
    severity: str  # low, medium, high, critical
    message: str
    created_at: str
    acknowledged: bool = False