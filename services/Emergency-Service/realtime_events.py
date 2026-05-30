"""Small in-process SSE event bus for operational emergency updates."""

import asyncio
import json
from datetime import datetime
from typing import Any, AsyncIterator, Set

from fastapi.encoders import jsonable_encoder


class RealtimeEventBus:
    """Broadcasts emergency events to connected SSE clients.

    This is intentionally local to the Emergency Service process. It is enough
    for the dev/runtime compose setup and keeps the real-time path simple.
    """

    def __init__(self) -> None:
        self._subscribers: Set[asyncio.Queue[dict[str, Any]]] = set()

    def publish(self, event_type: str, payload: Any) -> None:
        event = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            "payload": jsonable_encoder(payload),
        }

        stale_subscribers: list[asyncio.Queue[dict[str, Any]]] = []
        for queue in self._subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                stale_subscribers.append(queue)

        for queue in stale_subscribers:
            self._subscribers.discard(queue)

    async def stream(self) -> AsyncIterator[str]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)

        try:
            yield self._format("connected", {
                "type": "connected",
                "timestamp": datetime.now().isoformat(),
                "payload": {"message": "Emergency realtime stream connected"},
            })

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                    yield self._format(event["type"], event)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            self._subscribers.discard(queue)

    @staticmethod
    def _format(event_name: str, event: dict[str, Any]) -> str:
        data = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
        return f"event: {event_name}\ndata: {data}\n\n"
