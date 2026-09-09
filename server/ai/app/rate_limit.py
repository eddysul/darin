from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from collections.abc import Callable


class InMemoryRateLimiter:
    """Small per-instance fixed-window guard keyed by authenticated user."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str, limit: int, window_seconds: float = 60.0) -> tuple[bool, int]:
        now = self._clock()
        cutoff = now - window_seconds
        async with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int(window_seconds - (now - events[0])))
                return False, retry_after
            events.append(now)
            return True, 0
