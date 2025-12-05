"""
STAFF COORDINATOR
Manages staff registry, locations, and availability
In-memory tracking with periodic sync to database
"""

from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass, asdict


@dataclass
class StaffInfo:
    """Staff member information"""
    id: str
    name: str
    role: str
    current_location: str
    is_available: bool
    tasks_completed: int = 0
    total_distance_m: float = 0.0
    registered_at: str = None
    last_seen: str = None
    
    def __post_init__(self):
        if self.registered_at is None:
            self.registered_at = datetime.now().isoformat()
        if self.last_seen is None:
            self.last_seen = datetime.now().isoformat()


class StaffCoordinator:
    """
    Manages staff locations and availability
    
    This is an in-memory coordinator that tracks staff in real-time.
    For persistence, data is synced to the database periodically.
    """
    
    def __init__(self):
        self.staff_locations: Dict[str, StaffInfo] = {}
    
    # ========== REGISTRATION ==========
    
    def register_staff(
        self,
        staff_id: str,
        name: str,
        role: str,
        current_location: str
    ) -> StaffInfo:
        """Register a new staff member"""
        staff = StaffInfo(
            id=staff_id,
            name=name,
            role=role,
            current_location=current_location,
            is_available=True
        )
        
        self.staff_locations[staff_id] = staff
        print(f"✅ Registered staff: {staff_id} ({name}) @ {current_location}")
        
        return staff
    
    def unregister_staff(self, staff_id: str) -> bool:
        """Remove staff member from tracking"""
        if staff_id in self.staff_locations:
            del self.staff_locations[staff_id]
            print(f"🗑️  Unregistered staff: {staff_id}")
            return True
        return False
    
    # ========== LOCATION TRACKING ==========
    
    def update_location(self, staff_id: str, location: str) -> bool:
        """Update staff member's current location"""
        if staff_id not in self.staff_locations:
            return False
        
        self.staff_locations[staff_id].current_location = location
        self.staff_locations[staff_id].last_seen = datetime.now().isoformat()
        
        return True
    
    def get_location(self, staff_id: str) -> Optional[str]:
        """Get staff member's current location"""
        staff = self.staff_locations.get(staff_id)
        return staff.current_location if staff else None
    
    # ========== AVAILABILITY ==========
    
    def set_availability(self, staff_id: str, is_available: bool) -> bool:
        """Set staff availability status"""
        if staff_id not in self.staff_locations:
            return False
        
        self.staff_locations[staff_id].is_available = is_available
        self.staff_locations[staff_id].last_seen = datetime.now().isoformat()
        
        status = "available" if is_available else "busy"
        print(f"📍 Staff {staff_id} is now {status}")
        
        return True
    
    def is_available(self, staff_id: str) -> bool:
        """Check if staff member is available"""
        staff = self.staff_locations.get(staff_id)
        return staff.is_available if staff else False
    
    # ========== QUERIES ==========
    
    def get_staff(self, staff_id: str) -> Optional[Dict]:
        """Get staff information"""
        staff = self.staff_locations.get(staff_id)
        return asdict(staff) if staff else None
    
    def get_all_staff(self) -> List[Dict]:
        """Get all registered staff"""
        return [asdict(staff) for staff in self.staff_locations.values()]
    
    def get_available_staff(self) -> List[Dict]:
        """Get only available staff members"""
        return [
            asdict(staff)
            for staff in self.staff_locations.values()
            if staff.is_available
        ]
    
    def get_staff_by_role(self, role: str) -> List[Dict]:
        """Get staff members by role"""
        return [
            asdict(staff)
            for staff in self.staff_locations.values()
            if staff.role.lower() == role.lower()
        ]
    
    def get_available_by_role(self, role: str) -> List[Dict]:
        """Get available staff members of specific role"""
        return [
            asdict(staff)
            for staff in self.staff_locations.values()
            if staff.role.lower() == role.lower() and staff.is_available
        ]
    
    def get_available_count(self) -> int:
        """Count available staff"""
        return sum(1 for staff in self.staff_locations.values() if staff.is_available)
    
    # ========== STATISTICS ==========
    
    def update_stats(self, staff_id: str, distance_m: float = 0.0, completed: bool = False):
        """Update staff statistics"""
        if staff_id not in self.staff_locations:
            return
        
        staff = self.staff_locations[staff_id]
        
        if distance_m > 0:
            staff.total_distance_m += distance_m
        
        if completed:
            staff.tasks_completed += 1
        
        staff.last_seen = datetime.now().isoformat()
    
    def get_stats_summary(self) -> Dict:
        """Get summary statistics"""
        total = len(self.staff_locations)
        available = self.get_available_count()
        
        total_tasks = sum(s.tasks_completed for s in self.staff_locations.values())
        total_distance = sum(s.total_distance_m for s in self.staff_locations.values())
        
        return {
            "total_staff": total,
            "available": available,
            "busy": total - available,
            "total_tasks_completed": total_tasks,
            "total_distance_traveled_m": round(total_distance, 2)
        }
    
    # ========== NEAREST STAFF ==========
    
    def find_nearest_staff(
        self,
        location: str,
        role: Optional[str] = None,
        available_only: bool = True
    ) -> Optional[str]:
        """
        Find nearest staff member to a location
        
        Note: This is a simplified version that returns the first match.
        For production, integrate with routing service to calculate actual distances.
        """
        candidates = []
        
        for staff in self.staff_locations.values():
            # Filter by availability
            if available_only and not staff.is_available:
                continue
            
            # Filter by role
            if role and staff.role.lower() != role.lower():
                continue
            
            candidates.append(staff)
        
        if not candidates:
            return None
        
        # For now, just return first candidate
        # In production: call routing service to find actual nearest
        return candidates[0].id
    
    # ========== BULK OPERATIONS ==========
    
    def load_staff_from_db(self, staff_list: List[Dict]):
        """Load staff data from database on startup"""
        for staff_data in staff_list:
            staff = StaffInfo(**staff_data)
            self.staff_locations[staff.id] = staff
        
        print(f"✅ Loaded {len(staff_list)} staff members from database")
    
    def clear_all(self):
        """Clear all staff (use with caution)"""
        self.staff_locations.clear()
        print("🗑️  All staff cleared from coordinator")


# ========== GLOBAL INSTANCE ==========

# Global singleton instance for use across the service
staff_coordinator_instance: Optional[StaffCoordinator] = None


def get_staff_coordinator() -> StaffCoordinator:
    """Get or create global staff coordinator instance"""
    global staff_coordinator_instance
    
    if staff_coordinator_instance is None:
        staff_coordinator_instance = StaffCoordinator()
    
    return staff_coordinator_instance