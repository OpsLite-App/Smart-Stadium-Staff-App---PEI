"""
CONGESTION SERVICE - VERSÃO FINAL OTIMIZADA
Inclui cache de geometria para garantir coordenadas no Heatmap e listener MQTT resiliente.
"""

import requests
import logging
import os
import asyncio
import json
import threading
import time
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

# Configuração de Logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CongestionService")

# Verificar biblioteca MQTT
try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    logger.warning("⚠️ Biblioteca paho-mqtt não encontrada. Instale com: pip install paho-mqtt")

app = FastAPI(
    title="Congestion Service",
    description="Real-time crowd density monitoring and heatmap generation",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CONFIGURATION ==========

# Variáveis de Ambiente (com defaults para Docker)
MQTT_BROKER = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MAP_SERVICE_URL = os.getenv("MAP_SERVICE_URL", "http://map-service:8000")

# Tópicos MQTT a subscrever
MQTT_TOPICS = [
    "stadium/crowd/gate-updates",
    "stadium/crowd/#",
    "stadium/crowd/density-updates"
]

MAX_HISTORY = 100  # Manter últimos 100 registos por área

# ========== STATE ==========

# Dados principais: { "Gate-1": { ...dados..., "location": {x, y} } }
crowd_data: Dict[str, Dict] = {}

# Histórico para gráficos
historical_data: Dict[str, List] = defaultdict(list)

# 🔥 CACHE DE NÓS: Guarda a geometria estática (Gate-1 -> {x: 41.1, y: -8.5})
# Isto resolve o problema de sensores que não enviam GPS
node_cache: Dict[str, Dict] = {} 

# ========== MODELS ==========

class CrowdDensity(BaseModel):
    area_id: str
    area_type: str  # seating, corridor, service, gate
    current_count: int
    capacity: int
    occupancy_rate: float
    heat_level: str  # green, yellow, red
    status: str      # empty, normal, busy, crowded, critical
    last_update: str

class HeatmapResponse(BaseModel):
    timestamp: str
    total_areas: int
    areas: List[CrowdDensity]
    summary: Dict[str, int]

# ========== HELPER: MAP SERVICE SYNC ==========

def update_node_cache():
    """
    Vai buscar a geometria ao Map Service no arranque.
    Permite desenhar o heatmap mesmo que o MQTT só traga o ID da zona.
    """
    try:
        logger.info(f"🗺️ A sincronizar geometria com Map Service: {MAP_SERVICE_URL}/api/map")
        response = requests.get(f"{MAP_SERVICE_URL}/api/map", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            nodes = data.get("nodes", [])
            count = 0
            for n in nodes:
                # Mapeia ID -> Coordenadas
                node_cache[n["id"]] = {"x": n["x"], "y": n["y"]}
                count += 1
            logger.info(f"✅ Cache de geometria atualizada: {count} nós mapeados")
        else:
            logger.error(f"❌ Erro Map Service: {response.status_code}")
            
    except Exception as e:
        logger.error(f"⚠️ Não foi possível contactar Map Service: {e}")

# ========== MQTT LISTENER ==========

def on_mqtt_message(client, userdata, msg):
    """Processa eventos de densidade vindos dos sensores/simulador"""
    try:
        payload = msg.payload.decode()
        event = json.loads(payload)
        event_type = event.get("event_type")
        
        if event_type == "crowd_density":
            area_id = event.get("area_id")
            
            # 1. Tentar obter localização do evento
            location = event.get("location", {})
            x = location.get("x")
            y = location.get("y")
            
            # 2. 🔥 FALLBACK: Se não vier no evento, usar a Cache!
            if (x is None or y is None) and area_id in node_cache:
                x = node_cache[area_id]["x"]
                y = node_cache[area_id]["y"]
            
            occupancy_rate = float(event.get("occupancy_rate", 0))
            
            # Determinar estado
            if occupancy_rate < 50: status = "normal"
            elif occupancy_rate < 80: status = "busy"
            else: status = "critical"
            
            # Atualizar estado global
            crowd_data[area_id] = {
                "area_id": area_id,
                "area_type": event.get("area_type", "normal"),
                "current_count": event.get("current_count", 0),
                "capacity": event.get("capacity", 100),
                "occupancy_rate": round(occupancy_rate, 2),
                "heat_level": event.get("heat_level", "green"),
                "status": status,
                "last_update": datetime.now().isoformat(),
                "location": {"x": x, "y": y} # Pode ser None se desconhecido
            }
            
            # Atualizar histórico
            historical_data[area_id].append({
                "timestamp": datetime.now().isoformat(),
                "occupancy_rate": occupancy_rate
            })
            # Manter tamanho fixo
            if len(historical_data[area_id]) > MAX_HISTORY:
                historical_data[area_id] = historical_data[area_id][-MAX_HISTORY:]
                
            # Log ocasional para debug
            # logger.info(f"📍 Atualizado {area_id}: {occupancy_rate}%")
            
    except Exception as e:
        logger.error(f"❌ Erro a processar mensagem MQTT: {e}")

def start_mqtt_listener():
    """Inicia a thread do cliente MQTT"""
    if not MQTT_AVAILABLE:
        logger.warning("🚫 MQTT não disponível, serviço a correr em modo API-only")
        return
    
    def mqtt_thread():
        client = mqtt.Client() # Protocolo auto-negociado
        client.on_message = on_mqtt_message
        
        while True:
            try:
                logger.info(f"📡 A ligar ao MQTT Broker em {MQTT_BROKER}:{MQTT_PORT}...")
                client.connect(MQTT_BROKER, MQTT_PORT, 60)
                
                for topic in MQTT_TOPICS:
                    client.subscribe(topic)
                    
                logger.info("✅ Conectado ao MQTT!")
                client.loop_forever()
                
            except Exception as e:
                logger.warning(f"⚠️ Falha na conexão MQTT ({e}). Nova tentativa em 5s...")
                time.sleep(5)

    thread = threading.Thread(target=mqtt_thread, daemon=True)
    thread.start()

# ========== BACKGROUND TASKS ==========

async def cleanup_stale_data():
    """Remove dados com mais de 10 minutos sem updates"""
    while True:
        try:
            now = datetime.now()
            threshold = timedelta(minutes=10)
            to_remove = []
            
            for area_id, data in crowd_data.items():
                last_update = datetime.fromisoformat(data["last_update"])
                if now - last_update > threshold:
                    to_remove.append(area_id)
            
            for area_id in to_remove:
                del crowd_data[area_id]
                
        except Exception as e:
            logger.error(f"Erro no cleanup: {e}")
            
        await asyncio.sleep(60)

# ========== LIFECYCLE ==========

@app.on_event("startup")
async def startup():
    logger.info("🚀 Congestion Service a iniciar...")
    
    # 1. Iniciar MQTT Listener
    start_mqtt_listener()
    
    # 2. Preencher Cache de Nós (Fundamental para o Heatmap)
    update_node_cache()
    
    # 3. Tarefa de Limpeza
    asyncio.create_task(cleanup_stale_data())

# ========== ENDPOINTS ==========

@app.get("/health")
def health():
    return {
        "status": "active",
        "mqtt_connected": MQTT_AVAILABLE,
        "tracked_areas": len(crowd_data),
        "nodes_cached": len(node_cache)
    }

@app.get("/api/heatmap/points")
def get_heatmap_points():
    """
    ENDPOINT CRÍTICO: Usado pelo Frontend para desenhar o Heatmap.
    Retorna apenas pontos com coordenadas válidas.
    """
    points = []
    
    # Se a cache estiver vazia (Map Service estava offline no boot), tenta de novo agora
    if not node_cache:
        update_node_cache()

    for area_id, data in crowd_data.items():
        loc = data.get("location", {})
        x = loc.get("x")
        y = loc.get("y")
        
        # Fallback para cache se não tivermos coords no evento
        if (x is None or y is None) and area_id in node_cache:
            x = node_cache[area_id]["x"]
            y = node_cache[area_id]["y"]

        if x is not None and y is not None:
            occupancy = data.get('occupancy_rate', 0)
            
            # Converter percentagem (0-100) em peso (0.0-1.0)
            weight = occupancy / 100.0
            
            # Boost visual: áreas críticas ficam mais fortes
            if occupancy > 80: weight = 1.0
            
            points.append({
                "latitude": x,
                "longitude": y,
                "weight": weight,
                "occupancy_rate": occupancy,
                "area_id": area_id,
                "heat_level": data.get("heat_level", "green")
            })
    
    return {
        "timestamp": datetime.now().isoformat(),
        "points": points,
        "count": len(points)
    }

@app.get("/api/congestion/summary")
def get_summary():
    return {
        "total_areas": len(crowd_data),
        "areas": list(crowd_data.values())
    }

# Para testes manuais
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)