# 🏟️ Stadium Management System - Infrastructure Setup

## 📌 Overview
Complete Docker-based development environment for the Stadium Management System project. This setup provides all necessary infrastructure services (PostgreSQL, Redis, Kafka) and placeholder containers for application services.

## 🏗️ Architecture

```
stadium-app/
├── docker-compose.yml          # Main orchestration file
├── backend/                    # Java Spring Boot services (Guilherme)
│   ├── auth-service/           # Authentication service
│   └── websocket-gateway/      # WebSocket server
├── algorithms-service/         # Python algorithms (Solomila)
├── data-simulator/             # Synthetic data generator (Solomila)
├── scripts/                    # Automation and utility scripts
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

### Installation
1. Clone the repository
2. Run the setup script:
```bash
./scripts/dev-setup.sh
```

3. Verify the setup:
```bash
./scripts/health-check.sh
```

## 📡 Available Services

| Service | Purpose | Port | Status |
|---------|---------|------|--------|
| PostgreSQL | Main database | 5432 | ✅ Ready |
| Redis | Cache and sessions | 6379 | ✅ Ready |
| Kafka | Message broker | 9092 | ✅ Ready |
| NGINX | API Gateway | 80 | ⚠️ Pending |
| Auth Service | Authentication API | 8080 | 📝 Placeholder |
| WebSocket Gateway | Real-time updates | 8081 | 📝 Placeholder |
| Algorithms Service | Routing algorithms | 5000 | 📝 Placeholder |
| Data Simulator | Synthetic data | 5001 | 📝 Placeholder |

## 🔧 Docker Configuration

### Container Details
- **PostgreSQL 15**: Database for users, incidents, and map data
- **Redis 7**: Session storage and route caching
- **Kafka 3.4**: Event streaming for real-time updates
- **Placeholder containers**: Ready for team implementation

### Network Configuration
- All services communicate via internal Docker network
- Service discovery using container names (e.g., `postgres:5432`)

## 📝 Placeholder Services

The following services are implemented as placeholders and await team implementation:

1. **Auth Service** (`backend/auth-service/`)
   - Spring Boot application
   - Dockerfile ready for Java 17
   - Will implement: JWT authentication, user management

2. **WebSocket Gateway** (`backend/websocket-gateway/`)
   - Node.js + NestJS application
   - Dockerfile ready for Node 18
   - Will implement: Real-time event broadcasting

3. **Algorithms Service** (`algorithms-service/`)
   - Python Flask/FastAPI application
   - Dockerfile ready for Python 3.9
   - Will implement: A* routing, emergency response algorithms

4. **Data Simulator** (`data-simulator/`)
   - Python application
   - Dockerfile ready for Python 3.9
   - Will implement: Synthetic crowd data generation

## 🛠️ Utility Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `dev-setup.sh` | Complete environment setup | `./scripts/dev-setup.sh` |
| `health-check.sh` | Verify all services are running | `./scripts/health-check.sh` |
| `wait-for-services.sh` | Wait for services to be ready | `./scripts/wait-for-services.sh` |
| `test-kafka.sh` | Test Kafka connectivity | `./scripts/test-kafka.sh` |

## 🎯 For Developers

### Backend Team (Guilherme)
```bash
# Start working on auth service
cd backend/auth-service
# Replace the placeholder with actual Spring Boot code
```

### Algorithms Team (Solomila)
```bash
# Start working on algorithms service
cd algorithms-service
# Replace placeholder with Python Flask/FastAPI code
```

### Frontend Team (Rodrigo)
```bash
# API endpoints will be available at:
# - Authentication: http://localhost:8080/auth/
# - WebSocket: ws://localhost:8081/ws/
# - Algorithms: http://localhost:5000/algorithms/
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :8080
   # Kill process or change port in docker-compose.yml
   ```

2. **Kafka not starting**
   ```bash
   # Check Kafka logs
   docker-compose logs kafka
   # Ensure enough memory is allocated to Docker
   ```

3. **Services can't communicate**
   ```bash
   # Check internal network
   docker network ls
   docker network inspect stadium-app_default
   ```

### Reset Environment
```bash
# Complete reset
docker-compose down -v
./scripts/dev-setup.sh
```


## 👥 Team Responsibilities

| Team Member | Role | Services |
|-------------|------|----------|
| **Diogo** | DevOps/QA | Docker, CI/CD, Monitoring |
| **Guilherme** | Backend Lead | Auth Service, WebSocket Gateway |
| **Solomila** | Algorithms Lead | Algorithms Service, Data Simulator |
| **Rodrigo** | Mobile/UI Lead | Mobile Application |

---

**Last Updated**: 2025-12-09 <br>
**Status**: ✅ Infrastructure Ready - Awaiting Application Implementation
