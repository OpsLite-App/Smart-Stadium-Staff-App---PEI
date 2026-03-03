import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from task_manager import TaskManager
from staff_coordinator import StaffCoordinator, StaffInfo
from models import Base, TaskPriority, TaskType, TaskStatus, MaintenanceTask
from schemas import TaskCreate, BinAlertCreate

# SQLite In-Memory Database Configuration
@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture
def coordinator():
    c = StaffCoordinator()
    c.clear_all()
    return c

@pytest.fixture
def task_manager():
    # We use fake URLs for external services
    return TaskManager(
        routing_service_url="http://test-routing",
        map_service_url="http://test-map"
    )

# --- StaffCoordinator Tests ---

def test_register_and_get_staff(coordinator):
    coordinator.register_staff("S1", "João", "cleaning", "node_01")
    staff = coordinator.get_staff("S1")
    
    # Support both object (staff.name) and dictionary (staff['name']) formats
    if isinstance(staff, dict):
        assert staff['name'] == "João"
    else:
        assert staff.name == "João"

def test_find_nearest_staff_filtering(coordinator):
    coordinator.register_staff("S1", "Ocupado", "cleaning", "node_01")
    coordinator.set_availability("S1", False)
    coordinator.register_staff("S2", "Disponível", "cleaning", "node_02")
    
    # The correct method in your code is find_nearest_staff
    result = coordinator.find_nearest_staff("node_05", available_only=True)
    assert result == "S2"

# --- TaskManager Logic Tests (No Mocks, using real in-memory DB) ---

def test_priority_logic_for_bins(db_session, task_manager):
    """Tests if the bin priority logic works in the database"""
    alert = BinAlertCreate(
        bin_id="bin_01",
        location_node="node_x",
        fill_percentage=96,  # > 95 must be CRITICAL
        capacity_liters=50.0
    )
    
    response = task_manager.create_bin_task(db_session, alert)
    
    # Validate the API response
    assert response.priority == "critical"
    
    # Validate that the database record is correct (using model Enums)
    db_task = db_session.query(MaintenanceTask).filter_by(id=response.id).first()
    assert db_task.priority == TaskPriority.CRITICAL
    assert "96%" in db_task.description

def test_task_lifecycle_creation(db_session, task_manager):
    """Tests the creation of a manual task and its initial state"""
    task_data = TaskCreate(
        task_type="spill_cleanup",
        location_node="sector_a_12",
        priority="high",
        description="Derrame de líquido"
    )
    
    response = task_manager.create_task(db_session, task_data)
    
    assert response.status == "pending"
    assert response.task_type == "spill_cleanup"
    
    # Check if the ID was generated correctly with the 'task-' prefix
    assert response.id.startswith("task-")