from __future__ import annotations

import os
import re
from dataclasses import dataclass
from urllib.parse import urlparse


SERVICE_NAME = "darin-ai"
SERVICE_VERSION = "0.1.0"
POLICY_VERSION = "2026-09-08.v2-p0"


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Required environment variable is missing: {name}")
    return value


def _boolean(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be a boolean")


def _positive_float(name: str, default: float, upper_bound: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be numeric") from exc
    if value <= 0 or value > upper_bound:
        raise RuntimeError(f"{name} must be between 0 and {upper_bound}")
    return value


def _validate_supabase_url(value: str) -> str:
    normalized = value.rstrip("/")
    parsed = urlparse(normalized)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (local and parsed.scheme == "http"):
        raise RuntimeError("SUPABASE_URL must use HTTPS outside local development")
    if not parsed.netloc:
        raise RuntimeError("SUPABASE_URL must be an absolute URL")
    return normalized


def _validate_secure_url(name: str, value: str) -> str:
    parsed = urlparse(value)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (local and parsed.scheme == "http"):
        raise RuntimeError(f"{name} must use HTTPS outside local development")
    if not parsed.netloc:
        raise RuntimeError(f"{name} must be an absolute URL")
    return value


def _build_commit() -> str:
    value = os.getenv("DARIN_BUILD_COMMIT", "unknown").strip() or "unknown"
    if value != "unknown" and not re.fullmatch(r"[0-9a-fA-F]{7,64}", value):
        raise RuntimeError("DARIN_BUILD_COMMIT must be a Git SHA or unknown")
    return value


@dataclass(frozen=True, slots=True)
class Settings:
    supabase_url: str
    supabase_jwt_issuer: str
    supabase_jwt_audience: str
    supabase_jwks_url: str
    openai_api_key: str
    ai_enabled: bool = False
    build_commit: str = "unknown"
    llm_model: str = "gpt-4o-mini"
    stt_model: str = "whisper-1"
    llm_timeout_seconds: float = 20.0
    stt_timeout_seconds: float = 45.0
    max_json_bytes: int = 128 * 1024
    max_audio_bytes: int = 24 * 1024 * 1024
    ai_requests_per_minute: int = 30
    transcribe_requests_per_minute: int = 10
    cors_allowed_origins: tuple[str, ...] = ()
    log_hash_salt: str = ""

    @classmethod
    def from_env(cls) -> "Settings":
        supabase_url = _validate_supabase_url(_required("SUPABASE_URL"))
        issuer = _validate_secure_url(
            "SUPABASE_JWT_ISSUER",
            os.getenv("SUPABASE_JWT_ISSUER", "").strip() or f"{supabase_url}/auth/v1",
        )
        jwks_url = _validate_secure_url(
            "SUPABASE_JWKS_URL",
            os.getenv("SUPABASE_JWKS_URL", "").strip() or f"{issuer}/.well-known/jwks.json",
        )
        audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip()
        if not audience:
            raise RuntimeError("SUPABASE_JWT_AUDIENCE must not be empty")
        origins = tuple(
            origin.strip()
            for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
            if origin.strip()
        )
        return cls(
            supabase_url=supabase_url,
            supabase_jwt_issuer=issuer,
            supabase_jwt_audience=audience,
            supabase_jwks_url=jwks_url,
            openai_api_key=_required("OPENAI_API_KEY"),
            ai_enabled=_boolean("DARIN_AI_ENABLED", False),
            build_commit=_build_commit(),
            llm_timeout_seconds=_positive_float("DARIN_LLM_TIMEOUT_SECONDS", 20.0, 60.0),
            stt_timeout_seconds=_positive_float("DARIN_STT_TIMEOUT_SECONDS", 45.0, 90.0),
            cors_allowed_origins=origins,
            log_hash_salt=os.getenv("DARIN_LOG_HASH_SALT", "").strip(),
        )
