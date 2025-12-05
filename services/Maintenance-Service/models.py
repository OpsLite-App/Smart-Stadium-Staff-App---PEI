"""
DATABASE MODELS for Maintenance Service
SQLAlchemy models for tasks, assignments, and history
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from enum import Enum

Base = declarative_base()


# ========== ENUMS ==========

class TaskStatus(str, Enum):
    """Task lifecycle status"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    """Task priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskType(str, Enum):
    """Types of maintenance tasks"""
    BIN_FULL = "bin_full"
    SPILL_CLEANUP = "spill_cleanup"
    RESTROOM_CHECK = "restroom_check"
    EQUIPMENT_REPAIR = "equipment_repair"
    GENERAL_CLEANING = "general_cleaning"
    INSPECTION = "inspection"


# ========== MODELS ==========

class MaintenanceTask(Base):
    """Main task table"""
    __tablename__ = "maintenance_tasks"
    
    # Primary fields
    id = Column(String, primary_key=True)
    task_type = Column(SQLEnum(TaskType), nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False)
    
    # Location
    location_node = Column(String, nullable=False, index=True)
    location_description = Column(String, nullable=True)
    
    # Assignment
    assigned_to = Column(String, nullable=True, index=True)
    assigned_at = Column(DateTime, nullable=True)
    
    # Metadata
    description = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    main_metadata = Column(JSON, default=dict)  # Flexible storage for task-specific data
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Estimated completion time (minutes)
    estimated_duration_min = Column(Integer, default=10)
    
    def __repr__(self):
        return f"<Task {self.id}: {self.task_type.value} @ {self.location_node} [{self.status.value}]>"


class BinAlert(Base):
    """Bin-specific alerts (extends task with bin details)"""
    __tablename__ = "bin_alerts"
    
    id = Column(String, primary_key=True)
    task_id = Column(String, nullable=False, index=True)  # Foreign key to MaintenanceTask
    
    bin_id = Column(String, nullable=False, index=True)
    location_node = Column(String, nullable=False)
    
    fill_percentage = Column(Integer, nullable=False)  # 0-100
    capacity_liters = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<BinAlert {self.bin_id} @ {self.fill_percentage}%>"


class StaffAssignment(Base):
    """Assignment history and routing info"""
    __tablename__ = "staff_assignments"
    
    id = Column(String, primary_key=True)
    task_id = Column(String, nullable=False, index=True)
    staff_id = Column(String, nullable=False, index=True)
    
    # Route information
    route_nodes = Column(JSON, default=list)  # List of node IDs
    route_distance = Column(Float, nullable=True)
    eta_seconds = Column(Integer, nullable=True)
    
    # Assignment metadata
    assigned_at = Column(DateTime, default=datetime.now, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Performance tracking
    actual_duration_sec = Column(Integer, nullable=True)
    
    def __repr__(self):
        return f"<Assignment {self.task_id} → {self.staff_id}>"


class StaffMember(Base):
    """Staff registry"""
    __tablename__ = "staff_members"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, default="cleaning", nullable=False)  # cleaning, supervisor, maintenance
    
    # Current state
    is_available = Column(Boolean, default=True, nullable=False)
    current_location = Column(String, nullable=True)  # Current node ID
    
    # Statistics
    tasks_completed = Column(Integer, default=0)
    total_distance_m = Column(Float, default=0.0)
    
    # Timestamps
    registered_at = Column(DateTime, default=datetime.now, nullable=False)
    last_seen = Column(DateTime, default=datetime.now, nullable=False)
    
    def __repr__(self):
        return f"<Staff {self.id}: {self.name} ({self.role})>"


class TaskHistory(Base):
    """Historical log of task state changes"""
    __tablename__ = "task_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String, nullable=False, index=True)
    
    event_type = Column(String, nullable=False)  # created, assigned, started, completed, cancelled
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    
    staff_id = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    main_metadata = Column(JSON, default=dict)
    
    timestamp = Column(DateTime, default=datetime.now, nullable=False, index=True)
    
    def __repr__(self):
        return f"<TaskHistory {self.task_id}: {self.event_type}>"