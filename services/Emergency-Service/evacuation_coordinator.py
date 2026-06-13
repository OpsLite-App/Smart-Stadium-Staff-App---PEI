"""
EVACUATION COORDINATOR
Manages evacuation procedures, route calculation, and corridor closures
"""

from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import asyncio
import uuid
import httpx

from models import EvacuationZone, CorridorClosure, EvacuationType
from schemas import EvacuationRequest, EvacuationResponse


class EvacuationCoordinator:
    """Coordinates evacuation procedures"""
    
    def __init__(self, routing_service_url: str, congestion_service_url: str):
        self.routing_service_url = routing_service_url
        self.congestion_service_url = congestion_service_url
    
    async def initiate_evacuation(
        self,
        db: Session,
        request: EvacuationRequest
    ) -> EvacuationResponse:
        """Initiate evacuation procedure"""
        
        # Calculate exit routes
        exit_routes = await self._calculate_exit_routes(request.affected_zones)
        
        # Create evacuation record
        evacuation = EvacuationZone(
            id=f"evac-{uuid.uuid4().hex[:8]}",
            incident_id=request.incident_id,
            evacuation_type=EvacuationType(request.evacuation_type),
            affected_zones=request.affected_zones,
            exit_routes=exit_routes,
            reason=request.reason,
            status="active"
        )
        
        db.add(evacuation)
        db.commit()
        db.refresh(evacuation)
        
        print(f"[WARNING] Evacuation initiated: evacuation_id={evacuation.id} type={request.evacuation_type}")
        print(f"   Affected zones: {', '.join(request.affected_zones)}")
        
        return self._evacuation_to_response(evacuation)
    
    async def calculate_evacuation_route(self, from_location: str) -> Optional[Dict]:
        """Calculate safest evacuation route from location to nearest exit"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.routing_service_url}/api/route/evacuation",
                    params={"from_node": from_location}
                )
                
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            print(f"[ERROR] Route calculation failed: {e}")
        
        return None
    
    async def _calculate_exit_routes(self, zones: List[str]) -> Dict:
        """Calculate exit routes for multiple zones"""
        routes = {}
        
        # Simplified: return empty dict, would calculate per zone
        for zone in zones:
            routes[zone] = {
                "primary_exit": "21",
                "alternative_exits": ["1", "20"],
                "status": "calculated"
            }
        
        return routes
    
    def add_corridor_closure(
        self,
        db: Session,
        from_node: str,
        to_node: str,
        reason: str
    ) -> Dict:
        """Add corridor closure"""
        closure = CorridorClosure(
            id=f"closure-{uuid.uuid4().hex[:8]}",
            from_node=from_node,
            to_node=to_node,
            reason=reason
        )
        
        db.add(closure)
        db.commit()
        
        source = self._closure_source(from_node, to_node)

        # Update pgRouting runtime state.
        asyncio.create_task(self._notify_routing_closure(from_node, to_node, reason, source))
        
        print(f"🚫 Corridor closed: {from_node} → {to_node} (reason: {reason})")
        
        return {
            "id": closure.id,
            "from_node": from_node,
            "to_node": to_node,
            "reason": reason,
            "closed_at": closure.closed_at.isoformat()
        }
    
    def remove_corridor_closure(self, db: Session, from_node: str, to_node: str) -> Dict:
        """Remove corridor closure"""
        closure = db.query(CorridorClosure).filter(
            CorridorClosure.from_node == from_node,
            CorridorClosure.to_node == to_node,
            CorridorClosure.is_active == True
        ).first()
        
        if closure:
            closure.is_active = False
            closure.reopened_at = datetime.now()
            db.commit()

            source = self._closure_source(from_node, to_node)
            asyncio.create_task(self._notify_routing_reopen(source))
            
            print(f"[INFO] Corridor reopened: from_node={from_node} to_node={to_node}")
            
            return {"status": "reopened", "from_node": from_node, "to_node": to_node}
        
        return {"status": "not_found"}
    
    def _closure_source(self, from_node: str, to_node: str) -> str:
        return f"evacuation-coordinator:{from_node}:{to_node}"

    async def _notify_routing_closure(self, from_node: str, to_node: str, reason: str, source: str):
        """Notify pgRouting of a corridor closure using node-closure overrides."""
        node_ids = list(dict.fromkeys([from_node, to_node]))
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                for node_id in node_ids:
                    response = await client.post(
                        f"{self.routing_service_url}/api/graph/node-closures",
                        json={
                            "node_id": int(str(node_id).removeprefix("N").removeprefix("n")),
                            "reason": reason,
                            "source": source,
                            "severity": 1.0,
                            "is_active": True,
                        },
                    )
                    if response.status_code >= 400:
                        print(f"[WARNING] Failed to close routing node: node_id={node_id} response={response.text}")
        except Exception as exc:
            print(f"[WARNING] Routing closure notification failed: from_node={from_node} to_node={to_node} error={exc}")

    async def _notify_routing_reopen(self, source: str):
        """Deactivate pgRouting overrides created for a corridor closure."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{self.routing_service_url}/api/graph/edge-overrides/deactivate-by-source",
                    params={"source": source},
                )
                if response.status_code >= 400:
                    print(f"[WARNING] Failed to reopen routing closure: source={source} response={response.text}")
        except Exception as exc:
            print(f"[WARNING] Routing reopen notification failed: source={source} error={exc}")
    
    def get_active_evacuations(self, db: Session) -> List[EvacuationZone]:
        """Get active evacuations"""
        return db.query(EvacuationZone).filter(
            EvacuationZone.status == "active"
        ).all()
    
    def get_evacuation(self, db: Session, evacuation_id: str) -> Optional[EvacuationResponse]:
        """Get evacuation details"""
        evac = db.query(EvacuationZone).filter(
            EvacuationZone.id == evacuation_id
        ).first()
        
        return self._evacuation_to_response(evac) if evac else None
    
    def complete_evacuation(self, db: Session, evacuation_id: str) -> Optional[EvacuationResponse]:
        """Mark evacuation as completed"""
        evac = db.query(EvacuationZone).filter(
            EvacuationZone.id == evacuation_id
        ).first()
        
        if evac:
            evac.status = "completed"
            evac.completed_at = datetime.now()
            db.commit()
            db.refresh(evac)
            
            print(f"[INFO] Evacuation completed: evacuation_id={evacuation_id}")
            
            return self._evacuation_to_response(evac)
        
        return None
    
    async def recalculate_routes(self, db: Session, evacuation_id: str):
        """Recalculate evacuation routes based on current conditions"""
        # This would fetch congestion data and recalculate routes
        pass
    
    def _evacuation_to_response(self, evac: EvacuationZone) -> EvacuationResponse:
        """Convert to response"""
        return EvacuationResponse(
            id=evac.id,
            incident_id=evac.incident_id,
            evacuation_type=evac.evacuation_type.value,
            affected_zones=evac.affected_zones,
            affected_nodes=evac.affected_nodes,
            exit_routes=evac.exit_routes,
            blocked_corridors=evac.blocked_corridors,
            status=evac.status,
            initiated_at=evac.initiated_at.isoformat(),
            completed_at=evac.completed_at.isoformat() if evac.completed_at else None,
            estimated_people=evac.estimated_people,
            evacuated_count=evac.evacuated_count,
            reason=evac.reason,
            incident_metadata=evac.incident_metadata
        )
