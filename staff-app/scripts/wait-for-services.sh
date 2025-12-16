#!/bin/bash
echo "⏳ Waiting for all services to be ready..."

wait_for_port() {
    host=$1
    port=$2
    timeout=$3
    
    echo -n "Waiting for $host:$port..."
    
    for i in $(seq 1 $timeout); do
        if nc -z $host $port 2>/dev/null; then
            echo " ✅"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo " ❌ TIMEOUT"
    return 1
}

# Wait for critical services
wait_for_port "localhost" 5432 30  # PostgreSQL
wait_for_port "localhost" 6379 10  # Redis
wait_for_port "localhost" 9092 30  # Kafka

echo "🎉 All services are ready!"