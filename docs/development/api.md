## Auth Service (Spring Boot — porta 8081)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /auth/login | Login |
| POST | /auth/validate | Validar token |
| GET | /auth/me | Dados do utilizador atual |
| GET | /auth/staff | Listar staff |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Map Service (porta 8000)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/map | Mapa completo (nodes, edges, closures) |
| GET | /api/nodes | Todos os nodes |
| GET | /api/nodes/{id} | Node específico |
| PUT | /api/nodes/{id} | Atualizar node |
| GET | /api/edges | Todas as edges |
| GET | /api/edges/{id} | Edge específica |
| PUT | /api/edges/{id} | Atualizar edge |
| GET | /api/closures | Todas as closures |
| GET | /api/closures/{id} | Closure específica |
| POST | /api/closures | Criar closure |
| DELETE | /api/closures/{id} | Remover closure |
| GET | /api/tiles | Todos os tiles |
| GET | /api/tiles/{id} | Tile específico |
| PUT | /api/tiles/{id} | Atualizar tile |
| GET | /api/pois | Todos os POIs |
| GET | /api/pois/{id} | POI específico |
| PUT | /api/pois/{id} | Atualizar POI |
| GET | /api/seats | Todos os lugares |
| GET | /api/seats/{id} | Lugar específico |
| PUT | /api/seats/{id} | Atualizar lugar |
| GET | /api/gates | Todos os portões |
| GET | /api/gates/{id} | Portão específico |
| PUT | /api/gates/{id} | Atualizar portão |
| GET | /health | Health check |
| POST | /api/reset | Reset da base de dados |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## Routing Service (porta 8002)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /api/route | Calcular rota (A*) |
| POST | /api/route/multi | Rota multi-destino |
| POST | /api/route/nearest | Nó mais próximo |
| GET | /api/route/evacuation | Rota de evacuação |
| POST | /api/hazards/closure | Adicionar closure |
| DELETE | /api/hazards/closure | Remover closure |
| POST | /api/hazards/update | Atualizar hazard num nó |
| POST | /api/hazards/crowd | Atualizar penalidade de multidão |
| DELETE | /api/hazards/clear | Limpar hazards de um nó |
| GET | /api/hazards/status | Estado dos hazards |
| POST | /api/reload | Recarregar grafo do Map Service |
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


## Maintenance Service (porta 8006)

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


## Emergency Service (porta 8007)

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
| POST | /api/emergency/dispatch/{id}/arrived | Marcar chegada |
| POST | /api/emergency/evacuation | Iniciar evacuação |
| GET | /api/emergency/evacuation/active | Evacuações ativas |
| GET | /api/emergency/evacuation/{id} | Detalhes de evacuação |
| POST | /api/emergency/evacuation/{id}/complete | Concluir evacuação |
| GET | /api/emergency/stats | Estatísticas |
| GET | /api/emergency/stats/timeline | Timeline de incidentes |