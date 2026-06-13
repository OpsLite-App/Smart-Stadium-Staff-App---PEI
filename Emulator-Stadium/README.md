# Emulator-Stadium

Emulador operacional para o estado atual do OpsLite.

Este componente gera eventos realistas por MQTT para alimentar o fluxo ativo:

```text
Emulator-Stadium -> Mosquitto -> event_processor/services -> frontend-web
                         |
                         +-> routing-service/PostGIS/pgRouting
```

O emulador deixou de depender do `Map-Service`. Quando o `routing-service` está disponível, carrega nós e POIs reais por:

- `GET /api/gis/nodes`
- `GET /api/pois`

Se estiver a correr isolado, usa um cenário local com nós numéricos compatíveis com o projeto atual, incluindo a saída segura `65` e zonas como `62`, `66` e `70`.

## Eventos gerados

- `stadium/crowd/gate-updates`: passagens em portas e updates de filas.
- `stadium/crowd/density-updates`: densidade por zona/nó, com coordenadas e piso.
- `stadium/maintenance/bin-alerts`: alertas de limpeza com `poi_node` numérico.
- `stadium/emergency/sos-events`: incidentes SOS para medical/security.
- `stadium/emergency/evacuation-updates`: bloqueios operacionais publicados para o `event-processor`, que atualiza o routing-service via `/api/graph/node-closures`.

## Como correr localmente

```bash
cd Emulator-Stadium
./run.sh
```

Para uma simulação curta:

```bash
./run.sh 120
```

No Windows:

```bat
run_simulation.bat 120
```

## Variáveis úteis

- `ROUTING_SERVICE_URL`: por omissão `http://localhost:8002`.
- `MQTT_BROKER` ou `MQTT_HOST`: por omissão `localhost`.
- `MQTT_PORT`: por omissão `1883`.
- `SIM_DURATION_SECONDS`: duração quando não passas argumento.
- `SIM_TICK_SECONDS`: intervalo do loop, por omissão `1`.
- `SIM_SCENARIO`: por omissão `matchday`.
- `SIM_OUTPUT_FILE`: ficheiro JSON de saída.
- `EMULATOR_USE_MODELS=true`: tenta usar os contadores CNN/ZIP opcionais se existirem.

## Docker Compose

No container, o `wait-for-all-services.sh` espera apenas pelos serviços necessários ao fluxo atual: Mosquitto, routing, queueing, congestion, emergency e maintenance.

`event-processor` e `ws-gateway` podem ser esperados também com:

```bash
WAIT_FOR_OPTIONAL_SERVICES=true
```
