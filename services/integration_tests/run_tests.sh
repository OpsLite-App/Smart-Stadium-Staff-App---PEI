#!/bin/bash
# Quick start script for running integration tests

set -e

echo "=================================="
echo "Stadium Services Integration Tests"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Setup virtual environment in integration_tests folder
echo "Setting up Python virtual environment..."
if [ ! -d "$SCRIPT_DIR/.venv" ]; then
    echo -e "${YELLOW}Creating virtual environment at $SCRIPT_DIR/.venv${NC}"
    python3 -m venv "$SCRIPT_DIR/.venv"
fi

# Activate virtual environment
source "$SCRIPT_DIR/.venv/bin/activate"
echo -e "${GREEN}✓ Virtual environment activated${NC}"

# Check if Docker is running
echo ""
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if services are running
echo ""
echo "Checking services..."

services=("map" "routing" "emergency" "maintenance" "positioning" "queueing" "congestion" "chat")
ports=(8001 8002 8003 8004 8005 8006 8007 8008)

all_running=true
for i in "${!services[@]}"; do
    service="${services[$i]}"
    port="${ports[$i]}"
    
    if curl -s http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ${service}: http://localhost:$port${NC}"
    else
        echo -e "${RED}✗ ${service}: http://localhost:$port (not responding)${NC}"
        all_running=false
    fi
done

if [ "$all_running" = false ]; then
    echo ""
    echo -e "${YELLOW}Some services are not running. Start them with:${NC}"
    echo "  docker-compose up -d"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if pytest is installed
echo ""
echo "Checking dependencies..."
if ! python3 -c "import pytest" 2>/dev/null; then
    echo -e "${YELLOW}Installing test dependencies...${NC}"
    pip install -r requirements.txt
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"

# Run tests
echo ""
echo "=================================="
echo "Running Integration Tests"
echo "=================================="
echo ""

# Determine what to run
if [ "$1" = "" ]; then
    echo "Running all integration tests..."
    pytest "$SCRIPT_DIR" -v
elif [ "$1" = "workflow" ]; then
    echo "Running workflow tests..."
    pytest "$SCRIPT_DIR" -v -m workflow
elif [ "$1" = "service" ]; then
    echo "Running service-to-service tests..."
    pytest "$SCRIPT_DIR" -v -m service_call
elif [ "$1" = "emergency" ]; then
    echo "Running emergency service tests..."
    pytest "$SCRIPT_DIR/test_emergency_workflow.py" -v
elif [ "$1" = "maintenance" ]; then
    echo "Running maintenance service tests..."
    pytest "$SCRIPT_DIR/test_maintenance_workflow.py" -v
elif [ "$1" = "routing" ]; then
    echo "Running routing service tests..."
    pytest "$SCRIPT_DIR/test_routing_workflow.py" -v
elif [ "$1" = "queue" ]; then
    echo "Running queue and congestion tests..."
    pytest "$SCRIPT_DIR/test_queue_and_congestion.py" -v
elif [ "$1" = "map" ]; then
    echo "Running map service tests..."
    pytest "$SCRIPT_DIR/test_map_service.py" -v
elif [ "$1" = "positioning" ]; then
    echo "Running positioning service tests..."
    pytest "$SCRIPT_DIR/test_positioning_service.py" -v
elif [ "$1" = "e2e" ]; then
    echo "Running end-to-end pipeline tests..."
    pytest "$SCRIPT_DIR/test_e2e_pipeline.py" -v
elif [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [test_type]"
    echo ""
    echo "Test types:"
    echo "  (default)   - Run all integration tests"
    echo "  workflow    - Run end-to-end workflow tests"
    echo "  service     - Run service-to-service communication tests"
    echo "  emergency   - Run emergency service tests"
    echo "  maintenance - Run maintenance service tests"
    echo "  routing     - Run routing service tests"
    echo "  queue       - Run queue and congestion tests"
    echo "  map         - Run map service tests"
    echo "  positioning - Run positioning service tests"
    echo "  e2e         - Run end-to-end pipeline tests"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                # Run all tests"
    echo "  $0 workflow       # Run workflow tests"
    echo "  $0 emergency      # Run emergency service tests"
    exit 0
else
    echo -e "${RED}Unknown test type: $1${NC}"
    echo "Use '$0 help' for available options"
    exit 1
fi

echo ""
echo -e "${GREEN}=================================="
echo "Test Run Complete"
echo "==================================${NC}"
