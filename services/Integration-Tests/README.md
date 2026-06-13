# Integration Tests for Stadium Services

Comprehensive integration test suite for the stadium event management system, testing service interactions, workflows, and end-to-end scenarios.

## Overview

This test suite validates the critical workflows and service interactions in your stadium management system:

- **Emergency Response Workflow**: Incident creation → Route planning → Responder dispatch
- **Maintenance Task Workflow**: Task creation → Staff assignment → Route planning
- **Routing & GIS Integration**: PostGIS/pgRouting pathfinding with graph override awareness
- **Queue Management**: Real-time queue state tracking with wait time estimation
- **Congestion Monitoring**: Crowd density heatmap and zone tracking
- **Positioning Service**: WiFi-based staff localization
- **End-to-End Pipeline**: Complete workflows across multiple services

## Architecture

### Services Under Test

| Service | Purpose | Database | API Port |
|---------|---------|----------|----------|
| Emergency-Service | Incident management & responder dispatch | SQLite | 8003 |
| Maintenance-Service | Task management & staff coordination | SQLite | 8004 |
| Routing-Service | PostGIS/pgRouting indoor pathfinding | postgres_map | 8002 |
| Queueing-Service | Queue state & wait time estimation | In-memory | 8006 |
| Congestion-Service | Crowd density heatmap tracking | In-memory | 8007 |
| Positioning-Service | WiFi-based staff localization | SQLite | 8005 |
| Chat-Service | Message management | PostgreSQL | 8008 |

### Service Dependencies

```
Emergency-Service → Routing-Service → postgres_map
                 → Congestion-Service
                 
Maintenance-Service → Routing-Service → postgres_map
                    → Auth-Service
                    
Queueing-Service (independent, uses MQTT events)
Congestion-Service (independent, uses MQTT events)
Positioning-Service (independent, uses WiFi data)
Chat-Service (independent, uses MQTT events)
```

## Setup

### Prerequisites

- Docker & Docker Compose
- Python 3.9+

### 1. One-Command Setup (Recommended)

This script sets up everything: Docker services, virtual environment, and installs dependencies.

```bash
cd services/integration_tests

# Make scripts executable
chmod +x setup.sh
chmod +x run_tests.sh

# Run setup (starts Docker + creates venv + installs deps)
./setup.sh

# Tests are ready to run!
./run_tests.sh
```

The `setup.sh` script:
- ✅ Starts all Docker services via `docker-compose.test.yml`
- ✅ Creates a `.venv` folder in `integration_tests/`
- ✅ Installs Python dependencies in the venv
- ✅ Verifies services are healthy

### 2. Manual Setup (Full Control)

If you prefer manual control or the script doesn't work for your environment:

```bash
cd services/integration_tests

# Start Docker services
docker-compose -f docker-compose.test.yml up -d

# Create virtual environment in this folder
python3 -m venv .venv

# Activate it
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Verify services are running
curl http://localhost:8003/health  # Emergency Service
# etc.

# Run tests
./run_tests.sh
```

### 3. Standalone (Using run_tests.sh Only)

The `run_tests.sh` script automatically creates and activates a venv if needed:

```bash
cd services/integration_tests

# Start services manually first
docker-compose -f docker-compose.test.yml up -d

# run_tests.sh automatically sets up venv and runs tests
chmod +x run_tests.sh
./run_tests.sh
```

## Running Tests

### Quick Start

```bash
cd services/integration_tests

# Setup everything with one command
./setup.sh

# Tests automatically run with activated venv
./Activate venv first (or use ./run_tests.sh which does this automatically)
source .venv/bin/activate

# Workflow tests (complete end-to-end scenarios)
pytest integration_tests/ -v -m workflow
# OR: ./run_tests.sh workflow

# Service-to-service communication tests
pytest integration_tests/ -v -m service_call
# OR: ./run_tests.sh service
```bash
source .venv/bin/activate  # If not already activated
pytest integration_tests/ -v
# OR use the script
./run_tests.sh
```

### Run Specific Test Categories

```bash
# Workflow tests (complete end-to-end scenarios)
pytest integration_tests/ -v -m workflow

# Service-to-service communication tests
pytest integration_tests/ -v -m service_call

# MQTT event tests
pytest integration_tests/ -v -m mqtt

# Integration tests only (exclude unit tests)
pytest integration_tests/ -v -m integration
source .venv/bin/activate

# Emergency response workflow
pytest integration_tests/test_emergency_workflow.py -v
# OR: ./run_tests.sh emergency

# Maintenance workflow
pytest integration_tests/test_maintenance_workflow.py -v
# OR: ./run_tests.sh maintenance

# Routing integration
pytest integration_tests/test_routing_workflow.py -v
# OR: ./run_tests.sh routing

# Queue and congestion
pytest integration_tests/test_queue_and_congestion.py -v
# OR: ./run_tests.sh queue

# Map service
pytest integration_tests/test_map_service.py -v
# OR: ./run_tests.sh map

