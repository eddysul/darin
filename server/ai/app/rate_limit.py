from __future__ import annotations

import asyncio
import time
import math
from collections import deque
from collections.abc import Callable


class InMemoryRateLimiter:
    """Bounded per-instance sliding-window guard keyed by authenticated user."""

    def __init__(self, clock: Callable[[], float] = time.monotonic, *, max_keys: int = 10_000) -> None:
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._expiry: dict[str, float] = {}
        self._max_keys = max_keys
        self._next_sweep = 0.0
        self._lock = asyncio.Lock()

    async def allow(self, key: str, limit: int, window_seconds: float = 60.0) -> tuple[bool, int]:
        async with self._lock:
            now = self._clock()
            cutoff = now - window_seconds
            if now >= self._next_sweep or len(self._events) >= self._max_keys:
                for expired in [k for k, expiry in self._expiry.items() if expiry <= now]:
                    del self._events[expired]
                    del self._expiry[expired]
                self._next_sweep = now + 60
            if key not in self._events:
                # Fail closed at capacity; evicting live users would reset quotas.
                if len(self._events) >= self._max_keys:
                    return False, 60
                self._events[key] = deque()
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, math.ceil(window_seconds - (now - events[0])))
                return False, retry_after
            events.append(now)
            self._expiry[key] = now + window_seconds
            return True, 0
