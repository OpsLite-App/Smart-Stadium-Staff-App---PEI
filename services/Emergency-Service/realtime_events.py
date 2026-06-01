"""Redis-backed operational event stream with an in-process SSE fan-out."""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, AsyncIterator, Optional, Set

from fastapi.encoders import jsonable_encoder

try:
    import redis
except ImportError:
    redis = None

logger = logging.getLogger(__name__)


class RealtimeEventBus:
    """Persists audit events in Redis Streams and broadcasts them over SSE."""

    def __init__(self) -> None:
        self._subscribers: Set[asyncio.Queue[dict[str, Any]]] = set()
        self._stream_name = os.getenv("OPERATIONAL_EVENTS_STREAM", "opslite:operational-events")
        self._max_events = int(os.getenv("OPERATIONAL_EVENTS_MAXLEN", "5000"))
        self._redis_client = self._connect_redis()

    def publish(self, event_type: str, payload: Any) -> dict[str, Any]:
        event = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            "payload": jsonable_encoder(payload),
        }

        event_id = self._persist(event)
        if event_id:
            event["id"] = event_id

        stale_subscribers: list[asyncio.Queue[dict[str, Any]]] = []
        for queue in self._subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                stale_subscribers.append(queue)

        for queue in stale_subscribers:
            self._subscribers.discard(queue)

        return event

    def list_events(self, limit: int = 100, event_type: Optional[str] = None) -> list[dict[str, Any]]:
        """Return the most recent persisted audit events, newest first."""
        client = self._get_redis_client()
        if not client:
            return []

        try:
            entries = client.xrevrange(self._stream_name, count=limit)
        except Exception as exc:
            logger.warning("Redis Stream read failed: %s", exc)
            return []

        events = [self._deserialize(event_id, fields) for event_id, fields in entries]
        if event_type:
            events = [event for event in events if event["type"] == event_type]
        return events

    def status(self) -> dict[str, Any]:
        """Expose enough state for health checks and project demonstrations."""
        length = 0
        client = self._get_redis_client()
        if client:
            try:
                length = int(client.xlen(self._stream_name))
            except Exception:
                pass

        return {
            "backend": "redis-streams" if client else "memory-only",
            "stream": self._stream_name,
            "persisted_events": length,
            "sse_subscribers": len(self._subscribers),
        }

    async def stream(self) -> AsyncIterator[str]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)

        try:
            yield self._format("connected", {
                "type": "connected",
                "timestamp": datetime.now().isoformat(),
                "payload": {
                    "message": "Emergency realtime stream connected",
                    **self.status(),
                },
            })

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                    yield self._format(event["type"], event)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            self._subscribers.discard(queue)

    def _connect_redis(self):
        if not redis:
            logger.warning("Redis package unavailable. Audit persistence disabled.")
            return None

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/4")
        try:
            client = redis.from_url(redis_url, decode_responses=True)
            client.ping()
            logger.info("Operational event stream connected to Redis")
            return client
        except Exception as exc:
            logger.warning("Redis unavailable. Realtime will run memory-only: %s", exc)
            return None

    def _persist(self, event: dict[str, Any]) -> Optional[str]:
        client = self._get_redis_client()
        if not client:
            return None

        try:
            return str(client.xadd(
                self._stream_name,
                {
                    "type": event["type"],
                    "timestamp": event["timestamp"],
                    "payload": json.dumps(event["payload"], ensure_ascii=False, separators=(",", ":")),
                },
                maxlen=self._max_events,
                approximate=True,
            ))
        except Exception as exc:
            logger.warning("Redis Stream write failed: %s", exc)
            self._redis_client = None
            return None

    def _get_redis_client(self):
        if not self._redis_client:
            self._redis_client = self._connect_redis()
        return self._redis_client

    @staticmethod
    def _deserialize(event_id: str, fields: dict[str, str]) -> dict[str, Any]:
        try:
            payload = json.loads(fields.get("payload", "{}"))
        except json.JSONDecodeError:
            payload = {"raw": fields.get("payload")}

        return {
            "id": event_id,
            "type": fields.get("type", "unknown"),
            "timestamp": fields.get("timestamp"),
            "payload": payload,
        }

    @staticmethod
    def _format(event_name: str, event: dict[str, Any]) -> str:
        data = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
        event_id = f"id: {event['id']}\n" if event.get("id") else ""
        return f"{event_id}event: {event_name}\ndata: {data}\n\n"
