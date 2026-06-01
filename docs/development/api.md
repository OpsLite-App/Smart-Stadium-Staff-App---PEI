## Auth Service (Spring Boot — porta 8081)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /auth/login | Login |
| POST | /auth/validate | Validar token |
| GET | /auth/me | Dados do utilizador atual |
| GET | /auth/staff | Listar staff |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Legacy Map Service (porta 8001, profile `legacy`)

`services/Map-Service` is not part of the active architecture. It is kept for
legacy compatibility/tests and only starts with:

```bash
docker compose -f docker-compose.dev.yml --profile legacy up -d map-service
```

Normal development should use `routing-service` and `postgres_map` instead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Routing Service (porta 8002)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/route/pgrouting | Calcular rota com pgRouting usando IDs numéricos |
| GET | /api/route/pgrouting/geojson | Calcular rota e devolver GeoJSON |
| GET | /api/route/pgrouting/combined | Rota no grafo combinado indoor/outdoor |
| GET | /api/route/pgrouting/by-poi | Rota entre POIs |
| GET | /api/route/pgrouting/by-poi/geojson | Rota GeoJSON entre POIs |
| GET | /api/route/evacuation/geojson | Rota de evacuação em GeoJSON |
| GET | /api/pois | POIs indoor vindos do PostGIS |
| GET | /api/gis/rooms | Polígonos de salas |
| GET | /api/gis/corridors | Polígonos de corredores |
| GET | /api/gis/nodes | Nós do grafo indoor |
| GET | /api/gis/cameras | Infraestrutura de câmaras |
| GET | /api/gis/camera-coverage | Cobertura de câmaras |
| GET | /api/gis/camera-status | Estado operacional das câmaras |
| PUT | /api/gis/camera-status/{camera_id} | Atualizar estado de câmara, apenas Supervisor |
| GET | /api/gis/impacted-edges | Edges afetadas por overrides ativos |
| GET | /api/gis/vertical-transitions | Escadas/elevadores/transições de piso |
| GET | /api/graph/status | Estado do grafo pgRouting |
| GET | /api/graph/edge-overrides | Listar impactos ativos no grafo |
| POST | /api/graph/edge-overrides | Criar bloqueio/multiplicador de custo |
| POST | /api/graph/node-closures | Fechar edges ligadas a um nó |
| POST | /api/graph/edge-overrides/deactivate-by-source | Desativar overrides por origem |
| GET | /api/graph/events | Listar eventos operacionais |
| POST | /api/graph/events | Criar evento operacional |
| GET | /api/route | Endpoint de compatibilidade; usa pgRouting quando o grafo legacy não existe |
| POST | /api/reload | Legacy only; indisponível quando o Map Service está desativado |
| GET | /health | Health check |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Congestion Service (porta 8003)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/heatmap | Heatmap completo |
| GET | /api/heatmap/points | Pontos do heatmap |
| GET | /api/heatmap/{area_id} | Densidade de uma área |
| GET | /api/heatmap/by-type/{area_type} | Heatmap por tipo |
| GET | /api/congestion/alerts | Alertas de congestionamento |
| GET | /api/congestion/summary | Resumo geral |
| GET | /api/congestion/history/{area_id} | Histórico de uma área |
| GET | /api/congestion/hotspots | Zonas mais congestionadas |
| GET | /api/congestion/safest-areas | Zonas mais seguras |
| GET | /api/congestion/trends | Tendências |
| GET | /health | Health check |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Queueing Service (porta 8003 no código, provavelmente outra)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /api/queue/update | Atualizar estado de uma fila |
| GET | /api/queue/waittime/{location_id} | Tempo de espera estimado |
| POST | /api/queue/calculate | Calcular tempo (sem guardar estado) |
| GET | /api/queue/status | Estado de todas as filas |
| GET | /api/queue/alerts | Filas com espera acima do threshold |
| GET | /api/queue/compare | Comparar cenários com N servidores |
| DELETE | /api/queue/{location_id} | Remover fila do tracking |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Maintenance Service (porta 8007)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/maintenance/status | Estado do serviço |
| POST | /api/maintenance/bins/alert | Criar alerta de caixote cheio |
| GET | /api/maintenance/bins/alerts | Listar alertas de caixotes |
| POST | /api/maintenance/tasks | Criar tarefa |
| GET | /api/maintenance/tasks | Listar tarefas |
| GET | /api/maintenance/tasks/{id} | Detalhes de tarefa |
| PATCH | /api/maintenance/tasks/{id} | Atualizar tarefa |
| DELETE | /api/maintenance/tasks/{id} | Apagar tarefa |
| POST | /api/maintenance/tasks/{id}/complete | Marcar como concluída |
| POST | /api/maintenance/tasks/{id}/start | Marcar como em progresso |
| POST | /api/maintenance/assign | Atribuir tarefa manualmente |
| POST | /api/maintenance/assign/auto/{task_id} | Atribuição automática |
| POST | /api/maintenance/assign/batch | Atribuição em lote |
| POST | /api/maintenance/staff/register | Registar staff |
| PATCH | /api/maintenance/staff/{id}/location | Atualizar localização |
| PATCH | /api/maintenance/staff/{id}/availability | Atualizar disponibilidade |
| GET | /api/maintenance/staff | Listar staff |
| GET | /api/maintenance/staff/available | Staff disponível |
| GET | /api/maintenance/staff/{id}/tasks | Tarefas de um staff |
| GET | /api/maintenance/stats | Estatísticas gerais |
| GET | /api/maintenance/stats/staff/{id} | Estatísticas de um staff |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Emergency Service (porta 8006)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/emergency/status | Estado do serviço |
| POST | /api/emergency/incidents | Criar incidente |
| GET | /api/emergency/incidents | Listar incidentes |
| GET | /api/emergency/incidents/{id} | Detalhes de incidente |
| PATCH | /api/emergency/incidents/{id} | Atualizar incidente |
| POST | /api/emergency/incidents/{id}/escalate | Escalar incidente |
| POST | /api/emergency/incidents/{id}/resolve | Resolver incidente |
| POST | /api/emergency/sensors/alert | Criar alerta de sensor |
| GET | /api/emergency/sensors/alerts | Listar alertas de sensores |
| POST | /api/emergency/dispatch | Despachar responders |
| POST | /api/emergency/dispatch/manual | Despacho manual |
| GET | /api/emergency/dispatch/active | Despachos ativos |
| GET | /api/emergency/dispatch/incident/{incident_id} | Dispatches de um incidente |
| POST | /api/emergency/dispatch/{id}/accept | Aceitar dispatch |
| POST | /api/emergency/dispatch/{id}/refuse | Recusar dispatch |
| POST | /api/emergency/dispatch/{id}/complete | Completar dispatch com notas opcionais |
| POST | /api/emergency/dispatch/{id}/arrived | Marcar chegada |
| POST | /api/emergency/evacuation/global | Iniciar evacuação global |
| GET | /api/emergency/evacuation/global/active | Evacuação global ativa |
| POST | /api/emergency/evacuation/global/{id}/safe | Confirmar staff em segurança |
| POST | /api/emergency/evacuation/global/{id}/complete | Concluir evacuação global |
| POST | /api/emergency/evacuation | Iniciar evacuação |
| GET | /api/emergency/evacuation/active | Evacuações ativas |
| GET | /api/emergency/evacuation/{id} | Detalhes de evacuação |
| POST | /api/emergency/evacuation/{id}/complete | Concluir evacuação |
| GET | /api/emergency/stats | Estatísticas |
| GET | /api/emergency/stats/timeline | Timeline de incidentes |
