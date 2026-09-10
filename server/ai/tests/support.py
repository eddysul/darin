from __future__ import annotations

import asyncio
import hashlib
import uuid
from collections import deque
from dataclasses import replace
from typing import Any

from server.ai.app.auth import AuthContext
from server.ai.app.config import Settings
from server.ai.app.providers import LlmRequest, SttRequest
from server.ai.app.providers.base import ProviderResult
from server.ai.app.quota.types import Accounting
from server.ai.app.quota.pricing import VerifiedAudioDuration
from server.ai.tests.quota_fake import service


def test_settings(**overrides: Any) -> Settings:
    base = Settings(
        supabase_url="https://example.supabase.co",
        supabase_jwt_issuer="https://example.supabase.co/auth/v1",
        supabase_jwt_audience="authenticated",
        supabase_jwks_url="https://example.supabase.co/auth/v1/.well-known/jwks.json",
        openai_api_key="test-placeholder",
        ai_enabled=True,
        build_commit="abc1234",
    )
    return replace(base, **overrides)


class FakeVerifier:
    async def verify(self, token: str) -> AuthContext:
        if token == "valid-token":
            return AuthContext("user-123")
        if token == "expired-token":
            raise ValueError("expired")
        raise ValueError("invalid")


class FakeLlmProvider:
    name = "fake-llm"

    def __init__(self, *results: dict[str, Any] | Exception) -> None:
        self.results = deque(results)
        self.requests: list[LlmRequest] = []

    async def complete_json(self, request: LlmRequest) -> dict[str, Any]:
        self.requests.append(request)
        if not self.results:
            raise AssertionError("fake LLM result queue is empty")
        result = self.results.popleft()
        if isinstance(result, Exception):
            raise result
        if isinstance(result, ProviderResult):
            return result
        return ProviderResult(result, Accounting(stage_id=request.stage_id,
            pricing_version=request.pricing_version, observed_model=request.model,
            usage_status="KNOWN", input_usage=100, output_usage=10, parse_status="OK"))


class FakeSttProvider:
    name = "fake-stt"

    def __init__(self, result: str | Exception = "15:00 분유 120ml") -> None:
        self.result = result
        self.requests: list[SttRequest] = []

    async def transcribe(self, request: SttRequest) -> str:
        self.requests.append(request)
        if isinstance(self.result, Exception):
            raise self.result
        if isinstance(self.result, ProviderResult):
            return self.result
        return ProviderResult(self.result, Accounting(stage_id=request.stage_id,
            pricing_version=request.pricing_version, observed_model=request.model,
            usage_status="KNOWN", billable_duration_ms=4095, parse_status="OK"))


def auth_headers(token: str = "valid-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Idempotency-Key": f"20260909.{uuid.uuid4().hex}"}


def verified_duration(audio):
    return VerifiedAudioDuration(hashlib.sha256(audio.data).hexdigest(), 4095, "verified-duration.v1")


def create_app(**kwargs):
    """Existing regression routes use an explicitly injected central fake and duration proof."""
    from server.ai.app.factory import create_app as factory
    kwargs.setdefault("quota_service", service())
    kwargs.setdefault("duration_verifier", verified_duration)
    return factory(**kwargs)


def consult_body(question: str = "기록을 요약해줘") -> dict[str, Any]:
    return {
        "operation": "consult_record_question",
        "locale": "ko",
        "input": {
            "question": question,
            "facts": [
                {"kind": "sleep", "date": "2026-09-07", "text": "수면 기록은 420분이에요."},
            ],
            "date_range": {"start": "2026-09-01", "end": "2026-09-07"},
            "history_complete": True,
        },
    }


def weekly_body() -> dict[str, Any]:
    return {
        "operation": "weekly_narrative",
        "locale": "ko",
        "input": {
            "period": {
                "date_keys": ["2026-09-06", "2026-09-07"],
                "recorded_days": 2,
                "age_months": 4.2,
            },
            "metrics": [
                {
                    "key": "sleepMinutes",
                    "unit": "minutes",
                    "current": {"avg": 420, "min": 400, "max": 440, "days": 2},
                    "previous": {"avg": 390, "min": 380, "max": 400, "days": 2},
                    "daily": [400, 440],
                    "change_ratio": 0.08,
                },
                {
                    "key": "feedCount",
                    "unit": "count",
                    "current": {"avg": 6, "min": 6, "max": 6, "days": 2},
                    "previous": {"avg": 5, "min": 5, "max": 5, "days": 2},
                    "daily": [6, 6],
                    "change_ratio": 0.2,
                },
            ],
        },
    }


def insight_body() -> dict[str, Any]:
    return {
        "operation": "insight_phrase",
        "locale": "ko",
        "input": {
            "observations": [
                {
                    "id": "feed-sleep",
                    "input_metric": "feedIntervalAvg",
                    "output_metric": "sleepMinutes",
                    "relation": "positive_association",
                    "source_sentence": "수유 간격이 20분 길었던 날에는 수면이 30분 길게 기록됐어요.",
                    "sample_days": 14,
                }
            ]
        },
    }


VALID_M4A = b"\x00\x00\x00\x18ftypM4A " + b"audio-payload"


def timeout_error() -> Exception:
    return asyncio.TimeoutError()
