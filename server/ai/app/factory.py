from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .audio import read_validated_audio
from .auth import AuthContext, RequireAuth, SupabaseJwksVerifier, TokenVerifier
from .config import POLICY_VERSION, SERVICE_NAME, SERVICE_VERSION, Settings
from .errors import AppError, invalid_input, output_rejected
from .models import ExecuteEnvelope, ExecuteResponse, Locale, TranscribeResponse
from .operations import execute_operation, parse_operation_input
from .policy import untrusted_payload, voice_system_prompt
from .privacy_log import PrivacyLogger
from .providers import (
    LlmProvider,
    LlmRequest,
    OpenAiLlmProvider,
    OpenAiSttProvider,
    SttProvider,
    SttRequest,
)
from .rate_limit import InMemoryRateLimiter
from .validators import validate_voice_events
from .upload import MULTIPART_OVERHEAD_BYTES, bounded_upload, check_declared_size


async def _read_json(request: Request, max_bytes: int) -> dict[str, Any]:
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > max_bytes:
            raise AppError("REQUEST_TOO_LARGE", 413, "The request body is too large.")
        chunks.append(chunk)
    try:
        value = json.loads(b"".join(chunks))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise invalid_input() from exc
    if not isinstance(value, dict):
        raise invalid_input()
    return value


def _error_body(error: AppError, request_id: str) -> dict[str, Any]:
    return {
        "error": {"code": error.code, "message": error.message},
        "requestId": request_id,
        "fallbackRecommended": error.fallback_recommended,
    }


