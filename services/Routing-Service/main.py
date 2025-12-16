"""
ROUTING SERVICE - VERSÃO FINAL OTIMIZADA
Calcula rotas (A*) e atualiza penalizações de perigo em tempo real via MQTT.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict
import httpx
import asyncio
import os
import json
import logging
import threading
import time

# Imports locais (certifica-te que tens astar.py e api_handlers.py na mesma pasta)
from astar import Graph, HazardMap, HazardType
from api_handlers import RouteAPIHandler, HazardAPIHandler, RouteRequest, NearestRequest

# Configuração de Logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RoutingService")

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False
    logger.warning("⚠️ Biblioteca paho-mqtt não encontrada")

app = FastAPI(
    title="Stadium Routing Service",
    description="Hazard-aware pathfinding with A* algorithm",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CONFIGURATION ==========

MAP_SERVICE_URL = os.getenv("MAP_SERVICE_URL", "http://map-service:8000")
MQTT_BROKER = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

# Tópicos que afetam a navegação
MQTT_TOPICS = [
    "stadium/crowd/density-updates", # Updates de congestão
    "stadium/hazards/#",             # Novos perigos (fumo, fogo)
    "stadium/emergency/#"            # Emergências globais
]

# ========== GLOBAL STATE ==========

GRAPH: Optional[Graph] = None
HAZARD_MAP: Optional[HazardMap] = None
route_handler: Optional[RouteAPIHandler] = None
hazard_handler: Optional[HazardAPIHandler] = None

# ========== MQTT LOGIC ==========

def on_mqtt_message(client, userdata, msg):
    """
    Recebe updates em tempo real e atualiza o HAZARD_MAP.
    Isto permite que o próximo pedido de rota 'avoid_crowds' desvie da zona.
    """
    global HAZARD_MAP
    
    if not HAZARD_MAP:
        return

    try:
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        
        # 1. Atualização de Multidão (Vinda do Congestion Service)
        if "crowd" in topic or payload.get("event_type") == "crowd_density":
            node_id = payload.get("area_id")
            occupancy = payload.get("occupancy_rate", 0)
            
            if node_id:
                # Atualiza a penalidade no mapa de navegação (ex: +20m de custo)
                HAZARD_MAP.set_crowd_penalty(node_id, float(occupancy))
                # logger.debug(f"Penalidade de multidão atualizada para {node_id}: {occupancy}%")

        # 2. Atualização de Perigos (Fogo, Fumo, etc)
        elif "hazards" in topic:
            node_id = payload.get("node_id")
            hazard_str = payload.get("hazard_type", "").upper()
            severity = float(payload.get("severity", 1.0))
            
            if node_id and hasattr(HazardType, hazard_str):
                hazard_type = HazardType[hazard_str]
                HAZARD_MAP.set_node_hazard(node_id, hazard_type, severity)
                logger.warning(f"⚠️ PERIGO REGISTADO: {hazard_str} em {node_id}")

    except Exception as e:
        logger.error(f"Erro processando MQTT: {e}")

def start_mqtt_listener():
    if not MQTT_AVAILABLE: return
    
    def mqtt_thread():
        client = mqtt.Client()
        client.on_message = on_mqtt_message
        
        while True:
            try:
                logger.info(f"📡 Routing Service a ligar ao MQTT: {MQTT_BROKER}...")
                client.connect(MQTT_BROKER, MQTT_PORT, 60)
                
                for topic in MQTT_TOPICS:
                    client.subscribe(topic)
                
                logger.info("✅ Routing Service ligado ao MQTT")
                client.loop_forever()
            except Exception as e:
                logger.warning(f"⚠️ Falha MQTT Routing ({e}). Retry em 5s...")
                time.sleep(5)

    thread = threading.Thread(target=mqtt_thread, daemon=True)
    thread.start()

# ========== INITIALIZATION ==========

async def load_graph_from_map_service():
    """Carrega a topologia (nós e arestas) do Map Service"""
    global GRAPH
    try:
        logger.info(f"🗺️ A carregar grafo de {MAP_SERVICE_URL}...")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{MAP_SERVICE_URL}/api/map")
            data = response.json()
            
            nodes = data.get('nodes', [])
            edges = data.get('edges', [])
            
            GRAPH = Graph(nodes, edges)
            logger.info(f"✅ Grafo carregado com sucesso: {len(nodes)} nós, {len(edges)} arestas")
            return True
    except Exception as e:
        logger.error(f"❌ Erro fatal ao carregar grafo: {e}")
        return False

@app.on_event("startup")
async def startup():
    global HAZARD_MAP, route_handler, hazard_handler
    
    logger.info("🚀 ROUTING SERVICE v2.1 - STARTING")
    
    # 1. Inicializar mapa de perigos (vazio)
    HAZARD_MAP = HazardMap()
    
    # 2. Iniciar escuta de perigos via MQTT
    start_mqtt_listener()
    
    # 3. Carregar o grafo estático
    success = await load_graph_from_map_service()
    
    if success and GRAPH:
        route_handler = RouteAPIHandler(GRAPH, HAZARD_MAP)
        hazard_handler = HazardAPIHandler(HAZARD_MAP)
    else:
        logger.error("⚠️ Serviço iniciado em modo degradado (sem grafo)")

# ========== ENDPOINTS ==========

@app.get("/health")
def health():
    return {
        "status": "healthy" if GRAPH else "degraded",
        "nodes_loaded": len(GRAPH.nodes) if GRAPH else 0,
        "active_hazards": len(HAZARD_MAP.node_hazards) if HAZARD_MAP else 0,
        "crowd_penalties": len(HAZARD_MAP.crowd_penalties) if HAZARD_MAP else 0
    }

@app.post("/api/route")
async def get_route(request: RouteRequest):
    """
    Calcula rota mais curta (A*).
    Se request.avoid_crowds=True, considera os perigos recebidos via MQTT.
    """
    if not GRAPH:
        # Tenta recuperar se falhou no arranque
        await load_graph_from_map_service()
        if not GRAPH: raise HTTPException(503, "Graph unavailable")
    
    return route_handler.get_route(request)

@app.post("/api/route/nearest")
async def find_nearest(request: NearestRequest):
    """Encontra o segurança/staff mais próximo de um incidente"""
    if not GRAPH: await load_graph_from_map_service()
    return route_handler.find_nearest_node_handler(request)

@app.get("/api/route/evacuation")
async def evacuation_route(from_node: str = Query(...)):
    """Calcula rota de fuga para a saída segura mais próxima"""
    if not GRAPH: await load_graph_from_map_service()
    
    # Lista de saídas conhecidas (idealmente viria do Map Service)
    exit_nodes = ['Gate-1', 'Gate-2', 'Gate-3', 'Gate-4', 'Gate-5', 'Saida-Norte']
    valid_exits = [e for e in exit_nodes if e in GRAPH.nodes]
    
    if not valid_exits:
        raise HTTPException(500, "No exit nodes defined in graph")

    return route_handler.get_evacuation_route(from_node, valid_exits)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)