"""Process-local, fail-fast admission for the ENTIRE audio request lifetime.

This is a memory/resource reservation, not a provider cost quota. Keep the
independent two-slot media-worker gate. No client header changes this weight.
"""
from __future__ import annotations

import asyncio
import threading
import traceback
from collections.abc import Awaitable, Callable
from typing import TypeVar

try:
    from builtins import BaseExceptionGroup
except ImportError:  # Python 3.10 host: already required by the ASGI stack.
    from exceptiongroup import BaseExceptionGroup

from .audio_duration import DECODE_RATE, MAX_AUDIO_SECONDS, MAX_INPUT_BYTES, SAMPLE_RATES
from .errors import AppError
from .telemetry import METRICS
from .upload import MULTIPART_OVERHEAD_BYTES


# WAV preserves supported rates; AAC uses DECODE_RATE. Do not budget only AAC.
MAX_CANONICAL_AUDIO_BYTES = MAX_AUDIO_SECONDS * max(*SAMPLE_RATES, DECODE_RATE) * 2 * 2 + 44
# Conservative simultaneous copy allowances: input/spool/chunks/join/transport,
# PCM audit/read/BytesIO/canonical, plus bounded parser/pipe/object overhead.
# This bounds admitted audio work, NOT total Python/SDK RSS or child memory.
PER_REQUEST_AUDIO_RESERVATION_BYTES = (
    4 * (MAX_INPUT_BYTES + MULTIPART_OVERHEAD_BYTES)
    + 4 * MAX_CANONICAL_AUDIO_BYTES + 4 * 1024 * 1024
)
MAX_AUDIO_REQUESTS = 2
T = TypeVar("T")


def _forget_exception_frames(error: BaseException) -> None:
    """Drop unwound audio frames/chains before releasing capacity, without GC.

Provider errors and cancelled tasks can otherwise keep bytes via tracebacks,
including suppressed (__context__) exceptions and ExceptionGroup children.
The live caller/admission frames own no audio and are not cleared by Python.
"""
    pending = [error]
    seen: set[int] = set()
    while pending:
        current = pending.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        pending.extend(e for e in (current.__cause__, current.__context__) if e is not None)
        if isinstance(current, BaseExceptionGroup):
            pending.extend(current.exceptions)
        traceback.clear_frames(current.__traceback__)
        current.__traceback__ = current.__cause__ = current.__context__ = None


class AudioRequestAdmission:
    def __init__(self, capacity: int = MAX_AUDIO_REQUESTS):
        # Code-owned configuration only: deliberately no HTTP/env/remote override.
        if type(capacity) is not int or not 1 <= capacity <= MAX_AUDIO_REQUESTS:
            raise ValueError("audio request capacity must be an integer from 1 to 2")
        self.capacity = capacity
        self.reserved_bytes = capacity * PER_REQUEST_AUDIO_RESERVATION_BYTES
        self._slots = threading.BoundedSemaphore(capacity)

    async def run(self, operation: Callable[[], Awaitable[T]]) -> T:
        if not self._slots.acquire(blocking=False):
            METRICS.add("audio_capacity_rejected")
            raise AppError("AUDIO_CAPACITY_EXCEEDED", 503,
                           "Audio processing is busy. Try again later.", True)
        METRICS.add("audio_acquire")
        METRICS.add("audio_active")
        failure: BaseException | None = None
        try:
            try:
                # The helper must fully unwind (including upload/process/accounting
                # cleanup) before this frame releases its reservation.
                return await operation()
            except BaseException as error:
                if isinstance(error, AppError):
                    failure = AppError(error.code, error.status_code, error.message,
                                       error.fallback_recommended)
                    reason = getattr(error, "validation_reason", None)
                    if isinstance(reason, str):
                        failure.validation_reason = reason
                elif isinstance(error, asyncio.CancelledError):
                    failure = asyncio.CancelledError()
                elif isinstance(error, Exception):
                    failure = AppError("INTERNAL_ERROR", 500,
                                       "The request could not be completed.")
                else:
                    failure = error  # Preserve process-termination semantics.
                _forget_exception_frames(error)
            # Outside except: original exception (including SDK request attributes)
            # no longer belongs to this frame. Never attach it to the safe error.
        finally:
            self._slots.release()
            METRICS.add("audio_active", -1)
            METRICS.add("audio_release")
        raise failure from None


# Shared even if a process composes more than one FastAPI app. Test instances
# may be explicitly injected; production main uses this single process budget.
AUDIO_REQUEST_ADMISSION = AudioRequestAdmission()
