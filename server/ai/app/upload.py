"""Post-auth bounded parsing using Starlette's existing multipart parser."""
from __future__ import annotations

from contextlib import asynccontextmanager
import math

from anyio import CancelScope, current_time
from anyio.lowlevel import checkpoint

from fastapi import Request
from pydantic import TypeAdapter, ValidationError
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.requests import ClientDisconnect
from python_multipart.exceptions import MultipartParseError

from .errors import AppError, invalid_input
from .models import Locale


MULTIPART_OVERHEAD_BYTES = 64 * 1024
# Code-owned, not an HTTP or environment override. 24 MiB / 120s is ~1.7 Mbit/s;
# operational tuning remains a separate staging decision within the hard bound.
UPLOAD_ABSOLUTE_TIMEOUT_SECONDS = 120.0
MAX_UPLOAD_ABSOLUTE_TIMEOUT_SECONDS = 180.0


def validate_upload_timeout(seconds: float) -> None:
    if (type(seconds) not in (int, float) or not 0 < seconds <= MAX_UPLOAD_ABSOLUTE_TIMEOUT_SECONDS
            or not math.isfinite(seconds)):
        raise ValueError("upload timeout must be finite, positive and at most 180 seconds")


def upload_timeout() -> AppError:
    return AppError("AUDIO_UPLOAD_TIMEOUT", 408, "The audio upload did not finish in time.", True)


def check_declared_size(request: Request, max_bytes: int) -> None:
    value = request.headers.get("content-length")
    if value is not None:
        if not value.isascii() or not value.isdecimal():
            raise invalid_input()
        digits = value.lstrip("0") or "0"
        ceiling = str(max_bytes)
        if len(digits) > len(ceiling) or (len(digits) == len(ceiling) and digits > ceiling):
            raise AppError("REQUEST_TOO_LARGE", 413, "The request body is too large.")


class BoundedMultipartParser(MultiPartParser):
    """Add per-file limits and explicit ownership; do not implement a parser."""

    def __init__(self, headers, stream, max_file_bytes: int):
        super().__init__(headers, stream, max_files=1, max_fields=1, max_part_size=32)
        self.max_file_bytes = max_file_bytes
        self.file_bytes = 0
        self.complete = False
        self.owned_files = []

    def on_part_begin(self):
        super().on_part_begin()
        self.file_bytes = 0

    def on_headers_finished(self):
        super().on_headers_finished()
        if self._current_part.file is not None:
            self.owned_files.append(self._current_part.file.file)

    def on_part_data(self, data, start, end):
        if self._current_part.file is not None:
            self.file_bytes += end - start
            if self.file_bytes > self.max_file_bytes:
                raise AppError("REQUEST_TOO_LARGE", 413, "The audio file is too large.")
        super().on_part_data(data, start, end)

    def on_end(self):
        self.complete = True
        super().on_end()


@asynccontextmanager
async def bounded_upload(request: Request, max_file_bytes: int, *,
                         timeout_seconds: float = UPLOAD_ABSOLUTE_TIMEOUT_SECONDS):
    # This helper is entered immediately after admission, before the first read.
    # One monotonic deadline covers the entire body (including final ASGI EOF).
    deadline = current_time() + timeout_seconds
    limit = max_file_bytes + MULTIPART_OVERHEAD_BYTES
    check_declared_size(request, limit)
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "multipart/form-data":
        raise invalid_input()

    async def stream():
        consumed = 0
        async for chunk in request.stream():
            # Also enforce time when buffered receives complete synchronously.
            # A progress byte never resets the deadline.
            if current_time() >= deadline:
                raise upload_timeout()
            await checkpoint()
            consumed += len(chunk)
            if consumed > limit:
                raise AppError("REQUEST_TOO_LARGE", 413, "The request body is too large.")
            # Do not forward an oversized ASGI chunk to the parser.
            for offset in range(0, len(chunk), 64 * 1024):
                yield chunk[offset:offset + 64 * 1024]

    parser = BoundedMultipartParser(request.headers, stream(), max_file_bytes)
    try:
        # Same-task cancellation: no detached wait_for/read/parser task can
        # survive the response. Starlette's spool writes await their worker.
        with CancelScope(deadline=deadline) as upload_scope:
            form = await parser.parse()
        if upload_scope.cancel_called or current_time() >= deadline:
            raise upload_timeout()
        # The timer is gone BEFORE yielding to duration/quota/provider work.
        items = form.multi_items()
        if not parser.complete or any(k not in {"file", "locale"} for k, _ in items):
            raise invalid_input()
        files = form.getlist("file")
        locales = form.getlist("locale")
        if len(files) != 1 or not isinstance(files[0], UploadFile) or len(locales) > 1:
            raise invalid_input()
        locale = TypeAdapter(Locale).validate_python(locales[0] if locales else "ko")
        yield files[0], locale
    except (MultiPartException, MultipartParseError, ClientDisconnect, ValidationError) as exc:
        raise invalid_input() from exc
    finally:
        # Synchronous close also runs on CancelledError before/after parse returns.
        # Do not rely on request.form() registering cleanup only after success.
        for file in parser.owned_files:
            if not file.closed:
                file.close()