def create_app(
    *,
    settings: Settings | None = None,
    verifier: TokenVerifier | None = None,
    llm_provider: LlmProvider | None = None,
    stt_provider: SttProvider | None = None,
    limiter: InMemoryRateLimiter | None = None,
    privacy_logger: PrivacyLogger | None = None,
) -> FastAPI:
    resolved = settings or Settings.from_env()
    auth = RequireAuth(verifier or SupabaseJwksVerifier(resolved))
    llm = llm_provider or OpenAiLlmProvider(resolved.openai_api_key)
    stt = stt_provider or OpenAiSttProvider(resolved.openai_api_key)
    rate_limiter = limiter or InMemoryRateLimiter()
    audit = privacy_logger or PrivacyLogger(hash_salt=resolved.log_hash_salt)

    app = FastAPI(title="Darin AI Backend", version=SERVICE_VERSION)
    if resolved.cors_allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(resolved.cors_allowed_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type", "Accept"],
        )

    @app.middleware("http")
    async def request_boundary(request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.monotonic()
        content_length = request.headers.get("content-length")
        body_limit = (
            resolved.max_audio_bytes + MULTIPART_OVERHEAD_BYTES
            if request.url.path == "/v1/transcribe"
            else resolved.max_json_bytes
        )
        if request.url.path.startswith("/v1/") and request.url.path != "/v1/transcribe" and content_length:
            try:
                if int(content_length) > body_limit:
                    error = AppError("REQUEST_TOO_LARGE", 413, "The request body is too large.")
                    return JSONResponse(_error_body(error, request_id), status_code=error.status_code)
            except ValueError:
                error = invalid_input()
                return JSONResponse(_error_body(error, request_id), status_code=error.status_code)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        user_id = getattr(request.state, "user_id", None)
        audit.event(
            "request_complete",
            request_id=request_id,
            operation=getattr(request.state, "operation", None),
            user=audit.opaque_user(user_id) if user_id else None,
            status=response.status_code,
            latency_ms=round((time.monotonic() - started) * 1000),
            path=request.url.path,
        )
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, error: AppError):
        audit.event(
            "request_rejected",
            request_id=request.state.request_id,
            operation=getattr(request.state, "operation", None),
            user=audit.opaque_user(request.state.user_id) if hasattr(request.state, "user_id") else None,
            status=error.status_code,
            error_code=error.code,
            path=request.url.path,
        )
        response = JSONResponse(_error_body(error, request.state.request_id), status_code=error.status_code)
        if error.code == "RATE_LIMITED":
            response.headers["Retry-After"] = "60"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, _error: RequestValidationError):
        error = invalid_input()
        return JSONResponse(_error_body(error, request.state.request_id), status_code=error.status_code)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, _error: Exception):
        error = AppError("INTERNAL_ERROR", 500, "The request could not be completed.")
        return JSONResponse(_error_body(error, request.state.request_id), status_code=error.status_code)

    async def require_enabled() -> None:
        if not resolved.ai_enabled:
            raise AppError("AI_DISABLED", 503, "AI operations are temporarily disabled.", True)

    async def enforce_rate(user_id: str, bucket: str, limit: int) -> None:
        allowed, _retry_after = await rate_limiter.allow(f"{user_id}:{bucket}", limit)
        if not allowed:
            raise AppError("RATE_LIMITED", 429, "Too many requests. Try again later.", True)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/version")
    async def version() -> dict[str, str]:
        return {
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "commit": resolved.build_commit,
            "policyVersion": POLICY_VERSION,
        }

    @app.post("/v1/ai/execute", response_model=ExecuteResponse)
    async def ai_execute(
        request: Request,
        auth_context: AuthContext = Depends(auth),
    ) -> ExecuteResponse:
        await require_enabled()
        raw = await _read_json(request, resolved.max_json_bytes)
        try:
            envelope = ExecuteEnvelope.model_validate(raw)
        except ValidationError as exc:
            raise invalid_input() from exc
        request.state.operation = envelope.operation
        operation_input = parse_operation_input(envelope.operation, envelope.input)
        await enforce_rate(
            auth_context.user_id,
            f"ai:{envelope.operation}",
            resolved.ai_requests_per_minute,
        )
        return await execute_operation(
            envelope.operation,
            operation_input,
            envelope.locale,
            resolved,
            llm,
        )

    @app.post("/v1/transcribe", response_model=TranscribeResponse, openapi_extra={
        # Documentation only; never restore File/Form automatic parsing here.
        "requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {
            "type": "object", "required": ["file"], "additionalProperties": False,
            "properties": {
                "file": {"type": "string", "format": "binary"},
                "locale": {"type": "string", "enum": ["ko", "en", "ja", "es", "zh-CN"], "default": "ko"},
            },
        }}}},
    })
    async def transcribe(
        request: Request,
        auth_context: AuthContext = Depends(auth),
    ) -> TranscribeResponse:
        request.state.operation = "transcribe"
        check_declared_size(request, resolved.max_audio_bytes + MULTIPART_OVERHEAD_BYTES)
        await require_enabled()
        await enforce_rate(
            auth_context.user_id,
            "transcribe",
            resolved.transcribe_requests_per_minute,
        )
        async with bounded_upload(request, resolved.max_audio_bytes) as (file, locale):
            audio = await read_validated_audio(file, resolved.max_audio_bytes)
            try:
                transcript = await stt.transcribe(
                    SttRequest(
                        data=audio.data,
                        filename=audio.safe_filename,
                        content_type=audio.content_type,
                        model=resolved.stt_model,
                        timeout_seconds=resolved.stt_timeout_seconds,
                    )
                )
            except (asyncio.TimeoutError, TimeoutError) as exc:
                raise AppError("PROVIDER_TIMEOUT", 504, "The STT provider did not respond in time.", True) from exc
            except AppError:
                raise
            except Exception as exc:
                raise AppError("PROVIDER_ERROR", 502, "The STT provider request failed.", True) from exc

            if not transcript.strip() or len(transcript) > 12_000:
                raise output_rejected()
            try:
                raw_events = await llm.complete_json(
                    LlmRequest(
                        operation="voice_event_parse",
                        system_prompt=voice_system_prompt(locale),
                        untrusted_input=untrusted_payload({"transcript": transcript}),
                        model=resolved.llm_model,
                        max_output_tokens=900,
                        timeout_seconds=resolved.llm_timeout_seconds,
                    )
                )
            except (asyncio.TimeoutError, TimeoutError) as exc:
                raise AppError("PROVIDER_TIMEOUT", 504, "The event parser did not respond in time.", True) from exc
            except Exception as exc:
                raise AppError("PROVIDER_ERROR", 502, "The event parser request failed.", True) from exc
            events = validate_voice_events(raw_events, transcript)
            return TranscribeResponse(
                events=events.events,
                date=datetime.now(timezone.utc).date().isoformat(),
                raw_text=transcript,
            )

    return app