# Positioning service
pytest integration_tests/test_positioning_service.py -v
# OR: ./run_tests.sh positioning
source .venv/bin/activate

# End-to-end pipeline
pytest integration_tests/test_e2e_pipeline.py -v
# OR: ./run_tests.sh e2e
# Positioning service
pytest integration_tests/test_positioning_service.py -v

# End-to-end pipeline
pytest integration_tests/test_e2e_pipeline.py -v
```
source .venv/bin/activate

### Run with Coverage

```bash
pytest integration_tests/ --cov=integration_tests --cov-report=html
```

### Run with Detailed Output

```bash
pytest integration_tests/ -v -s
```

## Test Organization

### Test Files

- **`conftest.py`**: Shared fixtures (HTTP clients, MQTT, service URLs, test data)
- **`test_emergency_workflow.py`**: Emergency incident handling and responder dispatch
- **`test_maintenance_workflow.py`**: Maintenance task management and staff assignment
- **`test_routing_workflow.py`**: Pathfinding and route calculation
- **`test_queue_and_congestion.py`**: Queue state and crowd density monitoring
- **`test_positioning_service.py`**: WiFi-based staff localization
- **`test_map_service.py`**: legacy Map-Service tests kept as skipped historical reference
- **`test_e2e_pipeline.py`**: Complete end-to-end workflows and service chains

### Test Markers

Tests are organized with pytest markers:

```python
@pytest.mark.integration      # Standard integration tests
@pytest.mark.workflow         # End-to-end workflows
@pytest.mark.service_call     # Service-to-service communication
@pytest.mark.mqtt             # MQTT event tests
```

## Test Scenarios

### Emergency Response Workflow

1. **Incident Creation** - Report medical emergency at location
2. **Route Calculation** - Plan route to incident from responder base
3. **Dispatch** - Assign responders and track dispatch
4. **Concurrent Incidents** - Handle multiple simultaneous emergencies
5. **Congestion Awareness** - Route avoids high-density areas

### Maintenance Task Workflow

1. **Task Creation** - Create maintenance request
2. **Bin Alerts** - Convert sensor alerts to tasks
3. **Staff Assignment** - Assign staff members to tasks
4. **Task Updates** - Track progress and status changes
5. **Route Planning** - Calculate optimal routes to task locations

### Routing & Pathfinding

1. **Single Route** - A* pathfinding between two nodes
2. **Multi-Destination** - TSP-like multi-stop routing
3. **Nearest Node** - Find closest point to coordinates
4. **Graph Override Awareness** - Use node closures and cost impacts stored in PostGIS

### Queue & Congestion

1. **Queue Tracking** - Record observations and estimate wait times
2. **Heatmap** - Track crowd density across zones
3. **Dynamics** - Verify queueing theory models (M/M/1, M/M/k)
4. **Correlation** - Relate queue length to congestion

### Data Integrity

1. **Graph Consistency** - Nodes and edges maintain valid state
2. **Edge Validity** - Edges reference valid nodes
3. **Location Data** - POIs, seats, gates properly managed

## Fixture Reference

### HTTP Client
```python
async def http_client() -> AsyncClient:
    """HTTP client for service calls"""
```

### MQTT Client
```python
def mqtt_client() -> mqtt.Client:
    """MQTT client for event publishing"""
```

### Test Data Fixtures
```python
incident_data  # Sample emergency incident
maintenance_task_data  # Sample maintenance task
queue_event_data  # Sample queue observation
crowd_density_data  # Sample crowd density
map_service_data  # Legacy fixture name; returns real PostGIS/pgRouting node IDs
```

### Service URLs
```python
service_urls = {
    "routing": "http://localhost:8002",
    "emergency": "http://localhost:8003",
    "maintenance": "http://localhost:8004",
    "positioning": "http://localhost:8005",
    "queueing": "http://localhost:8006",
    "congestion": "http://localhost:8007",
    "chat": "http://localhost:8008",
}
```

## Troubleshooting

### Services Not Starting

1. **Check ports**: Ensure ports 8002-8008 are available
2. **Docker**: Verify Docker daemon is running
3. **Logs**: Check service logs: `docker logs <service_name>`

### Connection Errors

```
ConnectionError: Failed to connect to http://localhost:8002
```

**Solution**: Verify service is running and health endpoint responds:
```bash
curl http://localhost:8002/health
```

### Database Errors

Services use different databases:
- **PostgreSQL**: postgres_map, Chat-Service
- **SQLite**: Emergency-Service, Maintenance-Service, Positioning-Service
- **In-memory**: Queueing-Service, Congestion-Service

Verify database services are running:
```bash
docker ps | grep postgres
docker ps | grep mosquitto
```

### Timeout Errors

Increase timeout in fixtures:
```python
@pytest.fixture
async def http_client():
    async with httpx.AsyncClient(timeout=60) as client:
        yield client
