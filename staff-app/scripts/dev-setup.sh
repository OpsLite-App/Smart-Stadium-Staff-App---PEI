#!/bin/bash
echo "⚡ Setting up Stadium App Development Environment..."

# Create .env file with configuration
cat > .env << EOF
POSTGRES_PASSWORD=password
KAFKA_BROKER=kafka:9092
JWT_SECRET=development-secret-please-change
EOF

echo "📦 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Run health check
./scripts/health-check.sh

echo "✅ Development environment ready!"
echo "📊 Services:"
echo "   - PostgreSQL: localhost:5432"
echo "   - Kafka: localhost:9092"
echo "   - Redis: localhost:6379"
echo "   - Auth API: http://localhost:8080"
echo "   - WebSocket: ws://localhost:8081"
echo "   - Algorithms: http://localhost:5000"
echo "   - Simulator: http://localhost:5001"