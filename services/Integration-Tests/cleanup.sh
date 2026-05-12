#!/bin/bash
# Cleanup script for integration tests - stops and removes everything

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Stadium Integration Tests - Cleanup Script    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Docker Compose Down
echo -e "${YELLOW}[1/3]${NC} Stopping and removing Docker containers/volumes..."
if docker info > /dev/null 2>&1; then
    cd "$SCRIPT_DIR"
    docker-compose -f docker-compose.test.yml down -v
    echo -e "${GREEN}✓ Docker services stopped and volumes removed${NC}"
else
    echo -e "${RED}⚠ Docker is not running, skipping container cleanup${NC}"
fi

# Step 2: Remove Virtual Environment
echo ""
echo -e "${YELLOW}[2/3]${NC} Removing Python virtual environment..."
if [ -d "$SCRIPT_DIR/.venv" ]; then
    rm -rf "$SCRIPT_DIR/.venv"
    echo -e "${GREEN}✓ .venv directory removed${NC}"
else
    echo -e "  .venv directory not found, skipping"
fi

# Step 3: Remove Caches and Temporary Files
echo ""
echo -e "${YELLOW}[3/3]${NC} Removing cache files and temporary data..."

# Find and remove __pycache__ directories
find "$SCRIPT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
# Remove pytest cache
if [ -d "$SCRIPT_DIR/.pytest_cache" ]; then
    rm -rf "$SCRIPT_DIR/.pytest_cache"
fi

echo -e "${GREEN}✓ Cache and temporary files removed${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Cleanup Complete!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