```

### Test Skipped

Tests skip if services aren't available. Check service health:
```bash
pytest integration_tests/ -v -s  # See skip reasons
```

## Performance Considerations

### Concurrent Requests
- Tests handle up to 5 concurrent requests per scenario
- Adjust in test files as needed

### Test Execution Time
- Individual tests: 1-5 seconds
- Full suite: 5-10 minutes
- Run with `-x` flag to stop on first failure

### Resource Usage
- Total memory: ~500MB for all services
- CPU: Light load during tests
- Network: Localhost only (no external calls)

## Extending Tests

### Adding New Service Test

1. Create `test_new_service_workflow.py`
2. Import fixtures from `conftest.py`
3. Add test classes with `@pytest.mark.integration`
4. Define test methods for workflows and integrations

Example:
```python
@pytest.mark.integration
@pytest.mark.workflow
class TestNewServiceWorkflow:
    async def test_complete_workflow(
        self,
        http_client: httpx.AsyncClient,
        service_urls: Dict[str, str],
    ):
        # Your test here
        pass
```

### Adding New Fixture

Add to `conftest.py`:
```python
@pytest.fixture
def my_fixture():
    """Description of fixture"""
    return {"key": "value"}
```
Docker Compose for Testing

The test suite uses a dedicated Docker Compose file: `docker-compose.test.yml`

This file contains the active services needed for testing, isolated from your main development environment.

### Key Features

- **Isolated Network**: Uses `stadium-test-network` (doesn't interfere with other Docker projects)
- **Health Checks**: All services have health check endpoints
- **Volume Management**: Uses named volumes that can be easily cleaned up
- **Service Dependencies**: Services wait for dependencies to be healthy before starting
- **Configuration**: Uses environment variables for service-to-service communication

### Start Services

```bash
cd services/integration_tests

# Start all services
docker-compose -f docker-compose.test.yml up -d

# Watch logs
docker-compose -f docker-compose.test.yml logs -f

# Stop services
docker-compose -f docker-compose.test.yml down

# Clean up volumes (reset databases)
docker-compose -f docker-compose.test.yml down -v
```

### Service Configuration

All services are configured to communicate internally:

```yaml
Routing Service:   http://localhost:8002
Emergency Service: http://localhost:8003
Maintenance Srv:   http://localhost:8004
Positioning Srv:   http://localhost:8005
Queueing Service:  http://localhost:8006
Congestion Srv:    http://localhost:8007
Chat Service:      http://localhost:8008
MQTT Broker:       localhost:1883
PostgreSQL:        localhost:5432
PostGIS/pgRouting: localhost:5435
```

### Check Service Status

```bash
# All at once
for port in 8002 8003 8004 8005 8006 8007 8008; do
    echo "Port $port: $(curl -s http://localhost:$port/health && echo 'OK' || echo 'FAIL')"
done

# Individual service logs
docker logs routing-service-test
docker logs emergency-service-test
# etc.
```

### Virtual Environment Management

The virtual environment is stored locally in the `integration_tests` folder:

```
.venv/              # Local virtual environment for this project
├── bin/
│   ├── python
│   ├── pip
│   ├── pytest
│   └── ...
├── lib/
│   └── python3.9/site-packages/  # Dependencies installed here
└── pyvenv.cfg
```

### Activate/Deactivate

```bash
cd services/integration_tests

# Activate
source .venv/bin/activate

# See active venv
which python  # Should show path ending in integration_tests/.venv/bin/python

# Deactivate
deactivate
```

### Install Additional Packages

```bash
source .venv/bin/activate
pip install <package-name>
```

### Clean Up

```bash
# Remove venv
rm -rf .venv/

# Remove Docker containers and volumes
docker-compose -f docker-compose.test.yml down -v

# Remove all local test artifacts
rm -rf .pytest_cache/ htmlcov/ *.db *.sqlite
    services:
      postgres:
        image: postgres:13
      mosquitto:
        image: eclipse-mosquitto
    steps:
      - uses: actions/checkout@v2
      - name: Start services
        run: docker-compose up -d
      - name: Run tests
        run: pytest integration_tests/ -v
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Fixtures handle teardown automatically
3. **Assertions**: Use descriptive assertions for debugging
4. **Markers**: Tag tests appropriately for filtering
5. **Timeouts**: Set reasonable timeouts for async operations
6. **Mocking**: Mock external APIs not under test
7. **Data**: Use fixtures for consistent test data

## Contributing

When adding tests:

1. Follow existing naming conventions
2. Add descriptive docstrings
3. Use appropriate markers
4. Test both success and failure cases
5. Include integration points, not just unit tests
6. Document non-obvious test logic

## Support

For issues or questions:

1. Check test output for error messages
2. Review service logs: `docker logs <service>`
3. Verify service health: `curl http://localhost:<port>/health`
4. Check MQTT connectivity: `mosquitto_sub -t '#'`
5. Review test fixture implementation in `conftest.py`

## License

These tests are part of the Stadium Events project.
