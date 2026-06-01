import pytest
from task_manager import TaskManager
from staff_coordinator import get_staff_coordinator
from schemas import TaskCreate, TaskUpdate

def test_full_assignment_flow(db_session):
    # Setup - Use fake URLs from environment
    tm = TaskManager("http://fake-routing", "http://fake-map")
    sc = get_staff_coordinator()
    sc.clear_all()
    sc.register_staff("S1", "Diogo", "cleaning", "gate_A")
    
    # Create task
    task_data = TaskCreate(
        task_type="spill_cleanup",
        location_node="gate_A",
        priority="high"
    )
    task_res = tm.create_task(db_session, task_data)
    
    # Trying to assign (Simulating what your endpoint would do)
    # Finding the nearest employee
    staff_id = sc.find_nearest_staff(task_res.location_node, available_only=True)
    assert staff_id == "S1"
    
    # Update task to ASSIGNED and mark staff as busy
    update = TaskUpdate(status="assigned", assigned_to=staff_id)
    updated_task = tm.update_task(db_session, task_res.id, update)
    sc.set_availability(staff_id, False)
    
    # Verifications
    assert updated_task.status == "assigned"
    assert updated_task.assigned_to == "S1"
    
    # If get_staff returns a dictionary, we use square brackets
    staff_data = sc.get_staff("S1")
    assert staff_data["is_available"] is False