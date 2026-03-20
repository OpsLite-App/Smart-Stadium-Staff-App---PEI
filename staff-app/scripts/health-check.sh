#!/bin/bash
echo "🏥 Running health checks..."

check_service() {
    service=$1
    port=$2
    
    if nc -z localhost $port 2>/dev/null; then
        echo "✅ $service (port $port) is UP"
        return 0
    else
        echo "❌ $service (port $port) is DOWN"
        return 1
    fi
}

echo "📡 Checking network services..."
check_service "PostgreSQL" 5432
check_service "Redis" 6379
check_service "Kafka" 9092

echo "🔌 Checking application services..."
check_service "Auth Service" 8080
check_service "WebSocket" 8081
check_service "Algorithms" 5000
check_service "Simulator" 5001

echo "📊 Docker containers status:"
docker-compose ps