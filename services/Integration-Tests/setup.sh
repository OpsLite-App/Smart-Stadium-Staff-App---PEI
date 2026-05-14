#!/bin/bash
# Setup script for integration tests - starts everything needed

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Stadium Integration Tests - Setup Script     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
SKIP_DOCKER=false
SKIP_VENV=false
START_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-venv)
            SKIP_VENV=true
            shift
            ;;
        --start-only)
            START_ONLY=true
            shift
            ;;
        --help)
            echo "Usage: setup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --skip-docker    Skip Docker Compose startup"
            echo "  --skip-venv      Skip virtual environment setup"
            echo "  --start-only     Only start services, don't verify"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Step 1: Docker Compose
if [ "$SKIP_DOCKER" = false ]; then
    echo -e "${YELLOW}[1/3]${NC} Starting Docker services..."
    echo ""
    
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}"
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
    
    # Start services
    docker compose -f docker-compose.test.yml up -d
    
    if [ "$START_ONLY" = false ]; then
        echo ""
        echo -e "${YELLOW}Waiting for services to be ready...${NC}"
        
        # Wait for services to be healthy
        services=("map-service" "routing-service" "emergency-service" "maintenance-service" "positioning-service" "queueing-service" "congestion-service" "chat-service")
        ports=(8001 8002 8003 8004 8005 8006 8007 8008)
        
        max_attempts=30
        attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            all_healthy=true
            for i in "${!services[@]}"; do
                service="${services[$i]}"
                port="${ports[$i]}"
                
                if ! curl -s http://localhost:$port/health > /dev/null 2>&1; then
                    all_healthy=false
                    break
                fi
            done
            
            if [ "$all_healthy" = true ]; then
                break
            fi
            
            attempt=$((attempt + 1))
            echo "  Attempt $attempt/$max_attempts..."
            sleep 2
        done
        
        echo ""
        echo -e "${YELLOW}Service Status:${NC}"
        for i in "${!services[@]}"; do
            service="${services[$i]}"
            port="${ports[$i]}"
            
            if curl -s http://localhost:$port/health > /dev/null 2>&1; then
                echo -e "  ${GREEN}✓${NC} ${service} (port $port)"
            else
                echo -e "  ${RED}✗${NC} ${service} (port $port)"
            fi
        done
    fi
    
    echo -e "${GREEN}✓ Docker services started${NC}"
else
    echo -e "${YELLOW}[1/3]${NC} Docker startup ${YELLOW}skipped${NC}"
fi

# Step 2: Virtual Environment
if [ "$SKIP_VENV" = false ]; then
    echo ""
    echo -e "${YELLOW}[2/3]${NC} Setting up Python virtual environment..."
    
    cd "$SCRIPT_DIR"
    
    if [ ! -d ".venv" ]; then
        echo "  Creating .venv..."
        python3 -m venv .venv
    fi
    
    source .venv/bin/activate
    echo "  Installing dependencies..."
    pip install -q -r requirements.txt
    
    echo -e "${GREEN}✓ Virtual environment ready${NC}"
else
    echo -e "${YELLOW}[2/3]${NC} Virtual environment setup ${YELLOW}skipped${NC}"
fi

# Step 3: Ready to test
echo ""
echo -e "${YELLOW}[3/3]${NC} Setup complete!"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Ready to Run Tests!                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$SKIP_VENV" = false ]; then
    echo -e "Virtual environment is ${GREEN}activated${NC}"
    echo ""
    echo "Run tests with:"
    echo "  ./run_tests.sh              # All tests"
    echo "  ./run_tests.sh workflow     # Workflow tests"
    echo "  ./run_tests.sh emergency    # Emergency tests"
    echo "  ./run_tests.sh e2e          # End-to-end tests"
    echo ""
else
    echo "To activate virtual environment:"
    echo "  source .venv/bin/activate"
    echo ""
    echo "Then run tests with:"
    echo "  ./run_tests.sh"
fi

echo ""
echo "To stop and clean up everything:"
echo "  ./cleanup.sh"
echo ""
