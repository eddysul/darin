from __future__ import annotations

import asyncio

from .base import SttRequest, ProviderResult
from ..quota.types import Accounting


class OpenAiSttProvider:
    name = "openai"

    def __init__(self, api_key: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, max_retries=0)

    async def transcribe(self, request: SttRequest) -> ProviderResult:
        response = await asyncio.wait_for(
            self._client.audio.transcriptions.create(
                model=request.model,
                file=(request.filename, request.data, request.content_type),
                response_format="json",
            ),
            timeout=request.timeout_seconds,
        )
        text = getattr(response, "text", None)
        valid = isinstance(text, str) and bool(text.strip())
        # This response format has no verified billable-duration evidence.
        # Never treat the submitted duration or text length as actual usage.
        accounting = Accounting(stage_id=request.stage_id, pricing_version=request.pricing_version,
            observed_model=request.model, usage_status="UNKNOWN", parse_status="OK" if valid else "INVALID",
            failure_category=None if valid else "CONTENT_INVALID")
        return ProviderResult(text.strip() if valid else None, accounting)
