# Queueing Service

### 1. Setup Python Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start the server
```bash
python service.py
```

### 3. Testing
curl http://localhost:8003/ | jq